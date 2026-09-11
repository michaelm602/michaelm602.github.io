"use strict";
/* global module, require */

const crypto = require("node:crypto");

const OPERATION_TYPE = "stripe_print_price_sync";
const PRODUCT_CLAIM_TTL_MS = 5 * 60 * 1000;
const MULTIPLE_STRIPE_PRODUCTS_MESSAGE =
    "Use one Stripe Product per artwork, with one Price per print size. These saved Price IDs belong to different Stripe Products.";
const CHECKOUT_READINESS_MESSAGE =
    "Stripe prices are synced, but print checkout still requires the trusted server checkout catalog to support this product.";
const PRODUCT_IMAGE_MISSING_WARNING =
    "Stripe Product image was not updated because this product has no valid primary image. Price sync continued.";
const PRODUCT_IMAGE_UNREACHABLE_WARNING =
    "Stripe Product image was not updated because the primary image could not be reached. Check the saved image path and retry Stripe sync.";
const PRODUCT_IMAGE_UPDATE_WARNING =
    "Stripe Product image could not be updated. Price sync continued; retry Stripe sync after checking the primary image.";
const PUBLIC_PRODUCT_IMAGE_PATH = /^(airbrush|photoshop)\/.+/;
const STANDARD_PRINT_PRICES = Object.freeze({
    "16x20": Object.freeze({ label: "16x20", amountCents: 10000, currency: "usd" }),
    "18x24": Object.freeze({ label: "18x24", amountCents: 20000, currency: "usd" }),
    "24x36": Object.freeze({ label: "24x36", amountCents: 30000, currency: "usd" }),
    "30x40": Object.freeze({ label: "30x40", amountCents: 40000, currency: "usd" }),
});

class StripePriceSyncError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "StripePriceSyncError";
        this.code = code;
    }
}

function requireAdminUid(auth) {
    if (!auth?.uid) {
        throw new StripePriceSyncError("unauthenticated", "Sign in before using Stripe price sync.");
    }
    if (auth.token?.admin !== true) {
        throw new StripePriceSyncError("permission-denied", "An admin claim is required for Stripe price sync.");
    }
    return auth.uid;
}

function validateHandlerInput(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new StripePriceSyncError("invalid-argument", "Stripe sync input must be an object.");
    }
    const action = data.action;
    const allowedKeys = action === "preview"
        ? ["action", "productId"]
        : action === "confirm"
            ? ["action", "productId", "operationId", "canonicalProductChoice"]
            : ["action", "productId", "operationId"];
    if (!["preview", "confirm", "create"].includes(action)
        || Object.keys(data).some((key) => !allowedKeys.includes(key))) {
        throw new StripePriceSyncError("invalid-argument", "Use preview, confirm, or create with only the supported fields.");
    }
    if (typeof data.productId !== "string"
        || data.productId.length > 100
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.productId)) {
        throw new StripePriceSyncError("invalid-argument", "A valid saved product ID is required.");
    }
    if (["confirm", "create"].includes(action) && (typeof data.operationId !== "string"
        || !/^[A-Za-z0-9_-]{1,150}$/.test(data.operationId))) {
        throw new StripePriceSyncError("invalid-argument", "Preview Stripe sync before creating prices.");
    }
    if (action === "confirm") {
        const choice = data.canonicalProductChoice;
        if (!choice || typeof choice !== "object" || Array.isArray(choice)) {
            throw new StripePriceSyncError("invalid-argument", "Choose a canonical Stripe Product before confirming.");
        }
        const allowedChoiceKeys = choice.mode === "existing"
            ? ["mode", "stripeProductId"]
            : ["mode"];
        if (!["new", "existing"].includes(choice.mode)
            || Object.keys(choice).some((key) => !allowedChoiceKeys.includes(key))
            || (choice.mode === "existing"
                && (typeof choice.stripeProductId !== "string"
                    || !/^prod_[A-Za-z0-9]+$/.test(choice.stripeProductId)))) {
            throw new StripePriceSyncError("invalid-argument", "Choose a verified existing Product or a new canonical Product.");
        }
    }
}

function relevantProductSnapshot(product) {
    return {
        id: product?.id,
        title: product?.title,
        printsAvailable: product?.prints?.available === true,
        options: Array.isArray(product?.prints?.options)
            ? product.prints.options.map((option) => ({
                id: option?.id,
                label: option?.label,
                amountCents: option?.amountCents,
                currency: option?.currency,
                stripePriceId: typeof option?.stripePriceId === "string" && option.stripePriceId.trim()
                    ? option.stripePriceId.trim()
                    : null,
            }))
            : null,
    };
}

function productFingerprint(product) {
    return crypto
        .createHash("sha256")
        .update(JSON.stringify(relevantProductSnapshot(product)))
        .digest("hex");
}

function mappingOptionSnapshot(product) {
    return Array.isArray(product?.prints?.options)
        ? product.prints.options.map((option) => ({
            optionId: option?.id,
            label: option?.label,
            amountCents: option?.amountCents,
            currency: option?.currency,
            stripePriceId: typeof option?.stripePriceId === "string" && option.stripePriceId.trim()
                ? option.stripePriceId.trim()
                : null,
        }))
        : null;
}

function matchesMappingOptionSnapshot(product, expectedOptions) {
    const currentOptions = mappingOptionSnapshot(product);
    if (!Array.isArray(currentOptions)
        || !Array.isArray(expectedOptions)
        || currentOptions.length !== expectedOptions.length) return false;
    const currentById = new Map(currentOptions.map((option) => [option.optionId, option]));
    return expectedOptions.every((expected) => {
        const current = currentById.get(expected.optionId);
        return current
            && current.label === expected.label
            && current.amountCents === expected.amountCents
            && current.currency === expected.currency
            && current.stripePriceId === expected.stripePriceId;
    });
}

function lookupKeyFor(productId, optionId) {
    const readable = `${productId}-${optionId}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 150);
    const suffix = crypto.createHash("sha256").update(`${productId}:${optionId}`).digest("hex").slice(0, 12);
    return `likwit-print-${readable}-${suffix}`;
}

function optionValidationMessage(option) {
    if (!option || typeof option !== "object") return "Print option data is missing.";
    if (typeof option.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(option.id)) {
        return "Option ID must use lowercase letters, numbers, and hyphens.";
    }
    if (typeof option.label !== "string" || !option.label.trim()) return "A label is required.";
    if (!Number.isSafeInteger(option.amountCents) || option.amountCents <= 0) {
        return "A positive whole-cent price is required.";
    }
    if (typeof option.currency !== "string" || !/^[a-z]{3}$/.test(option.currency)) {
        return "A lowercase three-letter currency is required.";
    }
    const standard = STANDARD_PRINT_PRICES[option.id];
    if (!standard) return "Only standard print option IDs can be synced to Stripe.";
    if (option.label.trim() !== standard.label
        || option.amountCents !== standard.amountCents
        || option.currency !== standard.currency) {
        return `The ${option.id} standard price is ${standard.amountCents} ${standard.currency} with label ${standard.label}.`;
    }
    return null;
}

function stripeProductId(price) {
    if (typeof price?.product === "string") return price.product;
    return typeof price?.product?.id === "string" ? price.product.id : null;
}

function stripePriceConflict(price, option) {
    if (!price || typeof price.id !== "string") return "Stripe returned an invalid Price.";
    if (price.active !== true) return "The Stripe Price is inactive.";
    if (price.type !== "one_time") return "The Stripe Price is recurring instead of one-time.";
    if (price.unit_amount !== option.amountCents) return "The Stripe Price amount does not match Firestore.";
    if (price.currency !== option.currency) return "The Stripe Price currency does not match Firestore.";
    if (!stripeProductId(price)) return "The Stripe Price has no Product.";
    return null;
}

function isTransientStripeError(error) {
    const statusCode = Number(error?.statusCode || error?.raw?.statusCode);
    if (statusCode === 429 || statusCode >= 500) return true;
    const indicators = [error?.code, error?.type, error?.rawType, error?.raw?.type]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
    return indicators.some((value) => [
        "api_connection_error",
        "api_error",
        "lock_timeout",
        "rate_limit_error",
        "stripeapierror",
        "stripeconnectionerror",
        "striperatelimiterror",
    ].includes(value));
}

async function inspectStripeProduct(productValue, firestoreProductId, stripe) {
    let product = productValue;
    if (typeof productValue === "string") {
        try {
            product = await stripe.products.retrieve(productValue);
        } catch (error) {
            if (isTransientStripeError(error)) {
                throw new StripePriceSyncError("unavailable", "Stripe Product verification is temporarily unavailable.");
            }
            return { conflict: "The associated Stripe Product could not be verified." };
        }
    }
    if (!product || typeof product.id !== "string" || product.deleted === true) {
        return { conflict: "The associated Stripe Product is invalid or deleted." };
    }
    if (product.active !== true) return { conflict: "The associated Stripe Product is inactive." };
    const mappedProductId = product.metadata?.firestore_product_id;
    if (mappedProductId && mappedProductId !== firestoreProductId) {
        return { conflict: "The associated Stripe Product belongs to a different Firestore product." };
    }
    return {
        stripeProductId: product.id,
        stripeProductName: typeof product.name === "string" && product.name.trim()
            ? product.name.trim()
            : null,
        stripeProductImages: Array.isArray(product.images)
            ? product.images.filter((image) => typeof image === "string")
            : [],
    };
}

async function inspectStripePrice(price, option, firestoreProductId, stripe) {
    const conflict = stripePriceConflict(price, option);
    if (conflict) return { conflict };
    return inspectStripeProduct(price.product, firestoreProductId, stripe);
}

async function listPricesByLookupKey(stripe, lookupKey) {
    const [active, inactive] = await Promise.all([
        stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 2 }),
        stripe.prices.list({ lookup_keys: [lookupKey], active: false, limit: 2 }),
    ]);
    const byId = new Map();
    for (const price of [...(active.data || []), ...(inactive.data || [])]) {
        if (price?.id) byId.set(price.id, price);
    }
    return [...byId.values()];
}

function stableProductIdempotencyKey(productId) {
    return `likwit-admin-print-product:${productId}`;
}

function stableProductImageIdempotencyKey(productId, imageUrl) {
    const imageSuffix = crypto.createHash("sha256").update(imageUrl).digest("hex").slice(0, 16);
    return `likwit-admin-print-product-image:${productId}:${imageSuffix}`;
}

function primaryProductImage(product) {
    if (!Array.isArray(product?.images) || typeof product?.primaryImageId !== "string") return null;
    return product.images.find((image) => image?.id === product.primaryImageId) || null;
}

function isPublicProductImageUrl(value) {
    if (typeof value !== "string" || !value.trim()) return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
    } catch {
        return false;
    }
}

function createFirebaseStorageProductImageResolver({ bucket }) {
    return async (product) => {
        const image = primaryProductImage(product);
        const storagePath = typeof image?.storagePath === "string" ? image.storagePath.trim() : "";
        if (!storagePath || !PUBLIC_PRODUCT_IMAGE_PATH.test(storagePath)) return null;
        if (!bucket?.name || typeof bucket.file !== "function") {
            throw new Error("Firebase Storage bucket is unavailable.");
        }
        const [exists] = await bucket.file(storagePath).exists();
        if (!exists) return null;
        const bucketName = encodeURIComponent(bucket.name);
        const objectPath = encodeURIComponent(storagePath);
        return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${objectPath}?alt=media`;
    };
}

async function updateCanonicalProductImage({
    product,
    stripe,
    stripeProductId,
    stripeProductImages,
    resolveProductImageUrl,
}) {
    if (typeof resolveProductImageUrl !== "function") return [];
    let imageUrl;
    try {
        imageUrl = await resolveProductImageUrl(product);
    } catch {
        return [PRODUCT_IMAGE_UNREACHABLE_WARNING];
    }
    if (!isPublicProductImageUrl(imageUrl)) return [PRODUCT_IMAGE_MISSING_WARNING];
    if (stripeProductImages.length === 1 && stripeProductImages[0] === imageUrl) return [];
    try {
        await stripe.products.update(
            stripeProductId,
            { images: [imageUrl] },
            { idempotencyKey: stableProductImageIdempotencyKey(product.id, imageUrl) }
        );
        return [];
    } catch {
        return [PRODUCT_IMAGE_UPDATE_WARNING];
    }
}

function canonicalLookupKeyFor(productId, optionId, stripeProductId) {
    const productSuffix = crypto.createHash("sha256").update(stripeProductId).digest("hex").slice(0, 10);
    return `${lookupKeyFor(productId, optionId)}-${productSuffix}`;
}

function stablePriceIdempotencyKey(productId, optionId, stripeProductId) {
    return `likwit-admin-print-price:${productId}:${optionId}:${stripeProductId}`;
}

async function findRecoverableStripeProduct(stripe, firestoreProductId) {
    let response;
    try {
        response = await stripe.products.search({
            query: `metadata['source']:'likwit_admin_price_sync' AND metadata['firestore_product_id']:'${firestoreProductId}' AND metadata['canonical_product']:'true'`,
            limit: 3,
        });
    } catch (error) {
        throw new StripePriceSyncError(
            "unavailable",
            `Stripe Product recovery is temporarily unavailable: ${error?.code || "request_failed"}.`
        );
    }
    const matches = response.data || [];
    if (matches.length > 1) {
        return { conflict: "Multiple Stripe Products are tagged for this Firestore product." };
    }
    if (!matches.length) return { stripeProductId: null };
    return inspectStripeProduct(matches[0], firestoreProductId, stripe);
}

function planItem(option) {
    return {
        optionId: option.id,
        label: option.label,
        amountCents: option.amountCents,
        currency: option.currency,
        currentStripePriceId: typeof option.stripePriceId === "string" && option.stripePriceId.trim()
            ? option.stripePriceId.trim()
            : null,
        lookupKey: lookupKeyFor(option.productId, option.id),
    };
}

function summarize(items) {
    const summary = { existing: 0, missing: 0, recoverable: 0, conflicts: 0, invalid: 0 };
    for (const item of items) {
        if (item.status === "existing") summary.existing += 1;
        else if (item.status === "missing") summary.missing += 1;
        else if (item.status === "recoverable") summary.recoverable += 1;
        else if (item.status === "invalid") summary.invalid += 1;
        else if (item.status === "conflict") summary.conflicts += 1;
    }
    return summary;
}

async function inspectProduct(product, stripe) {
    if (!product || typeof product !== "object") {
        throw new StripePriceSyncError("not-found", "The saved product was not found.");
    }
    if (!Array.isArray(product.prints?.options) || product.prints.options.length === 0) {
        throw new StripePriceSyncError("failed-precondition", "Add and save print options before previewing Stripe sync.");
    }

    const items = [];
    const stripeProducts = new Map();
    for (const sourceOption of product.prints.options) {
        const option = { ...sourceOption, productId: product.id };
        const item = planItem(option);
        const invalid = optionValidationMessage(option);
        if (invalid) {
            items.push({ ...item, status: "invalid", message: invalid });
            continue;
        }

        if (item.currentStripePriceId) {
            try {
                const price = await stripe.prices.retrieve(item.currentStripePriceId);
                const inspection = await inspectStripePrice(price, option, product.id, stripe);
                if (inspection.conflict) items.push({ ...item, status: "conflict", message: inspection.conflict });
                else {
                    const productId = inspection.stripeProductId;
                    stripeProducts.set(productId, inspection.stripeProductName);
                    items.push({
                        ...item,
                        status: "existing",
                        stripePriceId: price.id,
                        stripeProductId: productId,
                        stripeProductName: inspection.stripeProductName,
                        message: "Existing Stripe Price matches Firestore.",
                    });
                }
            } catch (error) {
                if (error instanceof StripePriceSyncError || isTransientStripeError(error)) {
                    throw error instanceof StripePriceSyncError
                        ? error
                        : new StripePriceSyncError("unavailable", `Stripe verification is temporarily unavailable for ${option.id}.`);
                }
                items.push({ ...item, status: "conflict", message: "The saved Stripe Price ID could not be verified.", errorCode: error?.code || null });
            }
            continue;
        }

        try {
            const matches = await listPricesByLookupKey(stripe, item.lookupKey);
            if (!matches.length) {
                items.push({ ...item, status: "missing", message: "A new Stripe Price will be created." });
                continue;
            }
            if (matches.length !== 1) {
                items.push({ ...item, status: "conflict", message: "Multiple Stripe Prices use this sync lookup key." });
                continue;
            }
            const price = matches[0];
            const inspection = await inspectStripePrice(price, option, product.id, stripe);
            if (inspection.conflict) items.push({ ...item, status: "conflict", stripePriceId: price.id, message: inspection.conflict });
            else {
                const productId = inspection.stripeProductId;
                stripeProducts.set(productId, inspection.stripeProductName);
                items.push({
                    ...item,
                    status: "recoverable",
                    stripePriceId: price.id,
                    stripeProductId: productId,
                    stripeProductName: inspection.stripeProductName,
                    message: "A matching Stripe Price can be attached without creating another.",
                });
            }
        } catch (error) {
            if (error instanceof StripePriceSyncError) throw error;
            throw new StripePriceSyncError("unavailable", `Stripe preview failed for ${option.id}: ${error?.code || "request_failed"}.`);
        }
    }

    const hasBlockingItem = items.some((item) => ["invalid", "conflict"].includes(item.status));
    const hasMultipleStripeProducts = stripeProducts.size > 1;
    if (hasMultipleStripeProducts) {
        for (const item of items) {
            if (item.status !== "invalid") {
                item.status = "conflict";
                item.message = MULTIPLE_STRIPE_PRODUCTS_MESSAGE;
            }
        }
    }

    const canonicalProductCandidates = [...stripeProducts].map(([stripeProductId, stripeProductName]) => ({
        stripeProductId,
        stripeProductName,
    }));
    const recommendedCanonicalProductChoice = hasMultipleStripeProducts || stripeProducts.size === 0
        ? { mode: "new" }
        : { mode: "existing", stripeProductId: canonicalProductCandidates[0].stripeProductId };
    return {
        fingerprint: productFingerprint(product),
        stripeProductId: stripeProducts.size === 1 ? [...stripeProducts.keys()][0] : null,
        conflictCode: hasMultipleStripeProducts ? "multiple_stripe_products" : null,
        conflictGuidance: hasMultipleStripeProducts ? MULTIPLE_STRIPE_PRODUCTS_MESSAGE : null,
        conflictingStripeProducts: hasMultipleStripeProducts
            ? canonicalProductCandidates
            : [],
        canonicalProductCandidates,
        recommendedCanonicalProductChoice,
        canConfirm: !hasBlockingItem
            && (!hasMultipleStripeProducts || product.prints?.available !== true),
        items,
        summary: summarize(items),
    };
}

async function previewStripePrintPriceSync({ productId, requestedBy, stripe, store }) {
    const product = await store.getProduct(productId);
    const inspection = await inspectProduct(product, stripe);
    const record = {
        type: OPERATION_TYPE,
        status: "previewed",
        productId,
        requestedBy,
        fingerprint: inspection.fingerprint,
        expectedOptions: mappingOptionSnapshot(product),
        stripeProductId: inspection.stripeProductId,
        conflictCode: inspection.conflictCode,
        conflictGuidance: inspection.conflictGuidance,
        conflictingStripeProducts: inspection.conflictingStripeProducts,
        canonicalProductCandidates: inspection.canonicalProductCandidates,
        recommendedCanonicalProductChoice: inspection.recommendedCanonicalProductChoice,
        canConfirm: inspection.canConfirm,
        plan: inspection.items,
        previewSummary: inspection.summary,
    };
    const operationId = await store.createOperation(record);
    return {
        operationId,
        productId,
        status: record.status,
        stripeProductId: record.stripeProductId,
        conflictCode: record.conflictCode,
        conflictGuidance: record.conflictGuidance,
        conflictingStripeProducts: record.conflictingStripeProducts,
        canonicalProductCandidates: record.canonicalProductCandidates,
        recommendedCanonicalProductChoice: record.recommendedCanonicalProductChoice,
        canConfirm: record.canConfirm,
        items: record.plan,
        summary: record.previewSummary,
    };
}

function sameCanonicalProductChoice(left, right) {
    return left?.mode === right?.mode
        && (left?.mode !== "existing" || left.stripeProductId === right.stripeProductId);
}

function confirmedPlanFor(items, choice) {
    return items.map((item) => {
        const keepsExisting = choice.mode === "existing"
            && item.stripeProductId === choice.stripeProductId
            && Boolean(item.stripePriceId);
        return {
            ...item,
            action: keepsExisting
                ? item.currentStripePriceId ? "keep" : "attach_existing"
                : item.currentStripePriceId ? "replace_firestore_reference" : "create",
        };
    });
}

async function confirmStripePrintPriceSync({
    productId,
    operationId,
    canonicalProductChoice,
    requestedBy,
    stripe,
    store,
}) {
    const operation = await store.getOperation(operationId);
    if (!operation || operation.type !== OPERATION_TYPE || operation.productId !== productId) {
        throw new StripePriceSyncError("not-found", "The Stripe sync preview operation was not found.");
    }
    if (operation.requestedBy !== requestedBy) {
        throw new StripePriceSyncError("permission-denied", "This Stripe sync preview belongs to another admin session.");
    }
    if (operation.status === "confirmed") {
        if (!sameCanonicalProductChoice(operation.canonicalProductChoice, canonicalProductChoice)) {
            throw new StripePriceSyncError("failed-precondition", "This operation was already confirmed with a different canonical Product.");
        }
        return operation.confirmationResponse;
    }
    if (operation.status !== "previewed") {
        throw new StripePriceSyncError("failed-precondition", "Preview Stripe sync again before confirming.");
    }
    if (operation.canConfirm !== true) {
        throw new StripePriceSyncError(
            "failed-precondition",
            operation.conflictCode === "multiple_stripe_products"
                ? "Turn Prints available off before resolving multiple Stripe Products."
                : "Resolve the blocking Stripe conflicts before confirming."
        );
    }

    const product = await store.getProduct(productId);
    if (!product || productFingerprint(product) !== operation.fingerprint) {
        await store.updateOperation(operationId, { status: "stale", message: "Product pricing changed after preview." });
        throw new StripePriceSyncError("failed-precondition", "Product pricing changed after preview. Preview Stripe sync again.");
    }

    if (canonicalProductChoice.mode === "existing") {
        const verifiedCandidate = (operation.canonicalProductCandidates || [])
            .some((candidate) => candidate.stripeProductId === canonicalProductChoice.stripeProductId);
        if (!verifiedCandidate) {
            throw new StripePriceSyncError("failed-precondition", "The selected Stripe Product was not verified by this preview.");
        }
        const inspection = await inspectStripeProduct(canonicalProductChoice.stripeProductId, productId, stripe);
        if (inspection.conflict) {
            throw new StripePriceSyncError("failed-precondition", inspection.conflict);
        }
    }

    const confirmedPlan = confirmedPlanFor(operation.plan, canonicalProductChoice);
    const response = {
        operationId,
        productId,
        status: "confirmed",
        canonicalProductChoice,
        items: confirmedPlan,
        checkoutReadinessMessage: CHECKOUT_READINESS_MESSAGE,
    };
    await store.updateOperation(operationId, {
        status: "confirmed",
        canonicalProductChoice,
        confirmedPlan,
        confirmationResponse: response,
    });
    return response;
}

function priceCreateParams(product, item, productId) {
    return {
        active: true,
        currency: item.currency,
        unit_amount: item.amountCents,
        product: productId,
        lookup_key: item.lookupKey,
        nickname: `${product.title} - ${item.label}`.slice(0, 250),
        metadata: {
            source: "likwit_admin_price_sync",
            firestore_product_id: product.id,
            print_option_id: item.optionId,
        },
    };
}

function executionSummary(results) {
    return {
        created: results.filter((item) => item.status === "created").length,
        attached: results.filter((item) => item.status === "attached").length,
        existing: results.filter((item) => item.status === "existing").length,
        conflicts: results.filter((item) => item.status === "conflict").length,
        failed: results.filter((item) => item.status === "failed").length,
        skipped: results.filter((item) => item.status === "skipped").length,
    };
}

async function createMissingStripePrices({
    productId,
    operationId,
    requestedBy,
    stripe,
    store,
    resolveProductImageUrl,
}) {
    const operation = await store.getOperation(operationId);
    if (!operation || operation.type !== OPERATION_TYPE || operation.productId !== productId) {
        throw new StripePriceSyncError("not-found", "The Stripe sync preview operation was not found.");
    }
    if (operation.requestedBy !== requestedBy) {
        throw new StripePriceSyncError("permission-denied", "This Stripe sync preview belongs to another admin session.");
    }
    if (operation.status === "completed" && operation.response) return operation.response;
    if (!["confirmed", "running", "partial_failure"].includes(operation.status)
        || !operation.canonicalProductChoice
        || !Array.isArray(operation.confirmedPlan)) {
        throw new StripePriceSyncError("failed-precondition", "Confirm the canonical Stripe Product before creating prices.");
    }

    const product = await store.getProduct(productId);
    if (!product) throw new StripePriceSyncError("not-found", "The saved product was not found.");
    if (productFingerprint(product) !== operation.fingerprint) {
        await store.updateOperation(operationId, { status: "stale", message: "Product pricing changed after preview." });
        throw new StripePriceSyncError("failed-precondition", "Product pricing changed after preview. Preview Stripe sync again.");
    }

    await store.updateOperation(operationId, { status: "running" });
    const expectedMappingOptions = operation.expectedOptions;
    const results = [];
    let warnings = [];
    let targetProductId = null;
    const proposedProductId = operation.canonicalProductChoice.mode === "existing"
        ? operation.canonicalProductChoice.stripeProductId
        : null;
    const mapping = await store.claimProductMapping(productId, operationId, proposedProductId, expectedMappingOptions);
    if (["busy", "stale", "conflict"].includes(mapping.status)) {
        const message = mapping.status === "busy"
            ? "Another Stripe sync is establishing the canonical Product. Retry this operation."
            : mapping.status === "stale"
                ? "Product print options changed during Stripe sync. Preview again."
                : "A different canonical Stripe Product is already mapped.";
        const status = mapping.status === "busy" ? "partial_failure" : "completed_with_conflicts";
        const blocked = operation.confirmedPlan.map((item) => ({
            ...item,
            status: mapping.status === "busy" ? "failed" : "conflict",
            message,
        }));
        const summary = executionSummary(blocked);
        const response = {
            operationId,
            productId,
            status,
            stripeProductId: mapping.stripeProductId || null,
            results: blocked,
            summary,
            checkoutReadinessMessage: CHECKOUT_READINESS_MESSAGE,
        };
        await store.updateOperation(operationId, { ...response, response });
        return response;
    }

    try {
        if (mapping.status === "mapped") {
            targetProductId = mapping.stripeProductId;
        } else if (mapping.status === "claimed") {
            const recoverable = await findRecoverableStripeProduct(stripe, product.id);
            if (recoverable.conflict) throw new StripePriceSyncError("failed-precondition", recoverable.conflict);
            let productInspection = recoverable;
            if (!productInspection.stripeProductId) {
                const stripeProduct = await stripe.products.create(
                    {
                        name: product.title,
                        active: true,
                        metadata: {
                            source: "likwit_admin_price_sync",
                            canonical_product: "true",
                            firestore_product_id: product.id,
                        },
                    },
                    { idempotencyKey: stableProductIdempotencyKey(product.id) }
                );
                productInspection = await inspectStripeProduct(stripeProduct, product.id, stripe);
            }
            if (productInspection.conflict) throw new StripePriceSyncError("failed-precondition", productInspection.conflict);
            const finalized = await store.finalizeProductMapping(
                productId,
                operationId,
                productInspection.stripeProductId,
                expectedMappingOptions
            );
            if (finalized.status !== "mapped" || finalized.stripeProductId !== productInspection.stripeProductId) {
                throw new StripePriceSyncError(
                    "failed-precondition",
                    finalized.status === "stale"
                        ? "Product print options changed during Stripe sync. Preview again."
                        : "The canonical Stripe Product mapping changed during creation."
                );
            }
            targetProductId = finalized.stripeProductId;
        }

        const productInspection = await inspectStripeProduct(targetProductId, product.id, stripe);
        if (productInspection.conflict) {
            throw new StripePriceSyncError("failed-precondition", productInspection.conflict);
        }
        warnings = await updateCanonicalProductImage({
            product,
            stripe,
            stripeProductId: targetProductId,
            stripeProductImages: productInspection.stripeProductImages,
            resolveProductImageUrl,
        });
    } catch (error) {
        if (!targetProductId) await store.releaseProductClaim(productId, operationId);
        const failed = operation.confirmedPlan.map((item) => ({
            ...item,
            status: error instanceof StripePriceSyncError && error.code === "failed-precondition" ? "conflict" : "failed",
            message: error?.message || "Stripe Product creation or mapping failed. Retry this operation.",
            errorCode: error?.code || null,
        }));
        const summary = executionSummary(failed);
        const status = summary.failed ? "partial_failure" : "completed_with_conflicts";
        const response = { operationId, productId, status, stripeProductId: targetProductId, results: failed, summary, checkoutReadinessMessage: CHECKOUT_READINESS_MESSAGE };
        await store.updateOperation(operationId, { ...response, response });
        return response;
    }

    const replacements = [];
    for (const item of operation.confirmedPlan) {
        const currentExpectedPriceId = item.currentStripePriceId
            || (item.stripeProductId === targetProductId ? item.stripePriceId : null);
        try {
            let price = null;
            let reusedSavedPrice = false;
            let recovered = false;
            if (currentExpectedPriceId) {
                try {
                    const savedPrice = await stripe.prices.retrieve(currentExpectedPriceId);
                    const savedInspection = await inspectStripePrice(savedPrice, item, product.id, stripe);
                    if (!savedInspection.conflict && savedInspection.stripeProductId === targetProductId) {
                        price = savedPrice;
                        reusedSavedPrice = Boolean(item.currentStripePriceId);
                        recovered = !reusedSavedPrice;
                    }
                } catch (error) {
                    if (isTransientStripeError(error)) throw error;
                }
            }

            const canonicalLookupKey = canonicalLookupKeyFor(product.id, item.optionId, targetProductId);
            if (!price) {
                const matches = await listPricesByLookupKey(stripe, canonicalLookupKey);
                if (matches.length > 1) {
                    throw new StripePriceSyncError("failed-precondition", "Multiple Stripe Prices use this canonical sync lookup key.");
                }
                if (matches.length === 1) {
                    const inspection = await inspectStripePrice(matches[0], item, product.id, stripe);
                    if (inspection.conflict) throw new StripePriceSyncError("failed-precondition", inspection.conflict);
                    if (inspection.stripeProductId !== targetProductId) {
                        throw new StripePriceSyncError("failed-precondition", "The canonical lookup Price belongs to another Stripe Product.");
                    }
                    price = matches[0];
                    recovered = true;
                }
            }
            if (!price) {
                price = await stripe.prices.create(
                    priceCreateParams(product, { ...item, lookupKey: canonicalLookupKey }, targetProductId),
                    { idempotencyKey: stablePriceIdempotencyKey(product.id, item.optionId, targetProductId) }
                );
            }

            replacements.push({ optionId: item.optionId, stripePriceId: price.id });
            results.push({
                ...item,
                status: reusedSavedPrice ? "existing" : recovered ? "attached" : "created",
                stripePriceId: price.id,
                stripeProductId: targetProductId,
                message: reusedSavedPrice
                    ? "Existing Price already belongs to the confirmed canonical Product."
                    : recovered
                        ? "Canonical Stripe Price recovered for atomic Firestore update."
                        : "Stripe Price created; Firestore will update after every Price succeeds.",
            });
        } catch (error) {
            const isConflict = error instanceof StripePriceSyncError && error.code === "failed-precondition";
            results.push({
                ...item,
                status: isConflict ? "conflict" : "failed",
                message: isConflict
                    ? error.message
                    : "Stripe Price creation or verification failed. Firestore was not changed; retry this operation.",
                errorCode: error?.code || null,
            });
        }
        await store.updateOperation(operationId, { status: "running", stripeProductId: targetProductId, results });
    }

    if (results.every((result) => ["created", "attached", "existing"].includes(result.status))) {
        let update;
        try {
            update = await store.replacePriceIdsAtomically(productId, expectedMappingOptions, replacements);
        } catch {
            update = { status: "failed", message: "The atomic Firestore update failed. Retry this operation." };
        }
        if (!["updated", "unchanged"].includes(update.status)) {
            for (const result of results) {
                result.status = update.status === "failed" ? "failed" : "conflict";
                result.message = update.message;
            }
        } else {
            for (const result of results) {
                result.message = result.status === "existing"
                    ? "Existing canonical Stripe Price ID was preserved."
                    : "Canonical Stripe Price ID saved to Firestore.";
            }
        }
    } else {
        for (const result of results) {
            if (["created", "attached", "existing"].includes(result.status)) {
                result.message = "Stripe Price is ready, but Firestore was left unchanged because another Price failed.";
            }
        }
    }

    const summary = executionSummary(results);
    const status = summary.failed > 0
        ? "partial_failure"
        : summary.conflicts > 0 || summary.skipped > 0
            ? "completed_with_conflicts"
            : "completed";
    const response = {
        operationId,
        productId,
        status,
        stripeProductId: targetProductId,
        results,
        summary,
        warnings,
        checkoutReadinessMessage: CHECKOUT_READINESS_MESSAGE,
    };
    await store.updateOperation(operationId, { status, stripeProductId: targetProductId, results, summary, warnings, response });
    return response;
}

async function handleAdminStripePrintPriceSync(request, { getStripe, store, resolveProductImageUrl }) {
    const requestedBy = requireAdminUid(request?.auth);
    validateHandlerInput(request?.data);
    const stripe = getStripe();
    if (request.data.action === "preview") {
        return previewStripePrintPriceSync({ productId: request.data.productId, requestedBy, stripe, store });
    }
    if (request.data.action === "confirm") {
        return confirmStripePrintPriceSync({
            productId: request.data.productId,
            operationId: request.data.operationId,
            canonicalProductChoice: request.data.canonicalProductChoice,
            requestedBy,
            stripe,
            store,
        });
    }
    return createMissingStripePrices({
        productId: request.data.productId,
        operationId: request.data.operationId,
        requestedBy,
        stripe,
        store,
        resolveProductImageUrl,
    });
}

function createFirestoreStripeSyncStore({ firestore, serverTimestamp }) {
    const operations = firestore.collection("adminStripePriceSyncOperations");
    const productMappings = firestore.collection("adminStripePrintProductMappings");
    const products = firestore.collection("shopProducts");
    return {
        async getProduct(productId) {
            const snapshot = await products.doc(productId).get();
            return snapshot.exists ? { ...snapshot.data(), id: snapshot.id || productId } : null;
        },
        async createOperation(record) {
            const ref = operations.doc();
            const timestamp = serverTimestamp();
            await ref.set({ ...record, createdAt: timestamp, updatedAt: timestamp });
            return ref.id;
        },
        async getOperation(operationId) {
            const snapshot = await operations.doc(operationId).get();
            return snapshot.exists ? { id: operationId, ...snapshot.data() } : null;
        },
        async updateOperation(operationId, patch) {
            await operations.doc(operationId).set(
                { ...patch, updatedAt: serverTimestamp() },
                { merge: true }
            );
        },
        async claimProductMapping(productId, operationId, proposedStripeProductId = null, expectedOptions = null) {
            const mappingRef = productMappings.doc(productId);
            const productRef = products.doc(productId);
            return firestore.runTransaction(async (transaction) => {
                const productSnapshot = await transaction.get(productRef);
                const snapshot = await transaction.get(mappingRef);
                if (!productSnapshot.exists
                    || !matchesMappingOptionSnapshot(productSnapshot.data(), expectedOptions)) {
                    return { status: "stale" };
                }
                const mapping = snapshot.exists ? snapshot.data() : {};
                if (mapping.stripeProductId) {
                    if (proposedStripeProductId && proposedStripeProductId !== mapping.stripeProductId) {
                        return { status: "conflict", stripeProductId: mapping.stripeProductId };
                    }
                    return { status: "mapped", stripeProductId: mapping.stripeProductId };
                }
                const nowMs = Date.now();
                if (mapping.claimOperationId
                    && mapping.claimOperationId !== operationId
                    && Number(mapping.claimExpiresAtMs) > nowMs) {
                    return { status: "busy" };
                }
                if (proposedStripeProductId) {
                    const timestamp = serverTimestamp();
                    transaction.set(mappingRef, {
                        productId,
                        stripeProductId: proposedStripeProductId,
                        claimOperationId: null,
                        claimExpiresAtMs: 0,
                        ...(snapshot.exists ? {} : { createdAt: timestamp }),
                        updatedAt: timestamp,
                    }, { merge: true });
                    return { status: "mapped", stripeProductId: proposedStripeProductId };
                }
                const timestamp = serverTimestamp();
                transaction.set(mappingRef, {
                    productId,
                    claimOperationId: operationId,
                    claimExpiresAtMs: nowMs + PRODUCT_CLAIM_TTL_MS,
                    ...(snapshot.exists ? {} : { createdAt: timestamp }),
                    updatedAt: timestamp,
                }, { merge: true });
                return { status: "claimed" };
            });
        },
        async finalizeProductMapping(productId, operationId, stripeProductId, expectedOptions = null) {
            const mappingRef = productMappings.doc(productId);
            const productRef = products.doc(productId);
            return firestore.runTransaction(async (transaction) => {
                const productSnapshot = await transaction.get(productRef);
                const snapshot = await transaction.get(mappingRef);
                if (!productSnapshot.exists
                    || !matchesMappingOptionSnapshot(productSnapshot.data(), expectedOptions)) {
                    return { status: "stale" };
                }
                const mapping = snapshot.exists ? snapshot.data() : {};
                if (mapping.stripeProductId && mapping.stripeProductId !== stripeProductId) {
                    return { status: "conflict", stripeProductId: mapping.stripeProductId };
                }
                if (mapping.claimOperationId && mapping.claimOperationId !== operationId) {
                    return { status: "conflict", stripeProductId: mapping.stripeProductId || null };
                }
                transaction.set(mappingRef, {
                    productId,
                    stripeProductId,
                    claimOperationId: null,
                    claimExpiresAtMs: 0,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                return { status: "mapped", stripeProductId };
            });
        },
        async releaseProductClaim(productId, operationId) {
            const mappingRef = productMappings.doc(productId);
            return firestore.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(mappingRef);
                if (!snapshot.exists) return false;
                const mapping = snapshot.data();
                if (mapping.stripeProductId || mapping.claimOperationId !== operationId) return false;
                transaction.set(mappingRef, {
                    claimOperationId: null,
                    claimExpiresAtMs: 0,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                return true;
            });
        },
        async replacePriceIdsAtomically(productId, expectedOptions, replacements) {
            const productRef = products.doc(productId);
            return firestore.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(productRef);
                if (!snapshot.exists) {
                    return { status: "conflict", message: "The product no longer exists." };
                }
                const product = snapshot.data();
                if (!matchesMappingOptionSnapshot(product, expectedOptions)) {
                    return {
                        status: "conflict",
                        message: "Product print options or Stripe Price IDs changed after confirmation. Preview again.",
                    };
                }
                const replacementById = new Map(
                    replacements.map((replacement) => [replacement.optionId, replacement.stripePriceId])
                );
                if (replacementById.size !== replacements.length
                    || replacementById.size !== expectedOptions.length
                    || expectedOptions.some((option) => !replacementById.has(option.optionId))) {
                    return { status: "conflict", message: "The confirmed Stripe Price set is incomplete." };
                }
                const options = product.prints.options.map((option) => ({
                    ...option,
                    stripePriceId: replacementById.get(option.id),
                }));
                transaction.update(productRef, {
                    "prints.options": options,
                    updatedAt: serverTimestamp(),
                });
                return { status: "updated" };
            });
        },
    };
}

module.exports = {
    OPERATION_TYPE,
    STANDARD_PRINT_PRICES,
    StripePriceSyncError,
    canonicalLookupKeyFor,
    confirmStripePrintPriceSync,
    createFirebaseStorageProductImageResolver,
    createMissingStripePrices,
    createFirestoreStripeSyncStore,
    handleAdminStripePrintPriceSync,
    lookupKeyFor,
    previewStripePrintPriceSync,
    productFingerprint,
};

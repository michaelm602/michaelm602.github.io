"use strict";
/* global module, require */

const crypto = require("node:crypto");

const OPERATION_TYPE = "stripe_print_price_sync";
const PRODUCT_CLAIM_TTL_MS = 5 * 60 * 1000;
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
    const allowedKeys = action === "create"
        ? ["action", "productId", "operationId"]
        : ["action", "productId"];
    if (!["preview", "create"].includes(action)
        || Object.keys(data).some((key) => !allowedKeys.includes(key))) {
        throw new StripePriceSyncError("invalid-argument", "Use preview or create with only the supported fields.");
    }
    if (typeof data.productId !== "string"
        || data.productId.length > 100
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.productId)) {
        throw new StripePriceSyncError("invalid-argument", "A valid saved product ID is required.");
    }
    if (action === "create" && (typeof data.operationId !== "string"
        || !/^[A-Za-z0-9_-]{1,150}$/.test(data.operationId))) {
        throw new StripePriceSyncError("invalid-argument", "Preview Stripe sync before creating prices.");
    }
}

function relevantProductSnapshot(product) {
    return {
        id: product?.id,
        title: product?.title,
        options: Array.isArray(product?.prints?.options)
            ? product.prints.options.map((option) => ({
                id: option?.id,
                label: option?.label,
                amountCents: option?.amountCents,
                currency: option?.currency,
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
    return { stripeProductId: product.id };
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

async function findRecoverableStripeProduct(stripe, firestoreProductId) {
    let response;
    try {
        response = await stripe.products.search({
            query: `metadata['source']:'likwit_admin_price_sync' AND metadata['firestore_product_id']:'${firestoreProductId}'`,
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
    const productIds = new Set();
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
                    productIds.add(productId);
                    items.push({ ...item, status: "existing", stripePriceId: price.id, stripeProductId: productId, message: "Existing Stripe Price matches Firestore." });
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
                productIds.add(productId);
                items.push({ ...item, status: "recoverable", stripePriceId: price.id, stripeProductId: productId, message: "A matching Stripe Price can be attached without creating another." });
            }
        } catch (error) {
            if (error instanceof StripePriceSyncError) throw error;
            throw new StripePriceSyncError("unavailable", `Stripe preview failed for ${option.id}: ${error?.code || "request_failed"}.`);
        }
    }

    if (productIds.size > 1) {
        for (const item of items) {
            if (item.status !== "invalid") {
                item.status = "conflict";
                item.message = "Saved or recoverable prices point to different Stripe Products; resolve them before syncing.";
            }
        }
    }

    return {
        fingerprint: productFingerprint(product),
        stripeProductId: productIds.size === 1 ? [...productIds][0] : null,
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
        stripeProductId: inspection.stripeProductId,
        plan: inspection.items,
        previewSummary: inspection.summary,
    };
    const operationId = await store.createOperation(record);
    return {
        operationId,
        productId,
        status: record.status,
        stripeProductId: record.stripeProductId,
        items: record.plan,
        summary: record.previewSummary,
    };
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

async function createMissingStripePrices({ productId, operationId, requestedBy, stripe, store }) {
    const operation = await store.getOperation(operationId);
    if (!operation || operation.type !== OPERATION_TYPE || operation.productId !== productId) {
        throw new StripePriceSyncError("not-found", "The Stripe sync preview operation was not found.");
    }
    if (operation.requestedBy !== requestedBy) {
        throw new StripePriceSyncError("permission-denied", "This Stripe sync preview belongs to another admin session.");
    }
    if (operation.status === "completed" && operation.response) return operation.response;

    const product = await store.getProduct(productId);
    if (!product) throw new StripePriceSyncError("not-found", "The saved product was not found.");
    if (productFingerprint(product) !== operation.fingerprint) {
        await store.updateOperation(operationId, { status: "stale", message: "Product pricing changed after preview." });
        throw new StripePriceSyncError("failed-precondition", "Product pricing changed after preview. Preview Stripe sync again.");
    }

    await store.updateOperation(operationId, { status: "running" });
    const currentOptions = new Map(product.prints.options.map((option) => [option.id, option]));
    const expectedMappingOptions = mappingOptionSnapshot(product);
    const results = [];
    const pending = [];
    const productIds = new Set();

    for (const item of operation.plan) {
        if (["invalid", "conflict"].includes(item.status)) {
            results.push({ ...item, status: "skipped", message: item.message });
            continue;
        }
        const current = currentOptions.get(item.optionId);
        if (!current) {
            results.push({ ...item, status: "conflict", message: "The print option no longer exists." });
            continue;
        }
        const currentPriceId = typeof current.stripePriceId === "string" && current.stripePriceId.trim()
            ? current.stripePriceId.trim()
            : null;
        if (!currentPriceId) {
            pending.push(item);
            continue;
        }
        try {
            const price = await stripe.prices.retrieve(currentPriceId);
            const inspection = await inspectStripePrice(price, current, product.id, stripe);
            if (inspection.conflict) results.push({ ...item, status: "conflict", stripePriceId: currentPriceId, message: inspection.conflict });
            else {
                productIds.add(inspection.stripeProductId);
                results.push({ ...item, status: "existing", stripePriceId: currentPriceId, stripeProductId: inspection.stripeProductId, message: "Existing Stripe Price ID was preserved." });
            }
        } catch (error) {
            if (error instanceof StripePriceSyncError || isTransientStripeError(error)) {
                results.push({ ...item, status: "failed", stripePriceId: currentPriceId, message: "Stripe verification is temporarily unavailable. Retry this operation.", errorCode: error?.code || null });
            } else {
                results.push({ ...item, status: "conflict", stripePriceId: currentPriceId, message: "The existing Stripe Price ID could not be verified.", errorCode: error?.code || null });
            }
        }
    }

    const savedPriceVerificationFailed = results.some((result) => result.status === "failed");
    if (savedPriceVerificationFailed) {
        for (const item of pending) {
            results.push({
                ...item,
                status: "failed",
                message: "A saved Stripe Price could not be verified, so no Stripe objects were created. Retry this operation.",
            });
        }
        pending.length = 0;
        productIds.clear();
    } else {
        const verifiedPending = [];
        for (const item of pending) {
            try {
                const matches = await listPricesByLookupKey(stripe, item.lookupKey);
                if (matches.length > 1) {
                    results.push({ ...item, status: "conflict", message: "Multiple Stripe Prices use this sync lookup key." });
                    continue;
                }
                if (matches.length === 1) {
                    const inspection = await inspectStripePrice(matches[0], item, product.id, stripe);
                    if (inspection.conflict) {
                        results.push({ ...item, status: "conflict", stripePriceId: matches[0].id, message: inspection.conflict });
                        continue;
                    }
                    productIds.add(inspection.stripeProductId);
                }
                verifiedPending.push(item);
            } catch (error) {
                const temporary = error instanceof StripePriceSyncError || isTransientStripeError(error);
                results.push({
                    ...item,
                    status: temporary ? "failed" : "conflict",
                    message: temporary
                        ? "Stripe verification is temporarily unavailable. Retry this operation."
                        : "The matching Stripe Price could not be verified.",
                    errorCode: error?.code || null,
                });
            }
        }
        if (results.some((result) => result.status === "failed")) {
            for (const item of verifiedPending) {
                results.push({
                    ...item,
                    status: "failed",
                    message: "Another Stripe Price lookup could not be verified, so no Stripe objects were created. Retry this operation.",
                });
            }
            pending.length = 0;
            productIds.clear();
        } else {
            pending.splice(0, pending.length, ...verifiedPending);
        }
    }

    let targetProductId = productIds.size === 1 ? [...productIds][0] : null;
    if (productIds.size > 1) {
        for (const result of results) {
            if (result.status === "existing") {
                result.status = "conflict";
                result.message = "Existing prices point to different Stripe Products.";
            }
        }
        for (const item of pending) {
            results.push({ ...item, status: "conflict", message: "Existing prices point to different Stripe Products." });
        }
        pending.length = 0;
    }

    if (pending.length || targetProductId) {
        const mapping = await store.claimProductMapping(productId, operationId, targetProductId, expectedMappingOptions);
        if (mapping.status === "conflict") {
            for (const result of results) {
                if (result.status === "existing") {
                    result.status = "conflict";
                    result.message = "Existing prices do not match the canonical Stripe Product mapping.";
                }
            }
            for (const item of pending) {
                results.push({ ...item, status: "conflict", message: "A different canonical Stripe Product is already mapped." });
            }
            pending.length = 0;
            targetProductId = mapping.stripeProductId || null;
        } else if (mapping.status === "busy") {
            for (const result of results) {
                if (result.status === "existing") {
                    result.status = "failed";
                    result.message = "Another Stripe sync is establishing the canonical Product. Retry this operation.";
                }
            }
            for (const item of pending) {
                results.push({ ...item, status: "failed", message: "Another Stripe sync is creating this product. Retry this operation." });
            }
            pending.length = 0;
            targetProductId = null;
        } else if (mapping.status === "stale") {
            for (const result of results) {
                if (result.status === "existing") {
                    result.status = "conflict";
                    result.message = "Product print options changed during Stripe sync.";
                }
            }
            for (const item of pending) {
                results.push({ ...item, status: "conflict", message: "Product print options changed during Stripe sync." });
            }
            pending.length = 0;
            targetProductId = null;
        } else if (mapping.status === "mapped") {
            targetProductId = mapping.stripeProductId;
            const mappedProduct = await inspectStripeProduct(targetProductId, product.id, stripe);
            if (mappedProduct.conflict) {
                for (const item of pending) {
                    results.push({ ...item, status: "conflict", message: mappedProduct.conflict });
                }
                pending.length = 0;
            }
        } else if (mapping.status === "claimed") {
            try {
                const recoverable = await findRecoverableStripeProduct(stripe, product.id);
                if (recoverable.conflict) {
                    await store.releaseProductClaim(productId, operationId);
                    for (const item of pending) {
                        results.push({ ...item, status: "conflict", message: recoverable.conflict });
                    }
                    pending.length = 0;
                    targetProductId = null;
                } else {
                    let productInspection = recoverable;
                    if (!productInspection.stripeProductId) {
                        const stripeProduct = await stripe.products.create(
                            {
                                name: product.title,
                                active: true,
                                metadata: { source: "likwit_admin_price_sync", firestore_product_id: product.id },
                            },
                            { idempotencyKey: stableProductIdempotencyKey(product.id) }
                        );
                        productInspection = await inspectStripeProduct(stripeProduct, product.id, stripe);
                    }
                    if (productInspection.conflict) throw new Error(productInspection.conflict);
                    const finalized = await store.finalizeProductMapping(
                        productId,
                        operationId,
                        productInspection.stripeProductId,
                        expectedMappingOptions
                    );
                    if (finalized.status === "stale") {
                        await store.releaseProductClaim(productId, operationId);
                        for (const result of results) {
                            if (result.status === "existing") {
                                result.status = "conflict";
                                result.message = "Product print options changed during Stripe sync.";
                            }
                        }
                        for (const item of pending) {
                            results.push({ ...item, status: "conflict", message: "Product print options changed during Stripe sync." });
                        }
                        pending.length = 0;
                        targetProductId = null;
                    } else if (finalized.status !== "mapped" || finalized.stripeProductId !== productInspection.stripeProductId) {
                        throw new Error("The canonical Stripe Product mapping changed during creation.");
                    } else {
                        targetProductId = finalized.stripeProductId;
                        await store.updateOperation(operationId, { stripeProductId: targetProductId, results });
                    }
                }
            } catch (error) {
                await store.releaseProductClaim(productId, operationId);
                for (const item of pending) {
                    results.push({ ...item, status: "failed", message: "Stripe Product creation or mapping failed. Retry this operation.", errorCode: error?.code || null });
                }
                pending.length = 0;
            }
        }
    }

    for (const item of pending) {
        try {
            const matches = await listPricesByLookupKey(stripe, item.lookupKey);
            let price = matches.length === 1 ? matches[0] : null;
            if (matches.length > 1) {
                results.push({ ...item, status: "conflict", message: "Multiple Stripe Prices use this sync lookup key." });
                await store.updateOperation(operationId, { status: "running", stripeProductId: targetProductId, results });
                continue;
            }
            if (price) {
                const inspection = await inspectStripePrice(price, item, product.id, stripe);
                if (inspection.conflict || inspection.stripeProductId !== targetProductId) {
                    results.push({ ...item, status: "conflict", stripePriceId: price.id, message: inspection.conflict || "The recovered Stripe Price belongs to another Product." });
                    await store.updateOperation(operationId, { status: "running", stripeProductId: targetProductId, results });
                    continue;
                }
            } else {
                price = await stripe.prices.create(
                    priceCreateParams(product, item, targetProductId),
                    { idempotencyKey: `likwit-admin-price-sync:${operationId}:${item.optionId}` }
                );
            }

            const attached = await store.attachPriceId(productId, item, price.id);
            if (attached.status === "conflict") {
                results.push({ ...item, status: "conflict", stripePriceId: attached.stripePriceId || price.id, message: attached.message });
            } else if (attached.status === "unchanged") {
                results.push({ ...item, status: "existing", stripePriceId: price.id, message: "The Stripe Price ID was already attached by another operation." });
            } else {
                results.push({
                    ...item,
                    status: matches.length ? "attached" : "created",
                    stripePriceId: price.id,
                    message: matches.length ? "Matching Stripe Price attached." : "Stripe Price created and attached.",
                });
            }
        } catch (error) {
            const temporary = error instanceof StripePriceSyncError || isTransientStripeError(error);
            results.push({
                ...item,
                status: "failed",
                message: temporary
                    ? "Stripe verification is temporarily unavailable. Retry this operation."
                    : "Stripe Price creation or attachment failed. Retry this operation.",
                errorCode: error?.code || null,
            });
        }
        await store.updateOperation(operationId, { status: "running", stripeProductId: targetProductId, results });
    }

    const summary = executionSummary(results);
    const status = summary.failed > 0
        ? "partial_failure"
        : summary.conflicts > 0 || summary.skipped > 0
            ? "completed_with_conflicts"
            : "completed";
    const response = { operationId, productId, status, stripeProductId: targetProductId, results, summary };
    await store.updateOperation(operationId, { status, stripeProductId: targetProductId, results, summary, response });
    return response;
}

async function handleAdminStripePrintPriceSync(request, { getStripe, store }) {
    const requestedBy = requireAdminUid(request?.auth);
    validateHandlerInput(request?.data);
    const stripe = getStripe();
    if (request.data.action === "preview") {
        return previewStripePrintPriceSync({ productId: request.data.productId, requestedBy, stripe, store });
    }
    return createMissingStripePrices({
        productId: request.data.productId,
        operationId: request.data.operationId,
        requestedBy,
        stripe,
        store,
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
        async attachPriceId(productId, expectedOption, newStripePriceId) {
            const productRef = products.doc(productId);
            return firestore.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(productRef);
                if (!snapshot.exists) {
                    return { status: "conflict", message: "The product no longer exists." };
                }
                const product = snapshot.data();
                const options = Array.isArray(product.prints?.options)
                    ? product.prints.options.map((option) => ({ ...option }))
                    : [];
                const optionIndex = options.findIndex((option) => option.id === expectedOption.optionId);
                if (optionIndex < 0) {
                    return { status: "conflict", message: "The print option no longer exists." };
                }
                const latestOption = options[optionIndex];
                if (latestOption.label !== expectedOption.label
                    || latestOption.amountCents !== expectedOption.amountCents
                    || latestOption.currency !== expectedOption.currency) {
                    return { status: "conflict", message: "The print option changed after preview." };
                }
                const currentStripePriceId = typeof options[optionIndex].stripePriceId === "string"
                    ? options[optionIndex].stripePriceId.trim()
                    : "";
                if (currentStripePriceId && currentStripePriceId !== newStripePriceId) {
                    return {
                        status: "conflict",
                        stripePriceId: currentStripePriceId,
                        message: "A different Stripe Price ID is already saved.",
                    };
                }
                if (currentStripePriceId === newStripePriceId) {
                    return { status: "unchanged", stripePriceId: newStripePriceId };
                }
                options[optionIndex].stripePriceId = newStripePriceId;
                transaction.update(productRef, {
                    "prints.options": options,
                    updatedAt: serverTimestamp(),
                });
                return { status: "attached", stripePriceId: newStripePriceId };
            });
        },
    };
}

module.exports = {
    OPERATION_TYPE,
    STANDARD_PRINT_PRICES,
    StripePriceSyncError,
    createMissingStripePrices,
    createFirestoreStripeSyncStore,
    handleAdminStripePrintPriceSync,
    lookupKeyFor,
    previewStripePrintPriceSync,
    productFingerprint,
};

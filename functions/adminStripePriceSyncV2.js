"use strict";
/* global module, require */

const crypto = require("node:crypto");
const { updateCanonicalProductImage } = require("./adminStripePriceSync");

const PRINT_SYNC_V2_SCHEMA_VERSION = 2;
const OPERATION_TYPE = "stripe_print_price_sync_v2";
const OPERATION_TTL_MS = 30 * 60 * 1000;
const MAX_PRINT_OPTIONS = 8;
const OPTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRODUCT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class StripePriceSyncV2Error extends Error {
    constructor(code, message, reasonCode = null) {
        super(message);
        this.name = "StripePriceSyncV2Error";
        this.code = code;
        this.reasonCode = reasonCode;
    }
}

function fail(code, message, reasonCode = null) {
    throw new StripePriceSyncV2Error(code, message, reasonCode);
}

function requireAdminUid(auth) {
    if (!auth?.uid) fail("unauthenticated", "Sign in before editing Stripe print prices.");
    if (auth.token?.admin !== true) fail("permission-denied", "An admin claim is required for Stripe print-price editing.");
    return auth.uid;
}

function requireExactKeys(value, allowed, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        fail("invalid-argument", `${label} must be an object.`);
    }
    const unsupported = Object.keys(value).filter((key) => !allowed.includes(key));
    if (unsupported.length) {
        fail("invalid-argument", `${label} contains unsupported fields: ${unsupported.join(", ")}.`);
    }
}

function normalizeNullablePriceId(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function canonicalPublishedPrints(prints) {
    return {
        available: prints?.available === true,
        defaultOptionId: typeof prints?.defaultOptionId === "string" && prints.defaultOptionId
            ? prints.defaultOptionId
            : null,
        options: Array.isArray(prints?.options)
            ? prints.options.map((option) => ({
                id: option?.id,
                label: option?.label,
                amountCents: option?.amountCents,
                currency: option?.currency,
                stripePriceId: normalizeNullablePriceId(option?.stripePriceId),
                active: option?.active === true,
                sortOrder: option?.sortOrder,
            }))
            : null,
    };
}

function publishedPrintsFingerprint(prints) {
    return crypto.createHash("sha256").update(JSON.stringify(canonicalPublishedPrints(prints))).digest("hex");
}

function proposedPrintsFingerprint(proposedPrints, plannedItems) {
    const currentPriceByOptionId = new Map(
        (plannedItems || []).map((item) => [item.optionId, normalizeNullablePriceId(item.currentStripePriceId)])
    );
    const snapshot = {
        available: proposedPrints.available,
        defaultOptionId: proposedPrints.defaultOptionId,
        options: proposedPrints.options.map((option) => ({
            ...option,
            currentStripePriceId: currentPriceByOptionId.get(option.optionId) || null,
        })),
        removedOptions: (plannedItems || [])
            .filter((item) => item.classification === "REMOVE")
            .map((item) => ({
                optionId: item.optionId,
                currentStripePriceId: normalizeNullablePriceId(item.currentStripePriceId),
            }))
            .sort((left, right) => left.optionId.localeCompare(right.optionId)),
    };
    return crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function normalizePrintProposal(proposedPrints) {
    requireExactKeys(proposedPrints, ["available", "defaultOptionId", "options"], "Proposed prints");
    if (typeof proposedPrints.available !== "boolean") {
        fail("invalid-argument", "Print availability must be true or false.");
    }
    if (proposedPrints.defaultOptionId !== null && typeof proposedPrints.defaultOptionId !== "string") {
        fail("invalid-argument", "Default print option must be a stable option ID or null.");
    }
    if (!Array.isArray(proposedPrints.options) || proposedPrints.options.length > MAX_PRINT_OPTIONS) {
        fail("invalid-argument", `Proposed prints must contain no more than ${MAX_PRINT_OPTIONS} options.`);
    }
    const ids = new Set();
    const options = proposedPrints.options.map((option, index) => {
        requireExactKeys(
            option,
            ["optionId", "label", "amountCents", "currency", "active", "sortOrder"],
            `Print option ${index + 1}`
        );
        const optionId = typeof option.optionId === "string" ? option.optionId.trim() : "";
        const label = typeof option.label === "string" ? option.label.trim() : "";
        const currency = typeof option.currency === "string" ? option.currency.trim().toLowerCase() : "";
        if (!OPTION_ID_PATTERN.test(optionId) || optionId.length > 100) {
            fail("invalid-argument", `Print option ${index + 1} requires a stable lowercase option ID.`);
        }
        if (ids.has(optionId)) fail("invalid-argument", `Print option ID ${optionId} is duplicated.`);
        ids.add(optionId);
        if (!label || label.length > 100) fail("invalid-argument", `Print option ${optionId} requires a label.`);
        if (!Number.isSafeInteger(option.amountCents) || option.amountCents <= 0) {
            fail("invalid-argument", `Print option ${optionId} requires a positive whole-cent amount.`);
        }
        if (currency !== "usd") fail("invalid-argument", `Print option ${optionId} must use USD.`);
        if (typeof option.active !== "boolean") fail("invalid-argument", `Print option ${optionId} active state is invalid.`);
        if (!Number.isSafeInteger(option.sortOrder) || option.sortOrder < 0) {
            fail("invalid-argument", `Print option ${optionId} requires a non-negative sort order.`);
        }
        return { optionId, label, amountCents: option.amountCents, currency, active: option.active, sortOrder: option.sortOrder };
    });
    const activeIds = new Set(options.filter((option) => option.active).map((option) => option.optionId));
    const defaultOptionId = proposedPrints.defaultOptionId?.trim() || null;
    if (proposedPrints.available && (!defaultOptionId || !activeIds.has(defaultOptionId))) {
        fail("failed-precondition", "Prints marked available require an active default option.", "INVALID_DEFAULT_OPTION");
    }
    if (!proposedPrints.available && defaultOptionId !== null) {
        fail("failed-precondition", "Unavailable prints must not have a default option.", "INVALID_DEFAULT_OPTION");
    }
    return { available: proposedPrints.available, defaultOptionId, options };
}

function proposalFromPublishedPrints(prints) {
    const snapshot = canonicalPublishedPrints(prints);
    return {
        available: snapshot.available,
        defaultOptionId: snapshot.defaultOptionId,
        options: (snapshot.options || []).map((option) => ({
            optionId: option.id,
            label: option.label,
            amountCents: option.amountCents,
            currency: option.currency,
            active: option.active,
            sortOrder: option.sortOrder,
        })),
    };
}

function canonicalPrintTerms({ livemode, productId, optionId, amountCents, currency, stripeProductId }) {
    return {
        schemaVersion: PRINT_SYNC_V2_SCHEMA_VERSION,
        livemode: livemode === true,
        productId,
        optionId,
        amountCents,
        currency,
        stripeProductId,
    };
}

function canonicalPrintTermsHash(value) {
    return crypto.createHash("sha256").update(JSON.stringify(canonicalPrintTerms(value))).digest("hex");
}

function readableKeyPart(value, maxLength) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, maxLength) || "item";
}

function versionedPriceLookupKey(terms) {
    const canonical = canonicalPrintTerms(terms);
    return `likwit-print-v2-${readableKeyPart(canonical.productId, 60)}-${readableKeyPart(canonical.optionId, 40)}-${canonicalPrintTermsHash(canonical).slice(0, 24)}`;
}

function versionedPriceIdempotencyKey(terms) {
    return `likwit-admin-print-price-v2:${canonicalPrintTermsHash(terms)}`;
}

function legacyItemStatus(classification) {
    return {
        REUSE_EXISTING_PRICE: "existing",
        ATTACH_EXISTING_PRICE: "recoverable",
        CREATE_NEW_PRICE: "missing",
        DISABLE: "disabled",
        REMOVE: "removed",
        NO_CHANGE: "existing",
        CONFLICT_BLOCKED: "conflict",
    }[classification] || "conflict";
}

function stripeProductId(value) {
    if (typeof value === "string") return value;
    return typeof value?.id === "string" ? value.id : null;
}

function isStripeResourceMissing(error) {
    return error?.code === "resource_missing" || error?.statusCode === 404;
}

function mappingSnapshot(mapping) {
    if (!mapping) return null;
    return {
        schemaVersion: Number.isSafeInteger(mapping.schemaVersion) ? mapping.schemaVersion : 1,
        productId: mapping.productId,
        stripeProductId: mapping.stripeProductId,
        livemode: typeof mapping.livemode === "boolean" ? mapping.livemode : null,
    };
}

async function verifyExclusiveProductMapping({ store, productId, stripeProductId: canonicalProductId }) {
    const mappings = await store.findProductMappingsByStripeProductId(canonicalProductId);
    if (mappings.some((mapping) => mapping.productId !== productId)) {
        fail(
            "failed-precondition",
            "The canonical Stripe Product is mapped to another Firestore product.",
            "STRIPE_PRODUCT_MISMATCH"
        );
    }
}

async function verifyCanonicalProduct({ productValue, productId, expectedProductId, expectedLivemode, stripe }) {
    let product = productValue;
    if (typeof productValue === "string") {
        try {
            product = await stripe.products.retrieve(productValue);
        } catch (error) {
            if (!isStripeResourceMissing(error)) {
                fail("unavailable", "Stripe Product verification is temporarily unavailable.", "STRIPE_PRODUCT_UNAVAILABLE");
            }
            fail("failed-precondition", "The canonical Stripe Product could not be verified.", "STRIPE_PRODUCT_INVALID");
        }
    }
    if (!product || typeof product.id !== "string" || product.deleted === true || product.active !== true) {
        fail("failed-precondition", "The canonical Stripe Product is invalid or inactive.", "STRIPE_PRODUCT_INVALID");
    }
    if (product.livemode !== expectedLivemode) {
        fail("failed-precondition", "The canonical Stripe Product is in the wrong Stripe mode.", "STRIPE_LIVEMODE_MISMATCH");
    }
    if (expectedProductId && product.id !== expectedProductId) {
        fail("failed-precondition", "The canonical Stripe Product mapping changed.", "STRIPE_PRODUCT_MISMATCH");
    }
    const associatedProductId = product.metadata?.firestore_product_id;
    if (associatedProductId && associatedProductId !== productId) {
        fail("failed-precondition", "The canonical Stripe Product belongs to another Firestore product.", "STRIPE_PRODUCT_MISMATCH");
    }
    return product;
}

function priceAssociationConflict(price, { productId, optionId, termsHash }) {
    const metadata = price?.metadata || {};
    if (metadata.firestore_product_id && metadata.firestore_product_id !== productId) return true;
    if (metadata.print_option_id && metadata.print_option_id !== optionId) return true;
    if (metadata.terms_hash && metadata.terms_hash !== termsHash) return true;
    return false;
}

function priceConflict(price, { terms, termsHash, allowLegacyCurrent = false }) {
    if (!price || typeof price.id !== "string") return "Stripe returned an invalid Price.";
    if (price.active !== true) return "The matching Stripe Price is inactive.";
    if (price.type !== "one_time") return "The matching Stripe Price is recurring.";
    if (price.unit_amount !== terms.amountCents) return "The Stripe Price amount does not match the proposed amount.";
    if (price.currency !== terms.currency) return "The Stripe Price currency does not match the proposed currency.";
    if (price.livemode !== terms.livemode) return "The Stripe Price is in the wrong Stripe mode.";
    if (stripeProductId(price.product) !== terms.stripeProductId) return "The Stripe Price belongs to another Product.";
    if (!allowLegacyCurrent && priceAssociationConflict(price, {
        productId: terms.productId,
        optionId: terms.optionId,
        termsHash,
    })) return "The Stripe Price metadata does not match the proposed option.";
    return null;
}

function currentPriceAuthorityConflict(price, terms, current) {
    if (!price || typeof price.id !== "string") return "The saved Stripe Price is invalid.";
    if (price.type !== "one_time") return "The saved Stripe Price is recurring.";
    if (price.livemode !== terms.livemode) return "The saved Stripe Price is in the wrong Stripe mode.";
    if (stripeProductId(price.product) !== terms.stripeProductId) return "The saved Stripe Price belongs to another Product.";
    const metadata = price.metadata || {};
    if ((metadata.firestore_product_id && metadata.firestore_product_id !== terms.productId)
        || (metadata.print_option_id && metadata.print_option_id !== terms.optionId)) {
        return "The saved Stripe Price metadata belongs to another product or option.";
    }
    if (metadata.terms_hash) {
        const publishedTermsHash = canonicalPrintTermsHash({
            ...terms,
            amountCents: current.amountCents,
            currency: current.currency,
        });
        if (metadata.terms_hash !== publishedTermsHash) {
            return "The saved Stripe Price metadata does not match its published commercial terms.";
        }
    }
    return null;
}

function legacyPublishedPriceConflict(price, current, productId, expectedLivemode) {
    if (!price || typeof price.id !== "string") return "The saved Stripe Price is invalid.";
    if (price.active !== true) return "The saved Stripe Price is inactive.";
    if (price.type !== "one_time") return "The saved Stripe Price is recurring.";
    if (price.livemode !== expectedLivemode) return "The saved Stripe Price is in the wrong Stripe mode.";
    if (price.unit_amount !== current.amountCents) return "The saved Stripe Price amount does not match Firestore.";
    if (price.currency !== current.currency) return "The saved Stripe Price currency does not match Firestore.";
    const legacyProductId = stripeProductId(price.product);
    if (!legacyProductId) return "The saved Stripe Price has no Product.";
    const metadata = price.metadata || {};
    if ((metadata.firestore_product_id && metadata.firestore_product_id !== productId)
        || (metadata.print_option_id && metadata.print_option_id !== current.id)) {
        return "The saved Stripe Price metadata belongs to another product or option.";
    }
    if (metadata.terms_hash) {
        const expectedHash = canonicalPrintTermsHash({
            livemode: expectedLivemode,
            productId,
            optionId: current.id,
            amountCents: current.amountCents,
            currency: current.currency,
            stripeProductId: legacyProductId,
        });
        if (metadata.terms_hash !== expectedHash) {
            return "The saved Stripe Price metadata does not match its published commercial terms.";
        }
    }
    return null;
}

async function listCanonicalProductPrices(stripe, productId) {
    const prices = [];
    let startingAfter;
    do {
        const response = await stripe.prices.list({
            product: productId,
            limit: 100,
            ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        const page = Array.isArray(response?.data) ? response.data : [];
        prices.push(...page);
        startingAfter = response?.has_more && page.length ? page[page.length - 1].id : null;
    } while (startingAfter);
    return prices;
}

function isAssociatedCandidate(price, terms, termsHash) {
    if (stripeProductId(price?.product) !== terms.stripeProductId) return false;
    if (price?.unit_amount !== terms.amountCents || price?.currency !== terms.currency) return false;
    const metadata = price.metadata || {};
    if (metadata.terms_hash) return metadata.terms_hash === termsHash;
    return metadata.firestore_product_id === terms.productId && metadata.print_option_id === terms.optionId;
}

async function findMatchingPrice({ stripe, terms }) {
    const termsHash = canonicalPrintTermsHash(terms);
    const prices = await listCanonicalProductPrices(stripe, terms.stripeProductId);
    const candidates = prices.filter((price) => isAssociatedCandidate(price, terms, termsHash));
    const valid = [];
    const conflicts = [];
    for (const candidate of candidates) {
        const conflict = priceConflict(candidate, { terms, termsHash });
        if (conflict) conflicts.push({ price: candidate, conflict });
        else valid.push(candidate);
    }
    if (valid.length > 1) return { conflict: "Multiple active Stripe Prices match this commercial tuple." };
    if (valid.length === 1) return { price: valid[0] };
    if (conflicts.length) return { conflict: conflicts[0].conflict };
    return { price: null };
}

function sameProposedFields(current, proposed) {
    return current.id === proposed.optionId
        && current.label === proposed.label
        && current.amountCents === proposed.amountCents
        && current.currency === proposed.currency
        && current.active === proposed.active
        && current.sortOrder === proposed.sortOrder;
}

async function planOption({
    current,
    proposed,
    productId,
    stripeProductId: canonicalProductId,
    currentStripeProductId,
    normalizationRequired = false,
    expectedLivemode,
    stripe,
}) {
    const base = {
        optionId: proposed.optionId,
        label: proposed.label,
        amountCents: proposed.amountCents,
        currency: proposed.currency,
        active: proposed.active,
        sortOrder: proposed.sortOrder,
        currentStripePriceId: normalizeNullablePriceId(current?.stripePriceId),
    };
    const disabling = current?.active === true && proposed.active === false;
    if (disabling) {
        if (current.amountCents !== proposed.amountCents || current.currency !== proposed.currency) {
            return { ...base, classification: "CONFLICT_BLOCKED", message: "Disable and price changes must be applied separately." };
        }
    }
    if (!canonicalProductId) {
        if (disabling) {
            if (normalizationRequired) {
                return {
                    ...base,
                    classification: "DISABLE",
                    priceAction: "CREATE_NEW_PRICE",
                    resolvedStripePriceId: null,
                    message: "The option will be disabled after a verified Price is created under the new canonical Product.",
                };
            }
            return { ...base, classification: "CONFLICT_BLOCKED", resolvedStripePriceId: null, message: "The saved Stripe Price cannot be verified for disable." };
        }
        return { ...base, classification: "CREATE_NEW_PRICE", resolvedStripePriceId: null, message: "A canonical Product and immutable Price will be created." };
    }
    const terms = canonicalPrintTerms({
        livemode: expectedLivemode,
        productId,
        optionId: proposed.optionId,
        amountCents: proposed.amountCents,
        currency: proposed.currency,
        stripeProductId: canonicalProductId,
    });
    const termsHash = canonicalPrintTermsHash(terms);
    const legacyCurrentNeedsNormalization = normalizationRequired
        && base.currentStripePriceId
        && currentStripeProductId !== canonicalProductId;
    if (base.currentStripePriceId && !legacyCurrentNeedsNormalization) {
        try {
            const currentPrice = await stripe.prices.retrieve(base.currentStripePriceId);
            const authorityConflict = currentPriceAuthorityConflict(currentPrice, terms, current);
            if (authorityConflict) {
                return {
                    ...base,
                    classification: "CONFLICT_BLOCKED",
                    resolvedStripePriceId: null,
                    termsHash,
                    message: authorityConflict,
                };
            }
            const conflict = priceConflict(currentPrice, { terms, termsHash, allowLegacyCurrent: true });
            if (!conflict) {
                return {
                    ...base,
                    classification: disabling
                        ? "DISABLE"
                        : current && sameProposedFields(current, proposed)
                            ? "NO_CHANGE"
                            : "REUSE_EXISTING_PRICE",
                    resolvedStripePriceId: currentPrice.id,
                    termsHash,
                    message: disabling
                        ? "The verified option will be disabled without changing Stripe."
                        : current && sameProposedFields(current, proposed)
                            ? "The published Stripe Price and option are unchanged."
                            : "The published Stripe Price matches the proposed commercial terms.",
                };
            }
            if (disabling) {
                return { ...base, classification: "CONFLICT_BLOCKED", resolvedStripePriceId: null, termsHash, message: conflict };
            }
        } catch (error) {
            if (!isStripeResourceMissing(error)) {
                fail("unavailable", "Stripe Price verification is temporarily unavailable.", "STRIPE_PRICE_UNAVAILABLE");
            }
            if (disabling) {
                return { ...base, classification: "CONFLICT_BLOCKED", resolvedStripePriceId: null, termsHash, message: "The saved Stripe Price could not be verified for disable." };
            }
            // A missing legacy reference can still recover through canonical Product discovery.
        }
    }
    if (disabling && !legacyCurrentNeedsNormalization) {
        return { ...base, classification: "CONFLICT_BLOCKED", resolvedStripePriceId: null, termsHash, message: "The saved Stripe Price could not be verified for disable." };
    }
    const match = await findMatchingPrice({ stripe, terms });
    if (match.conflict) {
        return { ...base, classification: "CONFLICT_BLOCKED", resolvedStripePriceId: null, termsHash, message: match.conflict };
    }
    if (disabling && normalizationRequired) {
        return {
            ...base,
            classification: "DISABLE",
            priceAction: match.price ? "ATTACH_EXISTING_PRICE" : "CREATE_NEW_PRICE",
            resolvedStripePriceId: match.price?.id || null,
            termsHash,
            ...(!match.price ? { lookupKey: versionedPriceLookupKey(terms) } : {}),
            message: match.price
                ? "The option will be disabled after an exact matching Price is attached under the canonical Product."
                : "The option will be disabled after a verified Price is created under the canonical Product.",
        };
    }
    if (match.price) {
        return {
            ...base,
            classification: "ATTACH_EXISTING_PRICE",
            resolvedStripePriceId: match.price.id,
            termsHash,
            message: "One active exact matching Stripe Price can be attached.",
        };
    }
    return {
        ...base,
        classification: "CREATE_NEW_PRICE",
        resolvedStripePriceId: null,
        termsHash,
        lookupKey: versionedPriceLookupKey(terms),
        message: "A new immutable one-time Stripe Price will be created.",
    };
}

async function resolvePreviewCanonicalProduct({ product, mapping, stripe, store, expectedLivemode, nowMs }) {
    let mappedStripeProduct = null;
    let mappedSnapshot = null;
    if (mapping?.stripeProductId) {
        if (mapping.productId !== product.id || typeof mapping.stripeProductId !== "string") {
            fail("failed-precondition", "The canonical Stripe Product mapping is invalid.", "STRIPE_PRODUCT_MISMATCH");
        }
        if (typeof mapping.livemode === "boolean" && mapping.livemode !== expectedLivemode) {
            fail("failed-precondition", "The canonical mapping is in the wrong Stripe mode.", "STRIPE_LIVEMODE_MISMATCH");
        }
        mappedStripeProduct = await verifyCanonicalProduct({
            productValue: mapping.stripeProductId,
            productId: product.id,
            expectedProductId: mapping.stripeProductId,
            expectedLivemode,
            stripe,
        });
        await verifyExclusiveProductMapping({ store, productId: product.id, stripeProductId: mappedStripeProduct.id });
        mappedSnapshot = mappingSnapshot(mapping);
    }
    if (mapping && !mapping?.stripeProductId) {
        if ((mapping.productId && mapping.productId !== product.id)
            || (typeof mapping.livemode === "boolean" && mapping.livemode !== expectedLivemode)) {
            fail("failed-precondition", "The canonical Stripe Product mapping is invalid.", "STRIPE_PRODUCT_MISMATCH");
        }
        if (mapping.claimOperationId && Number(mapping.claimExpiresAtMs) > nowMs) {
            fail("failed-precondition", "Another operation is establishing the canonical Stripe Product.", "MAPPING_BUSY");
        }
    }
    const productIds = new Set();
    const currentStripeProductIdsByOption = {};
    const legacyConflicts = [];
    for (const option of product.prints?.options || []) {
        const priceId = normalizeNullablePriceId(option.stripePriceId);
        if (!priceId) continue;
        try {
            const price = await stripe.prices.retrieve(priceId);
            const legacyProductId = stripeProductId(price.product);
            if (legacyProductId) {
                productIds.add(legacyProductId);
                currentStripeProductIdsByOption[option.id] = legacyProductId;
            }
            const conflict = legacyPublishedPriceConflict(price, option, product.id, expectedLivemode);
            if (conflict) legacyConflicts.push({ optionId: option.id, message: conflict });
        } catch (error) {
            if (!isStripeResourceMissing(error)) {
                fail("unavailable", "Stripe Price verification is temporarily unavailable.", "STRIPE_PRICE_UNAVAILABLE");
            }
            legacyConflicts.push({ optionId: option.id, message: "The saved Stripe Price could not be verified." });
        }
    }
    const legacyStripeProductIds = mappedStripeProduct
        ? [...productIds].filter((productId) => productId !== mappedStripeProduct.id)
        : [...productIds];
    const normalizationRequired = productIds.size > 1;
    if (normalizationRequired) {
        if (legacyConflicts.length) {
            fail(
                "failed-precondition",
                `Saved legacy Stripe Price ${legacyConflicts[0].optionId} cannot be normalized: ${legacyConflicts[0].message}`,
                "LEGACY_PRICE_INVALID"
            );
        }
        for (const legacyProductId of legacyStripeProductIds) {
            await verifyCanonicalProduct({
                productValue: legacyProductId,
                productId: product.id,
                expectedProductId: legacyProductId,
                expectedLivemode,
                stripe,
            });
            await verifyExclusiveProductMapping({ store, productId: product.id, stripeProductId: legacyProductId });
        }
        return {
            stripeProduct: mappedStripeProduct,
            mapping: mappedSnapshot,
            normalizationRequired: true,
            legacyStripeProductIds,
            currentStripeProductIdsByOption,
        };
    }
    if (mappedStripeProduct) {
        return {
            stripeProduct: mappedStripeProduct,
            mapping: mappedSnapshot,
            normalizationRequired: false,
            legacyStripeProductIds: [],
            currentStripeProductIdsByOption,
        };
    }
    if (productIds.size === 1) {
        const productId = [...productIds][0];
        const stripeProduct = await verifyCanonicalProduct({
            productValue: productId,
            productId: product.id,
            expectedProductId: productId,
            expectedLivemode,
            stripe,
        });
        await verifyExclusiveProductMapping({ store, productId: product.id, stripeProductId: stripeProduct.id });
        return {
            stripeProduct,
            mapping: null,
            normalizationRequired: false,
            legacyStripeProductIds: [],
            currentStripeProductIdsByOption,
        };
    }
    return {
        stripeProduct: null,
        mapping: null,
        normalizationRequired: false,
        legacyStripeProductIds: [],
        currentStripeProductIdsByOption,
    };
}

async function previewStripePrintPriceSyncV2({
    productId,
    proposedPrints,
    requestedBy,
    stripe,
    store,
    expectedLivemode,
    nowMs = Date.now(),
}) {
    if (!PRODUCT_ID_PATTERN.test(productId || "")) fail("invalid-argument", "A valid saved product ID is required.");
    if (typeof expectedLivemode !== "boolean") fail("failed-precondition", "Stripe mode is not configured.");
    const product = await store.getProduct(productId);
    if (!product) fail("not-found", "The saved product was not found.");
    const proposed = normalizePrintProposal(proposedPrints || proposalFromPublishedPrints(product.prints));
    const mapping = await store.getProductMapping(productId);
    const canonical = await resolvePreviewCanonicalProduct({ product, mapping, stripe, store, expectedLivemode, nowMs });
    const currentById = new Map((product.prints?.options || []).map((option) => [option.id, option]));
    const proposedById = new Map(proposed.options.map((option) => [option.optionId, option]));
    const items = [];
    for (const proposedOption of proposed.options) {
        items.push(await planOption({
            current: currentById.get(proposedOption.optionId) || null,
            proposed: proposedOption,
            productId,
            stripeProductId: canonical.stripeProduct?.id || null,
            currentStripeProductId: canonical.currentStripeProductIdsByOption?.[proposedOption.optionId] || null,
            normalizationRequired: canonical.normalizationRequired,
            expectedLivemode,
            stripe,
        }));
    }
    for (const currentOption of product.prints?.options || []) {
        if (!proposedById.has(currentOption.id)) {
            items.push({
                optionId: currentOption.id,
                label: currentOption.label,
                classification: "REMOVE",
                currentStripePriceId: normalizeNullablePriceId(currentOption.stripePriceId),
                message: "The option will be removed from Firestore; its Stripe Price will remain untouched.",
            });
        }
    }
    const baseFingerprint = publishedPrintsFingerprint(product.prints);
    const blocked = items.some((item) => item.classification === "CONFLICT_BLOCKED");
    const record = {
        schemaVersion: PRINT_SYNC_V2_SCHEMA_VERSION,
        type: OPERATION_TYPE,
        status: "previewed",
        productId,
        requestedBy,
        expectedLivemode,
        basePrints: canonicalPublishedPrints(product.prints),
        baseFingerprint,
        proposedPrints: proposed,
        proposedFingerprint: proposedPrintsFingerprint(proposed, items),
        mapping: canonical.mapping,
        stripeProductId: canonical.stripeProduct?.id || null,
        normalizationRequired: canonical.normalizationRequired,
        canonicalStripeProductId: canonical.stripeProduct?.id || null,
        legacyStripeProductIds: canonical.legacyStripeProductIds,
        items,
        canApply: !blocked,
        expiresAtMs: nowMs + OPERATION_TTL_MS,
    };
    const operationId = await store.createOperation(record);
    return {
        schemaVersion: PRINT_SYNC_V2_SCHEMA_VERSION,
        operationId,
        productId,
        status: "confirmed",
        canApply: record.canApply,
        canConfirm: false,
        stripeProductId: record.stripeProductId,
        normalizationRequired: record.normalizationRequired,
        canonicalStripeProductId: record.canonicalStripeProductId,
        legacyStripeProductIds: record.legacyStripeProductIds,
        items: items.map((item) => ({ ...item, status: legacyItemStatus(item.classification) })),
    };
}

function priceCreateParams(product, item, terms) {
    const termsHash = canonicalPrintTermsHash(terms);
    return {
        active: true,
        currency: terms.currency,
        unit_amount: terms.amountCents,
        product: terms.stripeProductId,
        lookup_key: versionedPriceLookupKey(terms),
        nickname: `${product.title} - ${item.label}`.slice(0, 250),
        metadata: {
            source: "likwit_admin_price_sync",
            schema_version: String(PRINT_SYNC_V2_SCHEMA_VERSION),
            firestore_product_id: terms.productId,
            print_option_id: terms.optionId,
            terms_hash: termsHash,
            amount_cents: String(terms.amountCents),
            currency: terms.currency,
        },
    };
}

async function ensureCanonicalProduct({ product, operation, stripe, store, expectedLivemode }) {
    if (operation.stripeProductId) {
        let mapping = await store.getProductMapping(product.id);
        if (!mapping?.stripeProductId) {
            const claim = await store.claimProductMapping({
                productId: product.id,
                operationId: operation.id,
                expectedBaseFingerprint: operation.baseFingerprint,
                livemode: expectedLivemode,
            });
            if (claim.status === "stale") fail("failed-precondition", "Published print options changed. Preview again.", "PRINTS_CHANGED");
            if (claim.status === "busy" || claim.status === "conflict") {
                fail("failed-precondition", "Another operation is establishing the canonical Stripe Product. Preview again.", "MAPPING_CHANGED");
            }
            mapping = claim.status === "mapped" ? claim : await store.getProductMapping(product.id);
        }
        if (mapping?.stripeProductId && mapping.stripeProductId !== operation.stripeProductId) {
            fail("failed-precondition", "The canonical Stripe Product mapping changed. Preview again.", "MAPPING_CHANGED");
        }
        const stripeProduct = await verifyCanonicalProduct({
            productValue: operation.stripeProductId,
            productId: product.id,
            expectedProductId: operation.stripeProductId,
            expectedLivemode,
            stripe,
        });
        await verifyExclusiveProductMapping({ store, productId: product.id, stripeProductId: stripeProduct.id });
        const finalized = await store.finalizeProductMapping({
            productId: product.id,
            operationId: operation.id,
            stripeProductId: stripeProduct.id,
            livemode: expectedLivemode,
            expectedBaseFingerprint: operation.baseFingerprint,
        });
        if (finalized.status !== "mapped") {
            fail("failed-precondition", "The canonical mapping changed. Preview again.", "MAPPING_CHANGED");
        }
        return { stripeProduct, mapping: mappingSnapshot(finalized) };
    }
    const claim = await store.claimProductMapping({
        productId: product.id,
        operationId: operation.id,
        expectedBaseFingerprint: operation.baseFingerprint,
        livemode: expectedLivemode,
    });
    if (claim.status === "stale") fail("failed-precondition", "Published print options changed. Preview again.", "PRINTS_CHANGED");
    if (claim.status === "busy" || claim.status === "conflict") {
        fail("failed-precondition", "Another operation is establishing the canonical Stripe Product. Preview again.", "MAPPING_CHANGED");
    }
    if (claim.status === "mapped") {
        const stripeProduct = await verifyCanonicalProduct({
            productValue: claim.stripeProductId,
            productId: product.id,
            expectedProductId: claim.stripeProductId,
            expectedLivemode,
            stripe,
        });
        await verifyExclusiveProductMapping({ store, productId: product.id, stripeProductId: stripeProduct.id });
        return { stripeProduct, mapping: mappingSnapshot({ ...claim, livemode: expectedLivemode }) };
    }
    let matches = [];
    try {
        const response = await stripe.products.search({
            query: `metadata['source']:'likwit_admin_price_sync' AND metadata['firestore_product_id']:'${product.id}' AND metadata['canonical_product']:'true'`,
            limit: 3,
        });
        matches = response.data || [];
    } catch {
        fail("unavailable", "Stripe Product recovery is temporarily unavailable.");
    }
    if (matches.length > 1) fail("failed-precondition", "Multiple canonical Stripe Products match this product.", "MULTIPLE_STRIPE_PRODUCTS");
    let stripeProduct = matches[0] || null;
    if (!stripeProduct) {
        stripeProduct = await stripe.products.create({
            name: product.title,
            active: true,
            metadata: {
                source: "likwit_admin_price_sync",
                firestore_product_id: product.id,
                canonical_product: "true",
                schema_version: String(PRINT_SYNC_V2_SCHEMA_VERSION),
            },
        }, { idempotencyKey: `likwit-admin-print-product-v2:${product.id}:${expectedLivemode ? "live" : "test"}` });
    }
    stripeProduct = await verifyCanonicalProduct({
        productValue: stripeProduct,
        productId: product.id,
        expectedProductId: stripeProduct.id,
        expectedLivemode,
        stripe,
    });
    await verifyExclusiveProductMapping({ store, productId: product.id, stripeProductId: stripeProduct.id });
    const finalized = await store.finalizeProductMapping({
        productId: product.id,
        operationId: operation.id,
        stripeProductId: stripeProduct.id,
        livemode: expectedLivemode,
        expectedBaseFingerprint: operation.baseFingerprint,
    });
    if (finalized.status !== "mapped") fail("failed-precondition", "The canonical mapping changed. Preview again.", "MAPPING_CHANGED");
    return { stripeProduct, mapping: mappingSnapshot(finalized) };
}

async function resolveApplyPrice({ product, item, stripeProduct, stripe, expectedLivemode }) {
    if (item.classification === "REMOVE") {
        return item.resolvedStripePriceId || item.currentStripePriceId || null;
    }
    const terms = canonicalPrintTerms({
        livemode: expectedLivemode,
        productId: product.id,
        optionId: item.optionId,
        amountCents: item.amountCents,
        currency: item.currency,
        stripeProductId: stripeProduct.id,
    });
    const termsHash = canonicalPrintTermsHash(terms);
    const priceAction = item.priceAction || item.classification;
    const plannedPriceId = item.resolvedStripePriceId
        || (priceAction === "CREATE_NEW_PRICE" ? null : item.currentStripePriceId);
    if (plannedPriceId && priceAction !== "CREATE_NEW_PRICE") {
        const price = await stripe.prices.retrieve(plannedPriceId);
        if (item.currentStripePriceId === plannedPriceId
            && price.metadata?.terms_hash
            && price.metadata.terms_hash !== termsHash) {
            fail(
                "failed-precondition",
                "The current Stripe Price commercial metadata changed after preview.",
                "STRIPE_PRICE_CHANGED"
            );
        }
        const conflict = priceConflict(price, { terms, termsHash, allowLegacyCurrent: item.currentStripePriceId === plannedPriceId });
        if (conflict) fail("failed-precondition", conflict, "STRIPE_PRICE_CHANGED");
        return price.id;
    }
    const match = await findMatchingPrice({ stripe, terms });
    if (match.conflict) fail("failed-precondition", match.conflict, "STRIPE_PRICE_CONFLICT");
    let price = match.price;
    if (!price) {
        price = await stripe.prices.create(
            priceCreateParams(product, item, terms),
            { idempotencyKey: versionedPriceIdempotencyKey(terms) }
        );
    }
    const retrieved = await stripe.prices.retrieve(price.id);
    const conflict = priceConflict(retrieved, { terms, termsHash });
    if (conflict) fail("failed-precondition", conflict, "STRIPE_PRICE_INVALID");
    return retrieved.id;
}

async function applyStripePrintPriceSyncV2({
    productId,
    operationId,
    requestedBy,
    stripe,
    store,
    expectedLivemode,
    resolveProductImageUrl,
    nowMs = Date.now(),
}) {
    const operation = await store.getOperation(operationId);
    if (!operation || operation.productId !== productId) fail("not-found", "The print-price preview was not found.");
    if (operation.schemaVersion !== PRINT_SYNC_V2_SCHEMA_VERSION || operation.type !== OPERATION_TYPE) {
        fail("failed-precondition", "This preview is obsolete. Preview again before applying print changes.", "OBSOLETE_OPERATION");
    }
    if (operation.requestedBy !== requestedBy) fail("permission-denied", "This preview belongs to another admin session.");
    if (operation.status === "completed" && operation.response) return operation.response;
    if (!["previewed", "applying"].includes(operation.status)) {
        fail("failed-precondition", "Preview these print changes again before applying them.");
    }
    if (operation.canApply !== true) fail("failed-precondition", "Resolve blocked print-price conflicts before applying.");
    if (!Number.isSafeInteger(operation.expiresAtMs) || operation.expiresAtMs <= nowMs) {
        fail("failed-precondition", "This preview expired. Preview again before applying print changes.", "OPERATION_EXPIRED");
    }
    if (operation.expectedLivemode !== expectedLivemode) {
        fail("failed-precondition", "Stripe mode changed after preview. Preview again.", "STRIPE_LIVEMODE_MISMATCH");
    }
    const product = await store.getProduct(productId);
    if (!product || publishedPrintsFingerprint(product.prints) !== operation.baseFingerprint) {
        fail("failed-precondition", "Published print options changed after preview. Preview again.", "PRINTS_CHANGED");
    }
    const currentMapping = await store.getProductMapping(productId);
    const mappingWasEstablishedByThisOperation = operation.mapping === null
        && currentMapping
        && currentMapping.productId === productId
        && currentMapping.livemode === expectedLivemode
        && (currentMapping.claimOperationId === operationId
            || currentMapping.establishedByOperationId === operationId);
    const expiredUnmappedClaim = operation.mapping === null
        && currentMapping
        && !currentMapping.stripeProductId
        && (!currentMapping.claimOperationId || Number(currentMapping.claimExpiresAtMs) <= nowMs);
    if (JSON.stringify(mappingSnapshot(currentMapping)) !== JSON.stringify(operation.mapping)
        && !mappingWasEstablishedByThisOperation
        && !expiredUnmappedClaim) {
        fail("failed-precondition", "The canonical Stripe Product mapping changed after preview. Preview again.", "MAPPING_CHANGED");
    }
    if (operation.status === "previewed") await store.updateOperation(operationId, { status: "applying" });
    const applyingOperation = { ...operation, id: operationId, status: "applying" };
    const requiresCanonicalProduct = operation.items.some((item) => item.classification !== "REMOVE");
    const canonical = requiresCanonicalProduct
        ? await ensureCanonicalProduct({
            product,
            operation: applyingOperation,
            stripe,
            store,
            expectedLivemode,
        })
        : { stripeProduct: null, mapping: operation.mapping };
    if (requiresCanonicalProduct) {
        await store.updateOperation(operationId, {
            status: "applying",
            stripeProductId: canonical.stripeProduct.id,
            mapping: canonical.mapping,
        });
    }
    const warnings = requiresCanonicalProduct
        ? await updateCanonicalProductImage({
            product,
            stripe,
            stripeProductId: canonical.stripeProduct.id,
            stripeProductImages: Array.isArray(canonical.stripeProduct.images) ? canonical.stripeProduct.images : [],
            resolveProductImageUrl,
        })
        : [];
    const resolvedByOption = new Map();
    try {
        for (const item of operation.items) {
            if (item.classification === "REMOVE") continue;
            const priceId = await resolveApplyPrice({
                product,
                item,
                stripeProduct: canonical.stripeProduct,
                stripe,
                expectedLivemode,
            });
            if (!priceId) fail("failed-precondition", `Print option ${item.optionId} has no verified Stripe Price.`, "INCOMPLETE_PRICE_SET");
            resolvedByOption.set(item.optionId, priceId);
        }
    } catch (error) {
        await store.updateOperation(operationId, { status: "previewed", lastError: error?.reasonCode || error?.code || "PRICE_RESOLUTION_FAILED" });
        throw error;
    }
    if (resolvedByOption.size !== operation.proposedPrints.options.length) {
        await store.updateOperation(operationId, { status: "previewed", lastError: "INCOMPLETE_PRICE_SET" });
        fail("failed-precondition", "The verified Stripe Price set is incomplete.", "INCOMPLETE_PRICE_SET");
    }
    const prints = {
        available: operation.proposedPrints.available,
        defaultOptionId: operation.proposedPrints.defaultOptionId,
        options: operation.proposedPrints.options.map((option) => ({
            id: option.optionId,
            label: option.label,
            amountCents: option.amountCents,
            currency: option.currency,
            stripePriceId: resolvedByOption.get(option.optionId),
            active: option.active,
            sortOrder: option.sortOrder,
        })),
    };
    const response = {
        schemaVersion: PRINT_SYNC_V2_SCHEMA_VERSION,
        operationId,
        productId,
        status: "completed",
        stripeProductId: canonical.stripeProduct?.id || null,
        warnings,
        items: operation.items.map((item) => ({
            ...item,
            status: legacyItemStatus(item.classification),
            ...(item.classification === "REMOVE" ? {} : { stripePriceId: resolvedByOption.get(item.optionId) }),
        })),
    };
    const publication = await store.publishPrintsAtomically({
        productId,
        operationId,
        requestedBy,
        expiresAtMs: operation.expiresAtMs,
        baseFingerprint: operation.baseFingerprint,
        mapping: canonical.mapping,
        expectedLivemode,
        prints,
        response,
    });
    if (publication.status === "completed" && publication.response) return publication.response;
    if (publication.status !== "updated") {
        fail("failed-precondition", "Published print state changed before publication. Preview again.", publication.reasonCode || "PUBLICATION_CONFLICT");
    }
    return response;
}

function validateHandlerInput(data) {
    requireExactKeys(
        data,
        data?.action === "preview"
            ? ["action", "productId", "proposedPrints"]
            : ["action", "productId", "operationId"],
        "Stripe print-price request"
    );
    if (!["preview", "apply", "create"].includes(data.action)) {
        fail("invalid-argument", "Use preview or apply for print-price changes.");
    }
    if (!PRODUCT_ID_PATTERN.test(data.productId || "")) fail("invalid-argument", "A valid saved product ID is required.");
    if (data.action !== "preview" && (typeof data.operationId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(data.operationId))) {
        fail("invalid-argument", "Preview print-price changes before applying them.");
    }
}

async function handleAdminStripePrintPriceSyncV2(request, { getStripe, store, expectedLivemode, nowMs, resolveProductImageUrl }) {
    const requestedBy = requireAdminUid(request?.auth);
    validateHandlerInput(request?.data);
    const stripe = getStripe();
    if (request.data.action === "preview") {
        return previewStripePrintPriceSyncV2({
            productId: request.data.productId,
            proposedPrints: request.data.proposedPrints,
            requestedBy,
            stripe,
            store,
            expectedLivemode,
            nowMs,
        });
    }
    return applyStripePrintPriceSyncV2({
        productId: request.data.productId,
        operationId: request.data.operationId,
        requestedBy,
        stripe,
        store,
        expectedLivemode,
        nowMs,
        resolveProductImageUrl,
    });
}

function proposedPrintsMatchPublished(proposed, published) {
    if (!proposed || !published || proposed.available !== published.available
        || proposed.defaultOptionId !== published.defaultOptionId
        || !Array.isArray(proposed.options)
        || !Array.isArray(published.options)
        || proposed.options.length !== published.options.length) return false;
    return proposed.options.every((option, index) => {
        const resolved = published.options[index];
        return resolved
            && option.optionId === resolved.id
            && option.label === resolved.label
            && option.amountCents === resolved.amountCents
            && option.currency === resolved.currency
            && option.active === resolved.active
            && option.sortOrder === resolved.sortOrder
            && typeof resolved.stripePriceId === "string"
            && resolved.stripePriceId.length > 0;
    });
}

function createFirestoreStripePriceSyncV2Store({ firestore, serverTimestamp, now = Date.now }) {
    const products = firestore.collection("shopProducts");
    const mappings = firestore.collection("adminStripePrintProductMappings");
    const operations = firestore.collection("adminStripePriceSyncOperations");
    return {
        async getProduct(productId) {
            const snapshot = await products.doc(productId).get();
            return snapshot.exists ? { ...snapshot.data(), id: snapshot.id || productId } : null;
        },
        async getProductMapping(productId) {
            const snapshot = await mappings.doc(productId).get();
            return snapshot.exists ? snapshot.data() : null;
        },
        async findProductMappingsByStripeProductId(canonicalProductId) {
            const snapshot = await mappings
                .where("stripeProductId", "==", canonicalProductId)
                .limit(3)
                .get();
            return snapshot.docs.map((document) => ({
                ...document.data(),
                productId: document.data().productId || document.id,
            }));
        },
        async createOperation(record) {
            const reference = operations.doc();
            const timestamp = serverTimestamp();
            await reference.set({ ...record, createdAt: timestamp, updatedAt: timestamp });
            return reference.id;
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
        async claimProductMapping({ productId, operationId, expectedBaseFingerprint, livemode }) {
            const productReference = products.doc(productId);
            const mappingReference = mappings.doc(productId);
            return firestore.runTransaction(async (transaction) => {
                const productSnapshot = await transaction.get(productReference);
                const mappingDocument = await transaction.get(mappingReference);
                if (!productSnapshot.exists
                    || publishedPrintsFingerprint(productSnapshot.data().prints) !== expectedBaseFingerprint) {
                    return { status: "stale" };
                }
                const mapping = mappingDocument.exists ? mappingDocument.data() : {};
                if (mapping.stripeProductId) {
                    if (mapping.productId && mapping.productId !== productId) return { status: "conflict" };
                    if (typeof mapping.livemode === "boolean" && mapping.livemode !== livemode) return { status: "conflict" };
                    if (mapping.schemaVersion !== PRINT_SYNC_V2_SCHEMA_VERSION || typeof mapping.livemode !== "boolean") {
                        transaction.set(mappingReference, {
                            schemaVersion: PRINT_SYNC_V2_SCHEMA_VERSION,
                            productId,
                            stripeProductId: mapping.stripeProductId,
                            livemode,
                            updatedAt: serverTimestamp(),
                        }, { merge: true });
                    }
                    return {
                        status: "mapped",
                        schemaVersion: PRINT_SYNC_V2_SCHEMA_VERSION,
                        productId,
                        stripeProductId: mapping.stripeProductId,
                        livemode,
                    };
                }
                if (mapping.claimOperationId
                    && mapping.claimOperationId !== operationId
                    && Number(mapping.claimExpiresAtMs) > now()) {
                    return { status: "busy" };
                }
                transaction.set(mappingReference, {
                    schemaVersion: PRINT_SYNC_V2_SCHEMA_VERSION,
                    productId,
                    livemode,
                    claimOperationId: operationId,
                    claimExpiresAtMs: now() + 5 * 60 * 1000,
                    ...(mappingDocument.exists ? {} : { createdAt: serverTimestamp() }),
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                return { status: "claimed" };
            });
        },
        async finalizeProductMapping({ productId, operationId, stripeProductId: canonicalProductId, livemode, expectedBaseFingerprint }) {
            const productReference = products.doc(productId);
            const mappingReference = mappings.doc(productId);
            return firestore.runTransaction(async (transaction) => {
                const productSnapshot = await transaction.get(productReference);
                const mappingDocument = await transaction.get(mappingReference);
                if (!productSnapshot.exists
                    || publishedPrintsFingerprint(productSnapshot.data().prints) !== expectedBaseFingerprint) {
                    return { status: "stale" };
                }
                const mapping = mappingDocument.exists ? mappingDocument.data() : {};
                if ((mapping.productId && mapping.productId !== productId)
                    || (mapping.stripeProductId && mapping.stripeProductId !== canonicalProductId)
                    || (typeof mapping.livemode === "boolean" && mapping.livemode !== livemode)
                    || (mapping.claimOperationId && mapping.claimOperationId !== operationId)) {
                    return { status: "conflict" };
                }
                const next = {
                    schemaVersion: PRINT_SYNC_V2_SCHEMA_VERSION,
                    productId,
                    stripeProductId: canonicalProductId,
                    livemode,
                    ...(mapping.stripeProductId ? {} : { establishedByOperationId: operationId }),
                    claimOperationId: null,
                    claimExpiresAtMs: 0,
                    ...(mappingDocument.exists ? {} : { createdAt: serverTimestamp() }),
                    updatedAt: serverTimestamp(),
                };
                transaction.set(mappingReference, next, { merge: true });
                return {
                    status: "mapped",
                    schemaVersion: PRINT_SYNC_V2_SCHEMA_VERSION,
                    productId,
                    stripeProductId: canonicalProductId,
                    livemode,
                };
            });
        },
        async publishPrintsAtomically({
            productId,
            operationId,
            requestedBy,
            baseFingerprint,
            mapping: expectedMapping,
            expectedLivemode,
            prints,
            response,
        }) {
            const productReference = products.doc(productId);
            const mappingReference = mappings.doc(productId);
            const operationReference = operations.doc(operationId);
            return firestore.runTransaction(async (transaction) => {
                const productSnapshot = await transaction.get(productReference);
                const mappingDocument = await transaction.get(mappingReference);
                const operationDocument = await transaction.get(operationReference);
                if (!productSnapshot.exists || !operationDocument.exists
                    || (expectedMapping !== null && !mappingDocument.exists)) {
                    return { status: "conflict", reasonCode: "PUBLICATION_STATE_MISSING" };
                }
                const product = productSnapshot.data();
                const mapping = mappingDocument.exists ? mappingDocument.data() : null;
                const operation = operationDocument.data();
                if (operation.status === "completed" && operation.response) {
                    return { status: "completed", response: operation.response };
                }
                if (operation.schemaVersion !== PRINT_SYNC_V2_SCHEMA_VERSION
                    || operation.type !== OPERATION_TYPE
                    || operation.productId !== productId
                    || operation.requestedBy !== requestedBy
                    || operation.status !== "applying") {
                    return { status: "conflict", reasonCode: "OPERATION_STATE_CHANGED" };
                }
                if (!Number.isSafeInteger(operation.expiresAtMs) || operation.expiresAtMs <= now()) {
                    return { status: "conflict", reasonCode: "OPERATION_EXPIRED" };
                }
                if (publishedPrintsFingerprint(product.prints) !== baseFingerprint
                    || operation.baseFingerprint !== baseFingerprint) {
                    return { status: "stale", reasonCode: "PRINTS_CHANGED" };
                }
                if (operation.proposedFingerprint !== proposedPrintsFingerprint(
                    operation.proposedPrints,
                    operation.items
                )) {
                    return { status: "conflict", reasonCode: "PROPOSED_STATE_CHANGED" };
                }
                if (JSON.stringify(mappingSnapshot(mapping)) !== JSON.stringify(expectedMapping)
                    || (expectedMapping !== null && expectedMapping.livemode !== expectedLivemode)) {
                    return { status: "stale", reasonCode: "MAPPING_CHANGED" };
                }
                if (!proposedPrintsMatchPublished(operation.proposedPrints, prints)) {
                    return { status: "conflict", reasonCode: "INCOMPLETE_PRICE_SET" };
                }
                const timestamp = serverTimestamp();
                transaction.update(productReference, { prints, updatedAt: timestamp });
                transaction.update(operationReference, {
                    status: "completed",
                    response,
                    completedAt: timestamp,
                    updatedAt: timestamp,
                });
                return { status: "updated" };
            });
        },
    };
}

module.exports = {
    OPERATION_TYPE,
    PRINT_SYNC_V2_SCHEMA_VERSION,
    StripePriceSyncV2Error,
    applyStripePrintPriceSyncV2,
    canonicalPrintTerms,
    canonicalPrintTermsHash,
    canonicalPublishedPrints,
    createFirestoreStripePriceSyncV2Store,
    handleAdminStripePrintPriceSyncV2,
    normalizePrintProposal,
    previewStripePrintPriceSyncV2,
    proposedPrintsFingerprint,
    proposalFromPublishedPrints,
    publishedPrintsFingerprint,
    versionedPriceIdempotencyKey,
    versionedPriceLookupKey,
};

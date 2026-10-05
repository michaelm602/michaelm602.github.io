"use strict";
/* global module */

const MAX_CART_LINES = 20;
const MAX_ITEM_QUANTITY = 10;
const SUPPORTED_CURRENCY = "usd";
const PRODUCT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STRIPE_PRICE_ID_PATTERN = /^price_[A-Za-z0-9]+$/;
const DEFAULT_SHADOW_TIMEOUT_MS = 1000;

const SHADOW_PARITY_STATUS = Object.freeze({
    MATCH: "MATCH",
    FIRESTORE_DENIED: "FIRESTORE_DENIED",
    LEGACY_DENIED: "LEGACY_DENIED",
    PRICE_ID_MISMATCH: "PRICE_ID_MISMATCH",
    AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
    CURRENCY_MISMATCH: "CURRENCY_MISMATCH",
    PRODUCT_MISMATCH: "PRODUCT_MISMATCH",
    OPTION_MISMATCH: "OPTION_MISMATCH",
    ERROR: "ERROR",
});

class CheckoutShadowError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "CheckoutShadowError";
        this.code = code;
    }
}

function deny(code, message) {
    throw new CheckoutShadowError(code, message);
}

function exactLineItemShape(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const keys = Object.keys(item).sort();
    return keys.length === 3
        && keys[0] === "productId"
        && keys[1] === "quantity"
        && keys[2] === "size";
}

function validateAndAggregateShadowItems(items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_CART_LINES) {
        deny("INVALID_INPUT", "The checkout items are invalid.");
    }

    const aggregated = new Map();
    for (const item of items) {
        if (!exactLineItemShape(item)
            || typeof item.productId !== "string"
            || item.productId.length > 100
            || !PRODUCT_ID_PATTERN.test(item.productId)
            || typeof item.size !== "string"
            || !item.size.trim()
            || item.size.length > 100
            || !Number.isSafeInteger(item.quantity)
            || item.quantity < 1) {
            deny("INVALID_INPUT", "The checkout items are invalid.");
        }

        const key = `${item.productId}::${item.size}`;
        const nextQuantity = (aggregated.get(key)?.quantity || 0) + item.quantity;
        if (nextQuantity > MAX_ITEM_QUANTITY) {
            deny("INVALID_INPUT", "The checkout quantity is invalid.");
        }
        aggregated.set(key, {
            productId: item.productId,
            requestedSize: item.size,
            quantity: nextQuantity,
        });
    }
    return [...aggregated.values()];
}

function requireAvailableProduct(snapshot, requestedProductId) {
    if (!snapshot) deny("PRODUCT_NOT_FOUND", "The product does not exist.");
    const product = snapshot.data;
    if (!product
        || snapshot.id !== requestedProductId
        || product.id !== requestedProductId) {
        deny("PRODUCT_INVALID", "The product identity is invalid.");
    }
    if (product.active !== true
        || product.archivedAt !== null
        || product.channels?.shop !== true) {
        deny("PRODUCT_UNAVAILABLE", "The product is unavailable.");
    }
    if (product.prints?.available !== true || !Array.isArray(product.prints.options)) {
        deny("PRINTS_UNAVAILABLE", "Prints are unavailable.");
    }
    if (typeof product.title !== "string" || !product.title.trim()) {
        deny("PRODUCT_INVALID", "The product title is invalid.");
    }
    return product;
}

function resolveRequestedOption(product, requestedSize) {
    const options = product.prints.options;
    const idMatches = options.filter((option) => option?.id === requestedSize);
    if (idMatches.length > 1) deny("OPTION_AMBIGUOUS", "The requested option is ambiguous.");
    let option = idMatches[0] || null;
    if (!option) {
        const labelMatches = options.filter((candidate) => candidate?.label === requestedSize);
        if (labelMatches.length > 1) deny("OPTION_AMBIGUOUS", "The requested option is ambiguous.");
        option = labelMatches[0] || null;
    }
    if (!option) deny("OPTION_NOT_FOUND", "The requested option does not exist.");
    if (option.active !== true) deny("OPTION_UNAVAILABLE", "The requested option is unavailable.");
    if (typeof option.id !== "string"
        || !option.id
        || typeof option.label !== "string"
        || !option.label
        || !Number.isSafeInteger(option.amountCents)
        || option.amountCents <= 0
        || option.currency !== SUPPORTED_CURRENCY
        || typeof option.stripePriceId !== "string"
        || !STRIPE_PRICE_ID_PATTERN.test(option.stripePriceId)) {
        deny("INVALID_OPTION", "The requested option configuration is invalid.");
    }
    return option;
}

function checkoutTuple(product, option) {
    return {
        active: product.active,
        archivedAt: product.archivedAt,
        shop: product.channels.shop,
        printsAvailable: product.prints.available,
        optionId: option.id,
        label: option.label,
        optionActive: option.active,
        amountCents: option.amountCents,
        currency: option.currency,
        stripePriceId: option.stripePriceId,
    };
}

function stripeProductId(product) {
    return typeof product === "string" ? product : product?.id;
}

function isResourceMissing(error) {
    return error?.code === "resource_missing" || error?.statusCode === 404;
}

function verifySyncMetadata({ price, product, productId, optionId }) {
    const priceMetadata = price.metadata || {};
    const productMetadata = product.metadata || {};
    const suppliedAssociationMismatch = (priceMetadata.firestore_product_id
            && priceMetadata.firestore_product_id !== productId)
        || (priceMetadata.print_option_id && priceMetadata.print_option_id !== optionId)
        || (productMetadata.firestore_product_id
            && productMetadata.firestore_product_id !== productId);
    const missingSyncAssociation = (priceMetadata.source === "likwit_admin_price_sync"
            && (priceMetadata.firestore_product_id !== productId
                || priceMetadata.print_option_id !== optionId))
        || (productMetadata.source === "likwit_admin_price_sync"
            && productMetadata.firestore_product_id !== productId);
    if (suppliedAssociationMismatch || missingSyncAssociation) {
        deny("STRIPE_METADATA_MISMATCH", "Stripe metadata does not match the checkout option.");
    }
}

async function retrieveAndVerifyStripePrice({
    item,
    option,
    mapping,
    stripe,
    expectedLivemode,
}) {
    let price;
    try {
        price = await stripe.prices.retrieve(option.stripePriceId, { expand: ["product"] });
    } catch (error) {
        if (isResourceMissing(error)) {
            deny("STRIPE_PRICE_INVALID", "The Stripe Price does not exist.");
        }
        throw error;
    }

    if (!price
        || price.id !== option.stripePriceId
        || price.active !== true
        || price.type !== "one_time"
        || !Number.isSafeInteger(price.unit_amount)
        || price.unit_amount !== option.amountCents
        || price.currency !== option.currency
        || price.livemode !== expectedLivemode) {
        deny("STRIPE_PRICE_INVALID", "The Stripe Price is invalid.");
    }

    let product = price.product;
    if (typeof product === "string") {
        if (!stripe.products?.retrieve) {
            deny("STRIPE_PRODUCT_INVALID", "The Stripe Product could not be verified.");
        }
        try {
            product = await stripe.products.retrieve(product);
        } catch (error) {
            if (isResourceMissing(error)) {
                deny("STRIPE_PRODUCT_INVALID", "The Stripe Product does not exist.");
            }
            throw error;
        }
    }
    if (!product
        || typeof product.id !== "string"
        || product.deleted === true
        || product.active !== true
        || product.livemode !== expectedLivemode) {
        deny("STRIPE_PRODUCT_INVALID", "The Stripe Product is invalid.");
    }
    if (!mapping
        || mapping.productId !== item.productId
        || typeof mapping.stripeProductId !== "string"
        || mapping.stripeProductId !== product.id
        || stripeProductId(price.product) !== mapping.stripeProductId) {
        deny("STRIPE_PRODUCT_MISMATCH", "The Stripe Product mapping does not match.");
    }
    verifySyncMetadata({
        price,
        product,
        productId: item.productId,
        optionId: option.id,
    });
    return { price, product };
}

async function resolveFirestoreCheckoutShadow({ items, store, stripe, expectedLivemode }) {
    if (!store?.getProduct || !store?.getProductMapping
        || !stripe?.prices?.retrieve
        || typeof expectedLivemode !== "boolean") {
        deny("INVALID_CONFIGURATION", "Checkout shadow dependencies are unavailable.");
    }
    const aggregatedItems = validateAndAggregateShadowItems(items);
    const uniqueProductIds = [...new Set(aggregatedItems.map((item) => item.productId))];
    const initialSnapshots = new Map(await Promise.all(uniqueProductIds.map(async (productId) => [
        productId,
        await store.getProduct(productId),
    ])));

    const preparedItems = aggregatedItems.map((item) => {
        const snapshot = initialSnapshots.get(item.productId);
        const product = requireAvailableProduct(snapshot, item.productId);
        const option = resolveRequestedOption(product, item.requestedSize);
        return {
            ...item,
            snapshot,
            product,
            option,
            initialTuple: checkoutTuple(product, option),
        };
    });

    const mappings = new Map(await Promise.all(uniqueProductIds.map(async (productId) => [
        productId,
        await store.getProductMapping(productId),
    ])));
    const resolvedItems = [];
    for (const item of preparedItems) {
        const { product: stripeProduct } = await retrieveAndVerifyStripePrice({
            item,
            option: item.option,
            mapping: mappings.get(item.productId),
            stripe,
            expectedLivemode,
        });
        resolvedItems.push({ item, stripeProduct });
    }

    const finalSnapshots = new Map(await Promise.all(uniqueProductIds.map(async (productId) => [
        productId,
        await store.getProduct(productId),
    ])));
    for (const prepared of preparedItems) {
        let finalTuple;
        try {
            const finalProduct = requireAvailableProduct(
                finalSnapshots.get(prepared.productId),
                prepared.productId
            );
            const finalOption = resolveRequestedOption(finalProduct, prepared.option.id);
            finalTuple = checkoutTuple(finalProduct, finalOption);
        } catch (error) {
            if (error instanceof CheckoutShadowError) {
                deny("STALE_PRODUCT", "The product changed during checkout verification.");
            }
            throw error;
        }
        if (JSON.stringify(finalTuple) !== JSON.stringify(prepared.initialTuple)) {
            deny("STALE_PRODUCT", "The product changed during checkout verification.");
        }
    }

    return resolvedItems.map(({ item, stripeProduct }) => ({
        productId: item.productId,
        title: item.product.title,
        optionId: item.option.id,
        label: item.option.label,
        stripePriceId: item.option.stripePriceId,
        stripeProductId: stripeProduct.id,
        amountCents: item.option.amountCents,
        currency: item.option.currency,
        quantity: item.quantity,
        firestoreVersion: item.snapshot.version || null,
    }));
}

function compareCheckoutCatalogs({ legacyCheckout, shadowCheckout }) {
    if (!legacyCheckout || !Array.isArray(shadowCheckout)) {
        return { status: SHADOW_PARITY_STATUS.ERROR, reasonCode: null };
    }
    const legacyItems = (legacyCheckout.cartItems || []).map((item, index) => ({
        ...item,
        stripePriceId: legacyCheckout.lineItems?.[index]?.price,
        amountCents: Math.round(Number(item.unitPrice) * 100),
        currency: String(legacyCheckout.currency || "").toLowerCase(),
    }));
    if (legacyItems.length !== shadowCheckout.length) {
        return { status: SHADOW_PARITY_STATUS.PRODUCT_MISMATCH, reasonCode: null };
    }
    for (const shadowItem of shadowCheckout) {
        const productMatches = legacyItems.filter((item) => item.productId === shadowItem.productId);
        if (!productMatches.length) {
            return { status: SHADOW_PARITY_STATUS.PRODUCT_MISMATCH, reasonCode: null };
        }
        const legacyItem = productMatches.find((item) =>
            item.size === shadowItem.optionId || item.size === shadowItem.label
        );
        if (!legacyItem || legacyItem.quantity !== shadowItem.quantity) {
            return { status: SHADOW_PARITY_STATUS.OPTION_MISMATCH, reasonCode: null };
        }
        if (legacyItem.title !== shadowItem.title) {
            return { status: SHADOW_PARITY_STATUS.PRODUCT_MISMATCH, reasonCode: null };
        }
        if (legacyItem.stripePriceId !== shadowItem.stripePriceId) {
            return { status: SHADOW_PARITY_STATUS.PRICE_ID_MISMATCH, reasonCode: null };
        }
        if (legacyItem.amountCents !== shadowItem.amountCents) {
            return { status: SHADOW_PARITY_STATUS.AMOUNT_MISMATCH, reasonCode: null };
        }
        if (legacyItem.currency !== shadowItem.currency) {
            return { status: SHADOW_PARITY_STATUS.CURRENCY_MISMATCH, reasonCode: null };
        }
    }
    return { status: SHADOW_PARITY_STATUS.MATCH, reasonCode: null };
}

function safeShadowLog(logger, report, items) {
    try {
        logger?.info?.("Checkout catalog shadow parity", {
            status: report.status,
            reasonCode: report.reasonCode || null,
            itemCount: Array.isArray(items) ? items.length : 0,
            productIds: Array.isArray(items)
                ? [...new Set(items.map((item) => item?.productId).filter((value) => typeof value === "string"))]
                : [],
        });
    } catch {
        // Shadow logging must never affect the legacy checkout authority.
    }
}

async function resolveLegacyCheckoutWithShadow({
    items,
    stripe,
    store,
    expectedLivemode,
    buildLegacyCheckout,
    resolveShadowCheckout = resolveFirestoreCheckoutShadow,
    shadowTimeoutMs = DEFAULT_SHADOW_TIMEOUT_MS,
    logger,
}) {
    const settle = async (operation) => {
        try {
            return { value: await operation() };
        } catch (error) {
            return { error };
        }
    };
    const resolveShadowWithTimeout = async () => {
        let timeout;
        try {
            return await Promise.race([
                resolveShadowCheckout({ items, store, stripe, expectedLivemode }),
                new Promise((resolve, reject) => {
                    timeout = setTimeout(
                        () => reject(new Error("Checkout shadow verification timed out.")),
                        shadowTimeoutMs
                    );
                }),
            ]);
        } finally {
            clearTimeout(timeout);
        }
    };
    const [legacyOutcome, shadowOutcome] = await Promise.all([
        settle(() => buildLegacyCheckout({ items, stripe, expectedLivemode })),
        settle(resolveShadowWithTimeout),
    ]);
    const legacyCheckout = legacyOutcome.value || null;
    const legacyError = legacyOutcome.error || null;
    const shadowCheckout = shadowOutcome.value || null;
    const shadowError = shadowOutcome.error || null;

    let report;
    if (legacyError) {
        report = { status: SHADOW_PARITY_STATUS.LEGACY_DENIED, reasonCode: null };
    } else if (shadowError instanceof CheckoutShadowError) {
        report = {
            status: SHADOW_PARITY_STATUS.FIRESTORE_DENIED,
            reasonCode: shadowError.code,
        };
    } else if (shadowError) {
        report = { status: SHADOW_PARITY_STATUS.ERROR, reasonCode: "SHADOW_ERROR" };
    } else {
        report = compareCheckoutCatalogs({ legacyCheckout, shadowCheckout });
    }
    safeShadowLog(logger, report, items);

    if (legacyError) throw legacyError;
    return legacyCheckout;
}

function snapshotVersion(snapshot) {
    const updateTime = snapshot?.updateTime;
    if (!updateTime) return null;
    if (typeof updateTime.toDate === "function") return updateTime.toDate().toISOString();
    if (typeof updateTime.toMillis === "function") {
        return new Date(updateTime.toMillis()).toISOString();
    }
    return null;
}

function createFirestoreCheckoutShadowStore({ firestore }) {
    const products = firestore.collection("shopProducts");
    const mappings = firestore.collection("adminStripePrintProductMappings");
    return {
        async getProduct(productId) {
            const snapshot = await products.doc(productId).get();
            if (!snapshot.exists) return null;
            return {
                id: snapshot.id,
                data: snapshot.data(),
                version: snapshotVersion(snapshot),
            };
        },
        async getProductMapping(productId) {
            const snapshot = await mappings.doc(productId).get();
            return snapshot.exists ? snapshot.data() : null;
        },
    };
}

module.exports = {
    CheckoutShadowError,
    SHADOW_PARITY_STATUS,
    compareCheckoutCatalogs,
    createFirestoreCheckoutShadowStore,
    resolveFirestoreCheckoutShadow,
    resolveLegacyCheckoutWithShadow,
    validateAndAggregateShadowItems,
};

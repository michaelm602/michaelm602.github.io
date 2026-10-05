"use strict";
/* global module, require */

const {
    CheckoutShadowError,
    resolveFirestoreCheckoutShadow,
    validateAndAggregateShadowItems,
} = require("./firestoreCheckoutShadow");

const DEFAULT_CHECKOUT_RESOLVER_MODE = "firestore";
const LEGACY_CHECKOUT_RESOLVER_MODE = "legacy";
const PRODUCTION_ORIGIN = "https://www.likwitblvd.com";
const DEVELOPMENT_ORIGINS = new Set([
    "http://localhost:5173",
    "http://localhost:4173",
]);

class CheckoutAuthorityError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "CheckoutAuthorityError";
        this.code = code;
    }
}

function getCheckoutResolverMode(value) {
    const mode = value || DEFAULT_CHECKOUT_RESOLVER_MODE;
    if (mode !== DEFAULT_CHECKOUT_RESOLVER_MODE
        && mode !== LEGACY_CHECKOUT_RESOLVER_MODE) {
        throw new CheckoutAuthorityError(
            "INVALID_RESOLVER_MODE",
            "The checkout resolver mode is invalid."
        );
    }
    return mode;
}

function normalizeRequestItems(items) {
    return validateAndAggregateShadowItems(items).map((item) => ({
        productId: item.productId,
        size: item.requestedSize,
        quantity: item.quantity,
    }));
}

function buildFirestoreAuthorityCheckout(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new CheckoutAuthorityError(
            "INVALID_FIRESTORE_RESULT",
            "The Firestore checkout result is invalid."
        );
    }

    const cartItems = items.map((item) => {
        if (!item
            || typeof item.productId !== "string"
            || typeof item.title !== "string"
            || typeof item.optionId !== "string"
            || typeof item.label !== "string"
            || typeof item.stripePriceId !== "string"
            || typeof item.stripeProductId !== "string"
            || !Number.isSafeInteger(item.amountCents)
            || item.amountCents <= 0
            || item.currency !== "usd"
            || !Number.isSafeInteger(item.quantity)
            || item.quantity <= 0) {
            throw new CheckoutAuthorityError(
                "INVALID_FIRESTORE_RESULT",
                "The Firestore checkout result is invalid."
            );
        }
        return {
            productId: item.productId,
            title: item.title,
            optionId: item.optionId,
            label: item.label,
            stripePriceId: item.stripePriceId,
            stripeProductId: item.stripeProductId,
            amountCents: item.amountCents,
            currency: item.currency,
            quantity: item.quantity,
            firestoreVersion: item.firestoreVersion || null,
            // Preserve the existing webhook/email snapshot contract while the
            // canonical cents-based fields remain authoritative.
            size: item.label,
            unitPrice: item.amountCents / 100,
        };
    });
    const orderTotalCents = cartItems.reduce(
        (total, item) => total + item.amountCents * item.quantity,
        0
    );
    if (!Number.isSafeInteger(orderTotalCents) || orderTotalCents <= 0) {
        throw new CheckoutAuthorityError(
            "INVALID_FIRESTORE_RESULT",
            "The Firestore checkout total is invalid."
        );
    }

    return {
        resolverMode: DEFAULT_CHECKOUT_RESOLVER_MODE,
        lineItems: cartItems.map((item) => ({
            price: item.stripePriceId,
            quantity: item.quantity,
        })),
        cartItems,
        orderTotal: orderTotalCents / 100,
        orderTotalCents,
        currency: "USD",
    };
}

function buildLegacyAuthorityCheckout(checkout) {
    const orderTotalCents = Math.round(Number(checkout?.orderTotal) * 100);
    if (!checkout
        || !Array.isArray(checkout.lineItems)
        || !Array.isArray(checkout.cartItems)
        || !Number.isSafeInteger(orderTotalCents)
        || orderTotalCents <= 0) {
        throw new CheckoutAuthorityError(
            "INVALID_LEGACY_RESULT",
            "The legacy checkout result is invalid."
        );
    }
    return {
        ...checkout,
        resolverMode: LEGACY_CHECKOUT_RESOLVER_MODE,
        orderTotalCents,
    };
}

function logDetails({ mode, status, reasonCode, items }) {
    return {
        resolverMode: mode,
        status,
        reasonCode,
        itemCount: Array.isArray(items) ? items.length : 0,
        productIds: Array.isArray(items)
            ? [...new Set(items
                .map((item) => item?.productId)
                .filter((value) => typeof value === "string"))]
            : [],
    };
}

function safeLog(logger, level, details) {
    try {
        logger?.[level]?.("Checkout authority resolution", details);
    } catch {
        // Observability must never change the checkout result.
    }
}

async function resolveCheckoutAuthority({
    resolverMode,
    items,
    stripe,
    store,
    expectedLivemode,
    buildLegacyCheckout,
    resolveFirestoreCheckout = resolveFirestoreCheckoutShadow,
    logger,
}) {
    let mode;
    try {
        mode = getCheckoutResolverMode(resolverMode);
        const normalizedItems = normalizeRequestItems(items);
        let checkout;
        if (mode === LEGACY_CHECKOUT_RESOLVER_MODE) {
            if (typeof buildLegacyCheckout !== "function") {
                throw new CheckoutAuthorityError(
                    "INVALID_LEGACY_CONFIGURATION",
                    "The legacy checkout resolver is unavailable."
                );
            }
            checkout = buildLegacyAuthorityCheckout(await buildLegacyCheckout({
                items: normalizedItems,
                stripe,
                expectedLivemode,
            }));
        } else {
            checkout = buildFirestoreAuthorityCheckout(await resolveFirestoreCheckout({
                items: normalizedItems,
                stripe,
                store,
                expectedLivemode,
            }));
        }
        safeLog(logger, "info", logDetails({
            mode,
            status: "AUTHORIZED",
            reasonCode: null,
            items: normalizedItems,
        }));
        return checkout;
    } catch (error) {
        const reasonCode = error?.code
            || (mode === LEGACY_CHECKOUT_RESOLVER_MODE ? "LEGACY_DENIED" : "RESOLVER_ERROR");
        safeLog(logger, "warn", logDetails({
            mode: mode || String(resolverMode || DEFAULT_CHECKOUT_RESOLVER_MODE),
            status: "DENIED",
            reasonCode,
            items,
        }));
        throw error;
    }
}

function buildCheckoutRedirectUrls({ requestOrigin } = {}) {
    const baseUrl = DEVELOPMENT_ORIGINS.has(requestOrigin)
        ? requestOrigin
        : PRODUCTION_ORIGIN;
    return {
        successUrl: `${baseUrl}/success?status=success&provider=stripe`,
        cancelUrl: `${baseUrl}/cancel?status=cancel&provider=stripe`,
    };
}

function toCheckoutClientError(error) {
    const isUnavailable = error instanceof CheckoutShadowError
        || error instanceof CheckoutAuthorityError
        || error?.statusCode === 400;
    return isUnavailable
        ? {
            statusCode: 400,
            message: "Checkout is unavailable for one or more selected items.",
        }
        : {
            statusCode: 500,
            message: "Checkout is temporarily unavailable. Please try again.",
        };
}

module.exports = {
    CheckoutAuthorityError,
    DEFAULT_CHECKOUT_RESOLVER_MODE,
    buildCheckoutRedirectUrls,
    buildFirestoreAuthorityCheckout,
    getCheckoutResolverMode,
    resolveCheckoutAuthority,
    toCheckoutClientError,
};

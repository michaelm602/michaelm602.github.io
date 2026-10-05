"use strict";
/* global module */

const SUPPORTED_SHIPPING_COUNTRIES = Object.freeze(["US"]);
const PAID_CHECKOUT_EVENTS = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
]);
const SUPPORTED_CHECKOUT_CURRENCY = "usd";

class StripeFulfillmentValidationError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = "StripeFulfillmentValidationError";
        this.code = code;
        this.details = details;
    }
}

function appendOrderId(url, orderId) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}orderId=${encodeURIComponent(orderId)}`;
}

function nullableString(value) {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized || null;
}

function normalizedCurrency(value) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
}

function historicalUnitPriceToCents(unitPrice) {
    if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        return null;
    }

    const match = String(unitPrice).match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) return null;

    const wholeDollars = Number(match[1]);
    const fractionalCents = Number((match[2] || "").padEnd(2, "0"));
    const amountCents = wholeDollars * 100 + fractionalCents;
    return Number.isSafeInteger(amountCents) && amountCents > 0
        ? amountCents
        : null;
}

function storedItemAmountCents(item) {
    if (Object.prototype.hasOwnProperty.call(item, "amountCents")) {
        if (Number.isSafeInteger(item.amountCents) && item.amountCents > 0) {
            return item.amountCents;
        }
        throw new StripeFulfillmentValidationError(
            "INVALID_ORDER_ITEM_AMOUNT",
            "The stored order contains an invalid item amount."
        );
    }

    const historicalAmountCents = historicalUnitPriceToCents(item.unitPrice);
    if (historicalAmountCents === null) {
        throw new StripeFulfillmentValidationError(
            "INVALID_ORDER_ITEM_AMOUNT",
            "The stored order contains an invalid item amount."
        );
    }
    return historicalAmountCents;
}

function verifyStripeCheckoutFinancials({ order, session }) {
    const items = order?.cartItems;
    if (!Array.isArray(items) || items.length === 0) {
        throw new StripeFulfillmentValidationError(
            "INVALID_ORDER_ITEMS",
            "The stored order does not contain valid items."
        );
    }

    const orderCurrency = normalizedCurrency(order?.currency);
    if (order?.currency != null && !orderCurrency) {
        throw new StripeFulfillmentValidationError(
            "INVALID_ORDER_CURRENCY",
            "The stored order currency is invalid."
        );
    }

    let expectedCurrency = orderCurrency;
    let expectedAmountCents = 0;

    for (const item of items) {
        if (!item || typeof item !== "object") {
            throw new StripeFulfillmentValidationError(
                "INVALID_ORDER_ITEMS",
                "The stored order does not contain valid items."
            );
        }
        if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
            throw new StripeFulfillmentValidationError(
                "INVALID_ORDER_ITEM_QUANTITY",
                "The stored order contains an invalid item quantity."
            );
        }

        const itemAmountCents = storedItemAmountCents(item);
        const lineTotalCents = itemAmountCents * item.quantity;
        if (!Number.isSafeInteger(lineTotalCents) || lineTotalCents <= 0) {
            throw new StripeFulfillmentValidationError(
                "INVALID_ORDER_TOTAL",
                "The stored order total is invalid."
            );
        }
        expectedAmountCents += lineTotalCents;
        if (!Number.isSafeInteger(expectedAmountCents) || expectedAmountCents <= 0) {
            throw new StripeFulfillmentValidationError(
                "INVALID_ORDER_TOTAL",
                "The stored order total is invalid."
            );
        }

        const itemCurrency = item.currency == null
            ? orderCurrency
            : normalizedCurrency(item.currency);
        if (!itemCurrency || (expectedCurrency && itemCurrency !== expectedCurrency)) {
            throw new StripeFulfillmentValidationError(
                "INVALID_ORDER_CURRENCY",
                "The stored order currencies do not agree."
            );
        }
        expectedCurrency = itemCurrency;
    }

    if (!expectedCurrency) {
        throw new StripeFulfillmentValidationError(
            "INVALID_ORDER_CURRENCY",
            "The stored order currency is invalid."
        );
    }
    if (expectedCurrency !== SUPPORTED_CHECKOUT_CURRENCY) {
        throw new StripeFulfillmentValidationError(
            "UNSUPPORTED_ORDER_CURRENCY",
            "The stored order currency is not supported.",
            { expectedAmountCents, expectedCurrency }
        );
    }

    const stripeAmountSubtotal = session?.amount_subtotal;
    const stripeAmountTotal = session?.amount_total;
    const stripeCurrency = normalizedCurrency(session?.currency);
    const financialDetails = {
        expectedAmountCents,
        expectedCurrency,
        stripeAmountSubtotal: Number.isSafeInteger(stripeAmountSubtotal)
            ? stripeAmountSubtotal
            : null,
        stripeAmountTotal: Number.isSafeInteger(stripeAmountTotal)
            ? stripeAmountTotal
            : null,
        stripeCurrency,
    };

    if (!Number.isSafeInteger(stripeAmountSubtotal)
        || !Number.isSafeInteger(stripeAmountTotal)
        || stripeAmountSubtotal < 0
        || stripeAmountTotal < 0) {
        throw new StripeFulfillmentValidationError(
            "STRIPE_AMOUNT_MISSING",
            "The Stripe Checkout Session amount is missing or invalid.",
            financialDetails
        );
    }
    if (stripeAmountSubtotal !== expectedAmountCents) {
        throw new StripeFulfillmentValidationError(
            "STRIPE_SUBTOTAL_MISMATCH",
            "The Stripe Checkout Session subtotal does not match the stored order.",
            financialDetails
        );
    }
    if (stripeAmountTotal !== expectedAmountCents) {
        throw new StripeFulfillmentValidationError(
            "STRIPE_TOTAL_MISMATCH",
            "The Stripe Checkout Session total does not match the stored order.",
            financialDetails
        );
    }
    if (!stripeCurrency || stripeCurrency !== expectedCurrency) {
        throw new StripeFulfillmentValidationError(
            "STRIPE_CURRENCY_MISMATCH",
            "The Stripe Checkout Session currency does not match the stored order.",
            financialDetails
        );
    }

    return financialDetails;
}

function buildStripeCheckoutSessionParams({
    lineItems,
    successUrl,
    cancelUrl,
    orderId,
}) {
    return {
        mode: "payment",
        line_items: lineItems,
        shipping_address_collection: {
            // US-only is the safe launch assumption until the business confirms
            // every country it can fulfill and support.
            allowed_countries: [...SUPPORTED_SHIPPING_COUNTRIES],
        },
        success_url: appendOrderId(successUrl, orderId),
        cancel_url: appendOrderId(cancelUrl, orderId),
        client_reference_id: orderId,
        metadata: { orderId },
    };
}

function extractStripeShippingInfo(session) {
    const shippingDetails =
        session?.collected_information?.shipping_details ||
        session?.shipping_details ||
        null;

    if (!shippingDetails) return null;

    const address = shippingDetails.address || {};
    return {
        name: nullableString(shippingDetails.name),
        address: {
            line1: nullableString(address.line1),
            line2: nullableString(address.line2),
            city: nullableString(address.city),
            state: nullableString(address.state),
            postalCode: nullableString(address.postal_code),
            country: nullableString(address.country),
        },
    };
}

function buildPaidStripeOrderFields(session) {
    return {
        buyerInfo: {
            name: nullableString(session?.customer_details?.name),
            email: nullableString(session?.customer_details?.email),
        },
        shippingInfo: extractStripeShippingInfo(session),
        status: "paid",
        paymentProvider: "stripe",
        paymentStatus: "paid",
        stripeSessionId: session?.id || null,
        stripePaymentIntentId: session?.payment_intent || null,
        stripeCustomerId: session?.customer || null,
        stripeCustomerEmail: nullableString(session?.customer_details?.email),
        stripePaymentStatus: session?.payment_status || null,
    };
}

function normalizeOrderItems(cartItems = []) {
    if (!Array.isArray(cartItems)) return [];

    return cartItems.map((item) => {
        const quantity = Number(item.quantity) || 1;
        const verifiedAmountCents = Number.isSafeInteger(item.amountCents)
            ? item.amountCents
            : null;
        const unitPrice = verifiedAmountCents !== null
            ? verifiedAmountCents / 100
            : Number(item.unitPrice ?? item.price) || 0;

        return {
            productId: item.productId || null,
            title: item.title || "Untitled artwork",
            size: item.label || item.size || item.optionId || "Selected size",
            quantity,
            unitPrice,
            lineTotal: unitPrice * quantity,
            image: item.image || null,
        };
    });
}

function isPaidStripeCheckoutEvent({ type, session }) {
    return PAID_CHECKOUT_EVENTS.has(type) && session?.payment_status === "paid";
}

function constructStripeWebhookEvent({ stripe, rawBody, signature, webhookSecret }) {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

function safeLoggedInteger(value) {
    return Number.isSafeInteger(value) ? value : null;
}

function buildStripeFinancialVerificationLog({
    error,
    eventId,
    orderId,
    session,
}) {
    const details = error?.details || {};
    return {
        eventId: typeof eventId === "string" ? eventId : null,
        orderId: typeof orderId === "string" ? orderId : null,
        reasonCode: typeof error?.code === "string"
            ? error.code
            : "FULFILLMENT_VALIDATION_ERROR",
        expectedAmountCents: safeLoggedInteger(details.expectedAmountCents),
        stripeAmountSubtotal: safeLoggedInteger(
            details.stripeAmountSubtotal ?? session?.amount_subtotal
        ),
        stripeAmountTotal: safeLoggedInteger(
            details.stripeAmountTotal ?? session?.amount_total
        ),
        expectedCurrency: normalizedCurrency(details.expectedCurrency),
        stripeCurrency: normalizedCurrency(
            details.stripeCurrency ?? session?.currency
        ),
    };
}

async function applyPaidStripeOrderTransition({
    runTransaction,
    orderRef,
    session,
    serverTimestamp,
}) {
    return runTransaction(async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) {
            throw new StripeFulfillmentValidationError(
                "ORDER_NOT_FOUND",
                "The stored order could not be found."
            );
        }

        const order = orderSnap.data();
        const financials = verifyStripeCheckoutFinancials({ order, session });
        const alreadyPaid = order?.status === "paid"
            && order?.paymentStatus === "paid";

        if (!alreadyPaid) {
            const timestamp = serverTimestamp();
            transaction.set(
                orderRef,
                {
                    ...buildPaidStripeOrderFields(session),
                    paidAt: timestamp,
                    updatedAt: timestamp,
                },
                { merge: true }
            );
        }

        return {
            alreadyPaid,
            expectedAmountCents: financials.expectedAmountCents,
            expectedCurrency: financials.expectedCurrency,
        };
    });
}

module.exports = {
    SUPPORTED_SHIPPING_COUNTRIES,
    StripeFulfillmentValidationError,
    applyPaidStripeOrderTransition,
    buildPaidStripeOrderFields,
    buildStripeCheckoutSessionParams,
    buildStripeFinancialVerificationLog,
    constructStripeWebhookEvent,
    extractStripeShippingInfo,
    isPaidStripeCheckoutEvent,
    normalizeOrderItems,
    verifyStripeCheckoutFinancials,
};

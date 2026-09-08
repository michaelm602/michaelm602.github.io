"use strict";

const SUPPORTED_SHIPPING_COUNTRIES = Object.freeze(["US"]);
const PAID_CHECKOUT_EVENTS = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
]);

function appendOrderId(url, orderId) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}orderId=${encodeURIComponent(orderId)}`;
}

function nullableString(value) {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized || null;
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

function isPaidStripeCheckoutEvent({ type, session }) {
    return PAID_CHECKOUT_EVENTS.has(type) && session?.payment_status === "paid";
}

module.exports = {
    SUPPORTED_SHIPPING_COUNTRIES,
    buildPaidStripeOrderFields,
    buildStripeCheckoutSessionParams,
    extractStripeShippingInfo,
    isPaidStripeCheckoutEvent,
};

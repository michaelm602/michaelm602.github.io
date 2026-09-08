"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

let checkoutFulfillment = {};
try {
    checkoutFulfillment = require("./checkoutFulfillment");
} catch {
    // The first TDD run intentionally exercises the missing implementation.
}

test("Stripe Checkout collects a US shipping address for every print order", () => {
    const result = checkoutFulfillment.buildStripeCheckoutSessionParams?.({
        lineItems: [{ price: "price_print", quantity: 2 }],
        successUrl: "https://www.likwitblvd.com/success?status=success",
        cancelUrl: "https://www.likwitblvd.com/cancel?status=cancel",
        orderId: "AbCdEfGhIjKlMnOpQr12",
    });

    assert.deepEqual(result, {
        mode: "payment",
        line_items: [{ price: "price_print", quantity: 2 }],
        shipping_address_collection: {
            allowed_countries: ["US"],
        },
        success_url:
            "https://www.likwitblvd.com/success?status=success&orderId=AbCdEfGhIjKlMnOpQr12",
        cancel_url:
            "https://www.likwitblvd.com/cancel?status=cancel&orderId=AbCdEfGhIjKlMnOpQr12",
        client_reference_id: "AbCdEfGhIjKlMnOpQr12",
        metadata: { orderId: "AbCdEfGhIjKlMnOpQr12" },
    });
});

test("paid Stripe order fields preserve trusted webhook shipping details", () => {
    const result = checkoutFulfillment.buildPaidStripeOrderFields?.({
        id: "cs_test_paid",
        payment_intent: "pi_test_paid",
        customer: "cus_test_buyer",
        payment_status: "paid",
        customer_details: {
            name: "Billing Name",
            email: "buyer@example.com",
        },
        collected_information: {
            shipping_details: {
                name: "Shipping Name",
                address: {
                    line1: "123 Main Street",
                    line2: "Apt 4",
                    city: "Phoenix",
                    state: "AZ",
                    postal_code: "85001",
                    country: "US",
                },
            },
        },
    });

    assert.deepEqual(result, {
        buyerInfo: {
            name: "Billing Name",
            email: "buyer@example.com",
        },
        shippingInfo: {
            name: "Shipping Name",
            address: {
                line1: "123 Main Street",
                line2: "Apt 4",
                city: "Phoenix",
                state: "AZ",
                postalCode: "85001",
                country: "US",
            },
        },
        status: "paid",
        paymentProvider: "stripe",
        paymentStatus: "paid",
        stripeSessionId: "cs_test_paid",
        stripePaymentIntentId: "pi_test_paid",
        stripeCustomerId: "cus_test_buyer",
        stripeCustomerEmail: "buyer@example.com",
        stripePaymentStatus: "paid",
    });
});

test("legacy Stripe shipping_details are supported without exposing extra fields", () => {
    const result = checkoutFulfillment.extractStripeShippingInfo?.({
        shipping_details: {
            name: "Legacy Recipient",
            phone: "private-extra-field",
            address: {
                line1: "500 Legacy Avenue",
                line2: null,
                city: "Seattle",
                state: "WA",
                postal_code: "98101",
                country: "US",
                extra: "not persisted",
            },
        },
    });

    assert.deepEqual(result, {
        name: "Legacy Recipient",
        address: {
            line1: "500 Legacy Avenue",
            line2: null,
            city: "Seattle",
            state: "WA",
            postalCode: "98101",
            country: "US",
        },
    });
});

test("paid fulfillment accepts immediate and asynchronous Checkout success events", () => {
    assert.equal(
        checkoutFulfillment.isPaidStripeCheckoutEvent?.({
            type: "checkout.session.completed",
            session: { payment_status: "paid" },
        }),
        true
    );
    assert.equal(
        checkoutFulfillment.isPaidStripeCheckoutEvent?.({
            type: "checkout.session.async_payment_succeeded",
            session: { payment_status: "paid" },
        }),
        true
    );
    assert.equal(
        checkoutFulfillment.isPaidStripeCheckoutEvent?.({
            type: "checkout.session.completed",
            session: { payment_status: "unpaid" },
        }),
        false
    );
    assert.equal(
        checkoutFulfillment.isPaidStripeCheckoutEvent?.({
            type: "payment_intent.succeeded",
            session: { payment_status: "paid" },
        }),
        false
    );
});

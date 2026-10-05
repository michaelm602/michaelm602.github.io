"use strict";
/* global require */

const test = require("node:test");
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");

let checkoutFulfillment = {};
try {
    checkoutFulfillment = require("./checkoutFulfillment");
} catch {
    // The first TDD run intentionally exercises the missing implementation.
}

const JAGUAR_ITEM = Object.freeze({
    productId: "the-jaguars-bloodline",
    title: "The Jaguar’s Bloodline",
    optionId: "16x20",
    label: "16x20",
    stripePriceId: "price_1UN3vuJEVsglohuhrE9SbhCZ",
    stripeProductId: "prod_VNpbmg8RMbqhZ2",
    amountCents: 10000,
    currency: "usd",
    quantity: 1,
});

const ECHOES_ITEM = Object.freeze({
    productId: "echoes-of-the-5th-sun",
    title: "Echoes of the 5th Sun",
    optionId: "18x24",
    label: "18x24",
    stripePriceId: "price_echoes_18x24",
    stripeProductId: "prod_echoes",
    amountCents: 20000,
    currency: "usd",
    quantity: 2,
});

function stripeSession(overrides = {}) {
    return {
        id: "cs_test_paid",
        payment_status: "paid",
        amount_subtotal: 10000,
        amount_total: 10000,
        currency: "usd",
        ...overrides,
    };
}

function transactionHarness(order, { exists = true } = {}) {
    const writes = [];
    const orderRef = { id: "order_test" };
    const runTransaction = async (handler) => handler({
        get: async (ref) => {
            assert.equal(ref, orderRef);
            return {
                exists,
                data: () => order,
            };
        },
        set: (...args) => writes.push(args),
    });

    return { orderRef, runTransaction, writes };
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

test("webhook email normalization reads new verified snapshots and historical orders", () => {
    assert.deepEqual(checkoutFulfillment.normalizeOrderItems?.([{
        productId: "the-jaguars-bloodline",
        title: "The Jaguar’s Bloodline",
        optionId: "16x20",
        label: "16x20",
        stripePriceId: "price_1UN3vuJEVsglohuhrE9SbhCZ",
        stripeProductId: "prod_VNpbmg8RMbqhZ2",
        amountCents: 10000,
        currency: "usd",
        quantity: 2,
        firestoreVersion: "2026-10-05T17:37:28.000Z",
    }]), [{
        productId: "the-jaguars-bloodline",
        title: "The Jaguar’s Bloodline",
        size: "16x20",
        quantity: 2,
        unitPrice: 100,
        lineTotal: 200,
        image: null,
    }]);

    assert.deepEqual(checkoutFulfillment.normalizeOrderItems?.([{
        productId: "echoes-of-the-5th-sun",
        title: "Echoes of the 5th Sun",
        size: "18x24",
        quantity: 1,
        unitPrice: 200,
        image: "https://example.com/legacy.jpg",
    }]), [{
        productId: "echoes-of-the-5th-sun",
        title: "Echoes of the 5th Sun",
        size: "18x24",
        quantity: 1,
        unitPrice: 200,
        lineTotal: 200,
        image: "https://example.com/legacy.jpg",
    }]);
});

test("current Jaguar amountCents snapshot matches signed Stripe subtotal, total, and currency", () => {
    assert.deepEqual(
        checkoutFulfillment.verifyStripeCheckoutFinancials?.({
            order: { cartItems: [JAGUAR_ITEM], currency: "USD" },
            session: stripeSession(),
        }),
        {
            expectedAmountCents: 10000,
            expectedCurrency: "usd",
            stripeAmountSubtotal: 10000,
            stripeAmountTotal: 10000,
            stripeCurrency: "usd",
        }
    );
});

test("current Echoes snapshot multiplies quantity and supports a multi-item total", () => {
    const secondItem = {
        ...JAGUAR_ITEM,
        productId: "the-jaguars-bloodline-second-print",
        amountCents: 5000,
        quantity: 3,
    };

    assert.deepEqual(
        checkoutFulfillment.verifyStripeCheckoutFinancials?.({
            order: { cartItems: [ECHOES_ITEM, secondItem], currency: "usd" },
            session: stripeSession({
                amount_subtotal: 55000,
                amount_total: 55000,
            }),
        }),
        {
            expectedAmountCents: 55000,
            expectedCurrency: "usd",
            stripeAmountSubtotal: 55000,
            stripeAmountTotal: 55000,
            stripeCurrency: "usd",
        }
    );
});

test("historical unitPrice snapshots convert exactly to cents", () => {
    assert.deepEqual(
        checkoutFulfillment.verifyStripeCheckoutFinancials?.({
            order: {
                cartItems: [{
                    productId: "historical-print",
                    title: "Historical Print",
                    size: "16x20",
                    unitPrice: 29.99,
                    quantity: 2,
                }],
                currency: "USD",
            },
            session: stripeSession({
                amount_subtotal: 5998,
                amount_total: 5998,
            }),
        }),
        {
            expectedAmountCents: 5998,
            expectedCurrency: "usd",
            stripeAmountSubtotal: 5998,
            stripeAmountTotal: 5998,
            stripeCurrency: "usd",
        }
    );
});

for (const [name, sessionOverrides] of [
    ["amount too low", { amount_subtotal: 9999, amount_total: 9999 }],
    ["amount too high", { amount_subtotal: 10001, amount_total: 10001 }],
]) {
    test(`${name} fails closed`, () => {
        assert.throws(
            () => checkoutFulfillment.verifyStripeCheckoutFinancials?.({
                order: { cartItems: [JAGUAR_ITEM], currency: "USD" },
                session: stripeSession(sessionOverrides),
            }),
            (error) => error?.code === "STRIPE_SUBTOTAL_MISMATCH"
        );
    });
}

test("matching subtotal with a higher total fails closed", () => {
    assert.throws(
        () => checkoutFulfillment.verifyStripeCheckoutFinancials?.({
            order: { cartItems: [JAGUAR_ITEM], currency: "USD" },
            session: stripeSession({ amount_total: 11000 }),
        }),
        (error) => error?.code === "STRIPE_TOTAL_MISMATCH"
    );
});

test("Stripe currency mismatch fails closed", () => {
    assert.throws(
        () => checkoutFulfillment.verifyStripeCheckoutFinancials?.({
            order: { cartItems: [JAGUAR_ITEM], currency: "USD" },
            session: stripeSession({ currency: "cad" }),
        }),
        (error) => error?.code === "STRIPE_CURRENCY_MISMATCH"
    );
});

test("missing Stripe amount fails closed", () => {
    assert.throws(
        () => checkoutFulfillment.verifyStripeCheckoutFinancials?.({
            order: { cartItems: [JAGUAR_ITEM], currency: "USD" },
            session: stripeSession({ amount_total: null }),
        }),
        (error) => error?.code === "STRIPE_AMOUNT_MISSING"
    );
});

for (const [name, item, reasonCode] of [
    ["non-integer amountCents", { ...JAGUAR_ITEM, amountCents: 100.5 }, "INVALID_ORDER_ITEM_AMOUNT"],
    ["unitPrice with fractional cents", {
        productId: "legacy",
        unitPrice: 19.999,
        quantity: 1,
    }, "INVALID_ORDER_ITEM_AMOUNT"],
    ["zero quantity", { ...JAGUAR_ITEM, quantity: 0 }, "INVALID_ORDER_ITEM_QUANTITY"],
    ["fractional quantity", { ...JAGUAR_ITEM, quantity: 1.5 }, "INVALID_ORDER_ITEM_QUANTITY"],
]) {
    test(`malformed stored snapshot rejects ${name}`, () => {
        assert.throws(
            () => checkoutFulfillment.verifyStripeCheckoutFinancials?.({
                order: { cartItems: [item], currency: "USD" },
                session: stripeSession(),
            }),
            (error) => error?.code === reasonCode
        );
    });
}

test("stored item currencies must agree and remain USD", () => {
    assert.throws(
        () => checkoutFulfillment.verifyStripeCheckoutFinancials?.({
            order: {
                cartItems: [JAGUAR_ITEM, { ...JAGUAR_ITEM, currency: "cad" }],
                currency: "USD",
            },
            session: stripeSession({ amount_subtotal: 20000, amount_total: 20000 }),
        }),
        (error) => error?.code === "INVALID_ORDER_CURRENCY"
    );

    assert.throws(
        () => checkoutFulfillment.verifyStripeCheckoutFinancials?.({
            order: {
                cartItems: [{ ...JAGUAR_ITEM, currency: "cad" }],
                currency: "CAD",
            },
            session: stripeSession({ currency: "cad" }),
        }),
        (error) => error?.code === "UNSUPPORTED_ORDER_CURRENCY"
    );
});

test("a verified paid event atomically performs the existing paid transition", async () => {
    const harness = transactionHarness({
        cartItems: [JAGUAR_ITEM],
        currency: "USD",
        status: "pending",
        paymentStatus: "pending",
    });
    const timestamp = { serverTimestamp: true };

    const result = await checkoutFulfillment.applyPaidStripeOrderTransition?.({
        ...harness,
        session: stripeSession(),
        serverTimestamp: () => timestamp,
    });

    assert.deepEqual(result, {
        alreadyPaid: false,
        expectedAmountCents: 10000,
        expectedCurrency: "usd",
    });
    assert.equal(harness.writes.length, 1);
    assert.equal(harness.writes[0][0], harness.orderRef);
    assert.equal(harness.writes[0][2].merge, true);
    assert.equal(harness.writes[0][1].status, "paid");
    assert.equal(harness.writes[0][1].paymentStatus, "paid");
    assert.equal(harness.writes[0][1].paidAt, timestamp);
    assert.equal(harness.writes[0][1].updatedAt, timestamp);
});

test("a duplicate valid webhook is idempotent and does not rewrite paidAt", async () => {
    const originalPaidAt = { seconds: 123 };
    const harness = transactionHarness({
        cartItems: [JAGUAR_ITEM],
        currency: "USD",
        status: "paid",
        paymentStatus: "paid",
        paidAt: originalPaidAt,
    });

    const result = await checkoutFulfillment.applyPaidStripeOrderTransition?.({
        ...harness,
        session: stripeSession(),
        serverTimestamp: () => ({ replacement: true }),
    });

    assert.equal(result.alreadyPaid, true);
    assert.equal(harness.writes.length, 0);
});

test("a mismatched webhook performs no fulfillment write", async () => {
    const harness = transactionHarness({
        cartItems: [JAGUAR_ITEM],
        currency: "USD",
        status: "pending",
        paymentStatus: "pending",
    });

    await assert.rejects(
        () => checkoutFulfillment.applyPaidStripeOrderTransition?.({
            ...harness,
            session: stripeSession({ amount_total: 5000 }),
            serverTimestamp: () => ({ serverTimestamp: true }),
        }),
        (error) => error?.code === "STRIPE_TOTAL_MISMATCH"
    );
    assert.equal(harness.writes.length, 0);
});

test("invalid Stripe signatures remain denied by constructEvent", () => {
    const signatureError = new Error("No signatures found matching the expected signature");
    const calls = [];
    const stripe = {
        webhooks: {
            constructEvent: (...args) => {
                calls.push(args);
                throw signatureError;
            },
        },
    };
    const rawBody = Buffer.from("signed body");

    assert.throws(
        () => checkoutFulfillment.constructStripeWebhookEvent?.({
            stripe,
            rawBody,
            signature: "t=1,v1=invalid",
            webhookSecret: "whsec_test",
        }),
        (error) => error === signatureError
    );
    assert.deepEqual(calls, [[rawBody, "t=1,v1=invalid", "whsec_test"]]);
});

test("financial verification failures produce a bounded structured log payload", () => {
    let failure;
    try {
        checkoutFulfillment.verifyStripeCheckoutFinancials?.({
            order: { cartItems: [JAGUAR_ITEM], currency: "USD" },
            session: stripeSession({ amount_total: 5000 }),
        });
    } catch (error) {
        failure = error;
    }

    assert.deepEqual(
        checkoutFulfillment.buildStripeFinancialVerificationLog?.({
            error: failure,
            eventId: "evt_test_mismatch",
            orderId: "order_test",
            session: stripeSession({ amount_total: 5000 }),
        }),
        {
            eventId: "evt_test_mismatch",
            orderId: "order_test",
            reasonCode: "STRIPE_TOTAL_MISMATCH",
            expectedAmountCents: 10000,
            stripeAmountSubtotal: 10000,
            stripeAmountTotal: 5000,
            expectedCurrency: "usd",
            stripeCurrency: "usd",
        }
    );
});

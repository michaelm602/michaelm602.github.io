"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildPublicOrderStatus,
    isValidOrderId,
} = require("./orderStatus");

test("order IDs must match Firestore auto-ID shape", () => {
    assert.equal(isValidOrderId("AbCdEfGhIjKlMnOpQr12"), true);
    assert.equal(isValidOrderId("short"), false);
    assert.equal(isValidOrderId("../orders/another"), false);
    assert.equal(isValidOrderId(null), false);
});

test("public status exposes only fixed safe confirmation fields", () => {
    const result = buildPublicOrderStatus({
        status: "paid",
        paymentStatus: "paid",
        buyerInfo: { name: "Private Name", email: "private@example.com" },
        stripeSessionId: "private-session",
        stripePaymentIntentId: "private-intent",
        customerEmailSent: true,
        cartItems: [{ title: "Private order item" }],
        orderTotal: 400,
    });

    assert.deepEqual(result, {
        exists: true,
        status: "paid",
        paymentStatus: "paid",
        confirmed: true,
        confirmationState: "confirmed",
    });
});

test("unknown internal states are not reflected to the browser", () => {
    assert.deepEqual(
        buildPublicOrderStatus({
            status: "internal_review",
            paymentStatus: "processor_hold",
        }),
        {
            exists: true,
            status: null,
            paymentStatus: null,
            confirmed: false,
            confirmationState: "processing",
        }
    );
});

test("missing and cancelled orders return minimal safe states", () => {
    assert.deepEqual(buildPublicOrderStatus(null), {
        exists: false,
        status: null,
        paymentStatus: null,
        confirmed: false,
        confirmationState: "not_found",
    });

    assert.deepEqual(
        buildPublicOrderStatus({
            status: "cancelled",
            paymentStatus: "expired",
        }),
        {
            exists: true,
            status: "cancelled",
            paymentStatus: "expired",
            confirmed: false,
            confirmationState: "cancelled",
        }
    );
});

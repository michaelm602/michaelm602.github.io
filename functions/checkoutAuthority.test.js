"use strict";
/* global require */

const test = require("node:test");
const assert = require("node:assert/strict");

const { CheckoutShadowError } = require("./firestoreCheckoutShadow");

let checkoutAuthority = {};
try {
    checkoutAuthority = require("./checkoutAuthority");
} catch {
    // The first TDD run intentionally exercises the missing implementation.
}

const VERIFIED_JAGUAR = Object.freeze({
    productId: "the-jaguars-bloodline",
    title: "The Jaguar’s Bloodline",
    optionId: "16x20",
    label: "16x20",
    stripePriceId: "price_1UN3vuJEVsglohuhrE9SbhCZ",
    stripeProductId: "prod_VNpbmg8RMbqhZ2",
    amountCents: 10000,
    currency: "usd",
    quantity: 1,
    firestoreVersion: "2026-10-05T17:37:28.000Z",
});

const ITEMS = Object.freeze([
    Object.freeze({
        productId: "the-jaguars-bloodline",
        size: "16x20",
        quantity: 1,
    }),
]);

test("Firestore is the default authority and produces an immutable verified order snapshot", async () => {
    const logs = [];
    let legacyCalls = 0;

    const result = await checkoutAuthority.resolveCheckoutAuthority?.({
        items: ITEMS,
        stripe: {},
        store: {},
        expectedLivemode: true,
        buildLegacyCheckout: async () => {
            legacyCalls += 1;
            throw new Error("legacy must not run");
        },
        resolveFirestoreCheckout: async () => [VERIFIED_JAGUAR],
        logger: { info: (_message, details) => logs.push(details) },
    });

    assert.equal(legacyCalls, 0);
    assert.deepEqual(result, {
        resolverMode: "firestore",
        lineItems: [{ price: VERIFIED_JAGUAR.stripePriceId, quantity: 1 }],
        cartItems: [{
            ...VERIFIED_JAGUAR,
            size: "16x20",
            unitPrice: 100,
        }],
        orderTotal: 100,
        orderTotalCents: 10000,
        currency: "USD",
    });
    assert.deepEqual(logs, [{
        resolverMode: "firestore",
        status: "AUTHORIZED",
        reasonCode: null,
        itemCount: 1,
        productIds: ["the-jaguars-bloodline"],
    }]);
});

test("Firestore denial fails the whole request without calling the legacy resolver", async () => {
    const denial = new CheckoutShadowError("PRODUCT_UNAVAILABLE", "hidden");
    const logs = [];
    let legacyCalls = 0;

    await assert.rejects(
        () => checkoutAuthority.resolveCheckoutAuthority?.({
            items: ITEMS,
            stripe: {},
            store: {},
            expectedLivemode: true,
            buildLegacyCheckout: async () => {
                legacyCalls += 1;
                return { lineItems: [] };
            },
            resolveFirestoreCheckout: async () => { throw denial; },
            logger: { warn: (_message, details) => logs.push(details) },
        }),
        (error) => error === denial
    );

    assert.equal(legacyCalls, 0);
    assert.deepEqual(logs, [{
        resolverMode: "firestore",
        status: "DENIED",
        reasonCode: "PRODUCT_UNAVAILABLE",
        itemCount: 1,
        productIds: ["the-jaguars-bloodline"],
    }]);
});

test("legacy mode is an explicit whole-cart rollback and never invokes Firestore", async () => {
    const legacyCheckout = {
        lineItems: [{ price: VERIFIED_JAGUAR.stripePriceId, quantity: 1 }],
        cartItems: [{
            productId: VERIFIED_JAGUAR.productId,
            title: VERIFIED_JAGUAR.title,
            size: "16x20",
            quantity: 1,
            unitPrice: 100,
            image: null,
        }],
        orderTotal: 100,
        currency: "USD",
    };
    let firestoreCalls = 0;

    const result = await checkoutAuthority.resolveCheckoutAuthority?.({
        resolverMode: "legacy",
        items: ITEMS,
        stripe: {},
        store: {},
        expectedLivemode: true,
        buildLegacyCheckout: async () => legacyCheckout,
        resolveFirestoreCheckout: async () => {
            firestoreCalls += 1;
            throw new Error("Firestore must not run");
        },
    });

    assert.equal(firestoreCalls, 0);
    assert.deepEqual(result, {
        ...legacyCheckout,
        resolverMode: "legacy",
        orderTotalCents: 10000,
    });
});

test("invalid resolver modes fail closed without invoking either authority", async () => {
    let calls = 0;
    await assert.rejects(
        () => checkoutAuthority.resolveCheckoutAuthority?.({
            resolverMode: "automatic-fallback",
            items: ITEMS,
            buildLegacyCheckout: async () => { calls += 1; },
            resolveFirestoreCheckout: async () => { calls += 1; },
        }),
        (error) => error?.code === "INVALID_RESOLVER_MODE"
    );
    assert.equal(calls, 0);
});

test("all modes reject browser-supplied trusted fields", async () => {
    let calls = 0;
    await assert.rejects(
        () => checkoutAuthority.resolveCheckoutAuthority?.({
            resolverMode: "legacy",
            items: [{ ...ITEMS[0], amount: 1, stripePriceId: "price_fake" }],
            buildLegacyCheckout: async () => { calls += 1; },
            resolveFirestoreCheckout: async () => { calls += 1; },
        }),
        (error) => error?.code === "INVALID_INPUT"
    );
    assert.equal(calls, 0);
});

test("checkout redirects are derived from fixed production and existing development origins", () => {
    assert.deepEqual(
        checkoutAuthority.buildCheckoutRedirectUrls?.({ requestOrigin: "https://attacker.example" }),
        {
            successUrl: "https://www.likwitblvd.com/success?status=success&provider=stripe",
            cancelUrl: "https://www.likwitblvd.com/cancel?status=cancel&provider=stripe",
        }
    );
    assert.deepEqual(
        checkoutAuthority.buildCheckoutRedirectUrls?.({ requestOrigin: "http://localhost:5173" }),
        {
            successUrl: "http://localhost:5173/success?status=success&provider=stripe",
            cancelUrl: "http://localhost:5173/cancel?status=cancel&provider=stripe",
        }
    );
});

test("Firestore authority errors map to one generic client response", () => {
    assert.deepEqual(
        checkoutAuthority.toCheckoutClientError?.(
            new CheckoutShadowError("AMOUNT_MISMATCH", "internal details")
        ),
        {
            statusCode: 400,
            message: "Checkout is unavailable for one or more selected items.",
        }
    );
    assert.deepEqual(
        checkoutAuthority.toCheckoutClientError?.(new Error("database details")),
        {
            statusCode: 500,
            message: "Checkout is temporarily unavailable. Please try again.",
        }
    );
});

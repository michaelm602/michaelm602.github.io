"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    MAX_ITEM_QUANTITY,
    STRIPE_CATALOG,
    CheckoutConfigurationError,
    CheckoutInputError,
    buildTrustedCheckout,
    getStripeModeFromSecret,
    validateAndAggregateItems,
} = require("./stripeCatalog");

function stripeWithPrices(overrides = {}) {
    return {
        prices: {
            retrieve: async (priceId) => ({
                id: priceId,
                active: true,
                type: "one_time",
                currency: "usd",
                unit_amount: 12500,
                livemode: false,
                ...overrides,
            }),
        },
    };
}

test("server catalog stays synchronized with the storefront compatibility catalog", async () => {
    const { getAllProducts } = await import("../src/data/products.js");
    const storefrontCatalog = Object.fromEntries(
        getAllProducts().map((product) => [
            product.id,
            {
                title: product.title,
                sizes: Object.fromEntries(
                    product.sizes.map((size) => [size.label, size.stripePriceId])
                ),
            },
        ])
    );

    assert.deepEqual(STRIPE_CATALOG, storefrontCatalog);
});

test("trusted checkout ignores browser prices, totals, titles, and Stripe IDs", async () => {
    const productId = "serenity";
    const size = "16x20";
    const trustedPriceId = STRIPE_CATALOG[productId].sizes[size];

    const result = await buildTrustedCheckout({
        items: [
            {
                productId,
                size,
                quantity: 2,
                title: "Attacker-controlled title",
                price: "price_attacker_controlled",
                unitPrice: 0.01,
                orderTotal: 0.02,
            },
        ],
        stripe: stripeWithPrices(),
        expectedLivemode: false,
        orderTotal: 0.02,
    });

    assert.deepEqual(result.lineItems, [{ price: trustedPriceId, quantity: 2 }]);
    assert.deepEqual(result.cartItems, [
        {
            productId,
            title: "Serenity",
            size,
            quantity: 2,
            unitPrice: 125,
            image: null,
        },
    ]);
    assert.equal(result.orderTotal, 250);
    assert.equal(result.currency, "USD");
});

test("Echoes of the 5th Sun resolves only its trusted synced print Prices", async () => {
    const productId = "echoes-of-the-5th-sun";
    const trustedPrices = {
        "16x20": { id: "price_1UEGj1JEVsglohuhyvEXeQBY", unitAmount: 10000 },
        "18x24": { id: "price_1UEGj1JEVsglohuhnWpU3t8o", unitAmount: 20000 },
        "24x36": { id: "price_1UEGj2JEVsglohuhKglFY2SV", unitAmount: 30000 },
        "30x40": { id: "price_1UEGj3JEVsglohuhVlFYwsc8", unitAmount: 40000 },
    };

    assert.deepEqual(STRIPE_CATALOG[productId], {
        title: "Echoes of the 5th Sun",
        sizes: Object.fromEntries(
            Object.entries(trustedPrices).map(([size, price]) => [size, price.id])
        ),
    });

    const result = await buildTrustedCheckout({
        items: Object.keys(trustedPrices).map((size) => ({ productId, size, quantity: 1 })),
        stripe: {
            prices: {
                retrieve: async (priceId) => {
                    const trustedPrice = Object.values(trustedPrices).find(
                        (price) => price.id === priceId
                    );
                    return {
                        id: priceId,
                        active: true,
                        type: "one_time",
                        currency: "usd",
                        unit_amount: trustedPrice?.unitAmount,
                        livemode: true,
                    };
                },
            },
        },
        expectedLivemode: true,
    });

    assert.deepEqual(
        result.lineItems,
        Object.values(trustedPrices).map((price) => ({ price: price.id, quantity: 1 }))
    );
    assert.equal(result.orderTotal, 1000);
    assert.equal(result.currency, "USD");
});

test("unknown products and sizes are rejected before Stripe lookup", () => {
    assert.throws(
        () =>
            validateAndAggregateItems([
                { productId: "not-a-product", size: "16x20", quantity: 1 },
            ]),
        CheckoutInputError
    );

    assert.throws(
        () =>
            validateAndAggregateItems([
                { productId: "serenity", size: "not-a-size", quantity: 1 },
            ]),
        CheckoutInputError
    );
});

test("quantities must be bounded positive integers, including duplicate lines", () => {
    for (const quantity of [0, -1, 1.5, "2", Number.NaN]) {
        assert.throws(
            () =>
                validateAndAggregateItems([
                    { productId: "serenity", size: "16x20", quantity },
                ]),
            CheckoutInputError
        );
    }

    assert.throws(
        () =>
            validateAndAggregateItems([
                {
                    productId: "serenity",
                    size: "16x20",
                    quantity: MAX_ITEM_QUANTITY,
                },
                { productId: "serenity", size: "16x20", quantity: 1 },
            ]),
        CheckoutInputError
    );
});

test("inactive, recurring, wrong-currency, or malformed trusted Prices fail closed", async () => {
    const items = [{ productId: "serenity", size: "16x20", quantity: 1 }];
    const invalidPrices = [
        { active: false },
        { type: "recurring" },
        { currency: "eur" },
        { unit_amount: null },
        { id: "price_wrong" },
    ];

    for (const override of invalidPrices) {
        await assert.rejects(
            () =>
                buildTrustedCheckout({
                    items,
                    stripe: stripeWithPrices(override),
                    expectedLivemode: false,
                }),
            CheckoutConfigurationError
        );
    }
});

test("Stripe secret mode is detected without exposing or storing the key", () => {
    assert.equal(getStripeModeFromSecret("sk_" + "live_example"), "live");
    assert.equal(getStripeModeFromSecret("sk_" + "test_example"), "test");
    assert.equal(getStripeModeFromSecret("pk_" + "test_example"), null);
    assert.equal(getStripeModeFromSecret(null), null);
});

test("trusted Prices must match the mode detected from the secret key", async () => {
    const items = [{ productId: "serenity", size: "16x20", quantity: 1 }];

    await assert.rejects(
        () =>
            buildTrustedCheckout({
                items,
                stripe: stripeWithPrices({ livemode: false }),
                expectedLivemode: true,
            }),
        (error) => {
            assert.ok(error instanceof CheckoutConfigurationError);
            assert.equal(error.details.expectedMode, "live");
            assert.equal(error.details.priceMode, "test");
            return true;
        }
    );

    await assert.doesNotReject(() =>
        buildTrustedCheckout({
            items,
            stripe: stripeWithPrices({ livemode: true }),
            expectedLivemode: true,
        })
    );
});

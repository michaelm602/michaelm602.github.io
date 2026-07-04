"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    MAX_ITEM_QUANTITY,
    STRIPE_CATALOG,
    CheckoutConfigurationError,
    CheckoutInputError,
    buildTrustedCheckout,
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
                ...overrides,
            }),
        },
    };
}

test("server catalog stays synchronized with the storefront catalog", async () => {
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
            () => buildTrustedCheckout({ items, stripe: stripeWithPrices(override) }),
            CheckoutConfigurationError
        );
    }
});

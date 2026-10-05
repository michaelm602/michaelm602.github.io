"use strict";
/* global require */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    STRIPE_CATALOG,
    buildTrustedCheckout,
} = require("./stripeCatalog");
const {
    CheckoutShadowError,
    SHADOW_PARITY_STATUS,
    compareCheckoutCatalogs,
    createFirestoreCheckoutShadowStore,
    resolveFirestoreCheckoutShadow,
    resolveLegacyCheckoutWithShadow,
} = require("./firestoreCheckoutShadow");

const PRICE_IDS = Object.freeze({
    "echoes-of-the-5th-sun": Object.freeze({
        "16x20": "price_1UEGj1JEVsglohuhyvEXeQBY",
        "18x24": "price_1UEGj1JEVsglohuhnWpU3t8o",
        "24x36": "price_1UEGj2JEVsglohuhKglFY2SV",
        "30x40": "price_1UEGj3JEVsglohuhVlFYwsc8",
    }),
    "the-jaguars-bloodline": Object.freeze({
        "16x20": "price_1UN3vuJEVsglohuhrE9SbhCZ",
        "18x24": "price_1UN3vvJEVsglohuhhyCLPnlF",
        "24x36": "price_1UN3vvJEVsglohuhaWtA0Sra",
        "30x40": "price_1UN3vvJEVsglohuhVCdr55Rj",
    }),
});

const AMOUNTS = Object.freeze({
    "16x20": 10000,
    "18x24": 20000,
    "24x36": 30000,
    "30x40": 40000,
});

function clone(value) {
    return structuredClone(value);
}

function productDocument(productId = "echoes-of-the-5th-sun") {
    const title = productId === "the-jaguars-bloodline"
        ? "The Jaguar’s Bloodline"
        : "Echoes of the 5th Sun";
    return {
        id: productId,
        title,
        active: true,
        archivedAt: null,
        channels: { shop: true, portfolio: true },
        prints: {
            available: true,
            defaultOptionId: "16x20",
            options: Object.entries(PRICE_IDS[productId]).map(([size, stripePriceId], index) => ({
                id: size,
                label: size,
                amountCents: AMOUNTS[size],
                currency: "usd",
                stripePriceId,
                active: true,
                sortOrder: index,
            })),
        },
    };
}

function stripeProduct(productId) {
    return {
        id: `prod_${productId.replaceAll("-", "_")}`,
        object: "product",
        active: true,
        deleted: false,
        livemode: true,
        metadata: {
            source: "likwit_admin_price_sync",
            canonical_product: "true",
            firestore_product_id: productId,
        },
    };
}

function stripePrice(productId, size, overrides = {}) {
    const product = stripeProduct(productId);
    return {
        id: PRICE_IDS[productId][size],
        object: "price",
        active: true,
        type: "one_time",
        billing_scheme: "per_unit",
        unit_amount: AMOUNTS[size],
        currency: "usd",
        livemode: true,
        product,
        metadata: {
            source: "likwit_admin_price_sync",
            firestore_product_id: productId,
            print_option_id: size,
        },
        ...overrides,
    };
}

function createStore(products, { secondReads = {}, mappings = {} } = {}) {
    const reads = new Map();
    const calls = { products: [], mappings: [] };
    return {
        calls,
        async getProduct(productId) {
            calls.products.push(productId);
            const count = (reads.get(productId) || 0) + 1;
            reads.set(productId, count);
            const value = count > 1 && secondReads[productId]
                ? secondReads[productId]
                : products[productId];
            if (!value) return null;
            return {
                id: productId,
                data: clone(value),
                version: `version-${productId}-${count}`,
            };
        },
        async getProductMapping(productId) {
            calls.mappings.push(productId);
            const stripeProductId = mappings[productId] || stripeProduct(productId).id;
            return stripeProductId ? { productId, stripeProductId } : null;
        },
    };
}

function createStripe(prices) {
    const calls = { priceRetrieves: [], productRetrieves: [] };
    return {
        calls,
        prices: {
            async retrieve(priceId, params) {
                calls.priceRetrieves.push({ priceId, params });
                const price = prices[priceId];
                if (!price) throw Object.assign(new Error("No such price"), { code: "resource_missing" });
                return clone(price);
            },
        },
        products: {
            async retrieve(productId) {
                calls.productRetrieves.push(productId);
                const price = Object.values(prices).find((candidate) => {
                    const candidateProductId = typeof candidate.product === "string"
                        ? candidate.product
                        : candidate.product?.id;
                    return candidateProductId === productId;
                });
                if (!price || typeof price.product === "string") {
                    throw Object.assign(new Error("No such product"), { code: "resource_missing" });
                }
                return clone(price.product);
            },
        },
    };
}

function fixture(productIds = ["echoes-of-the-5th-sun"]) {
    const products = Object.fromEntries(productIds.map((productId) => [productId, productDocument(productId)]));
    const prices = {};
    for (const productId of productIds) {
        for (const size of Object.keys(PRICE_IDS[productId])) {
            prices[PRICE_IDS[productId][size]] = stripePrice(productId, size);
        }
    }
    return { products, prices };
}

async function resolve({
    productId = "echoes-of-the-5th-sun",
    size = "16x20",
    quantity = 1,
    product,
    price,
    storeOptions,
    expectedLivemode = true,
    items,
} = {}) {
    const products = { [productId]: product || productDocument(productId) };
    const resolvedPrice = price || stripePrice(productId, size);
    return resolveFirestoreCheckoutShadow({
        items: items || [{ productId, size, quantity }],
        store: createStore(products, storeOptions),
        stripe: createStripe({ [resolvedPrice.id]: resolvedPrice }),
        expectedLivemode,
    });
}

async function rejectionCode(run) {
    try {
        await run();
        assert.fail("Expected checkout shadow resolution to reject.");
    } catch (error) {
        assert.ok(error instanceof CheckoutShadowError);
        return error.code;
    }
}

test("Firestore checkout shadow rejects unavailable products before Stripe lookup", async (t) => {
    const cases = [
        ["nonexistent product", null, "PRODUCT_NOT_FOUND"],
        ["inactive product", { active: false }, "PRODUCT_UNAVAILABLE"],
        ["archived product", { active: false, archivedAt: "2026-10-01T00:00:00.000Z" }, "PRODUCT_UNAVAILABLE"],
        ["Shop-off product", { channels: { shop: false, portfolio: true } }, "PRODUCT_UNAVAILABLE"],
        ["prints unavailable", { prints: { ...productDocument().prints, available: false } }, "PRINTS_UNAVAILABLE"],
    ];

    for (const [name, patch, expectedCode] of cases) {
        await t.test(name, async () => {
            const product = patch === null ? null : { ...productDocument(), ...patch };
            const store = createStore(product ? { "echoes-of-the-5th-sun": product } : {});
            const stripe = createStripe({});
            const code = await rejectionCode(() => resolveFirestoreCheckoutShadow({
                items: [{ productId: "echoes-of-the-5th-sun", size: "16x20", quantity: 1 }],
                store,
                stripe,
                expectedLivemode: true,
            }));
            assert.equal(code, expectedCode);
            assert.equal(stripe.calls.priceRetrieves.length, 0);
        });
    }
});

test("Firestore checkout shadow rejects inactive, missing, ambiguous, and malformed options", async (t) => {
    const base = productDocument();
    const cases = [
        ["inactive option", { ...base.prints.options[0], active: false }, "OPTION_UNAVAILABLE", "16x20"],
        ["fake option", null, "OPTION_NOT_FOUND", "not-a-size"],
        ["malformed Price ID", { ...base.prints.options[0], stripePriceId: "not-a-price" }, "INVALID_OPTION", "16x20"],
    ];

    for (const [name, replacement, expectedCode, size] of cases) {
        await t.test(name, async () => {
            const product = clone(base);
            if (replacement) product.prints.options[0] = replacement;
            const code = await rejectionCode(() => resolve({ product, size }));
            assert.equal(code, expectedCode);
        });
    }

    const duplicateLabelProduct = clone(base);
    duplicateLabelProduct.prints.options[0].id = "small-a";
    duplicateLabelProduct.prints.options[1] = {
        ...duplicateLabelProduct.prints.options[1],
        id: "small-b",
        label: "16x20",
    };
    assert.equal(
        await rejectionCode(() => resolve({ product: duplicateLabelProduct, size: "16x20" })),
        "OPTION_AMBIGUOUS"
    );
});

test("Firestore checkout shadow requires exact line-item fields and bounded aggregate quantities", async () => {
    assert.equal(
        await rejectionCode(() => resolve({
            items: [{
                productId: "echoes-of-the-5th-sun",
                size: "16x20",
                quantity: 1,
                price: 1,
            }],
        })),
        "INVALID_INPUT"
    );

    assert.equal(
        await rejectionCode(() => resolve({
            items: [
                { productId: "echoes-of-the-5th-sun", size: "16x20", quantity: 10 },
                { productId: "echoes-of-the-5th-sun", size: "16x20", quantity: 1 },
            ],
        })),
        "INVALID_INPUT"
    );
});

test("Firestore checkout shadow fails closed for invalid Stripe Price state", async (t) => {
    const cases = [
        ["inactive Price", { active: false }, "STRIPE_PRICE_INVALID"],
        ["recurring Price", { type: "recurring" }, "STRIPE_PRICE_INVALID"],
        ["amount mismatch", { unit_amount: 9999 }, "STRIPE_PRICE_INVALID"],
        ["currency mismatch", { currency: "cad" }, "STRIPE_PRICE_INVALID"],
        ["wrong livemode", { livemode: false }, "STRIPE_PRICE_INVALID"],
    ];

    for (const [name, override, expectedCode] of cases) {
        await t.test(name, async () => {
            const code = await rejectionCode(() => resolve({
                price: stripePrice("echoes-of-the-5th-sun", "16x20", override),
            }));
            assert.equal(code, expectedCode);
        });
    }
});

test("Firestore checkout shadow verifies expanded Stripe Product state and canonical mapping", async (t) => {
    const productId = "echoes-of-the-5th-sun";
    const cases = [
        ["missing Product", { product: null }, {}, "STRIPE_PRODUCT_INVALID"],
        ["deleted Product", { product: { ...stripeProduct(productId), deleted: true } }, {}, "STRIPE_PRODUCT_INVALID"],
        ["inactive Product", { product: { ...stripeProduct(productId), active: false } }, {}, "STRIPE_PRODUCT_INVALID"],
        ["wrong Product mode", { product: { ...stripeProduct(productId), livemode: false } }, {}, "STRIPE_PRODUCT_INVALID"],
        ["mapping mismatch", {}, { mappings: { [productId]: "prod_someone_else" } }, "STRIPE_PRODUCT_MISMATCH"],
    ];

    for (const [name, override, storeOptions, expectedCode] of cases) {
        await t.test(name, async () => {
            const code = await rejectionCode(() => resolve({
                price: stripePrice(productId, "16x20", override),
                storeOptions,
            }));
            assert.equal(code, expectedCode);
        });
    }
});

test("sync-managed Stripe metadata must match when present while legacy metadata may be absent", async () => {
    const productId = "echoes-of-the-5th-sun";
    const mismatched = stripePrice(productId, "16x20");
    mismatched.metadata.firestore_product_id = "wrong-product";
    assert.equal(
        await rejectionCode(() => resolve({ price: mismatched })),
        "STRIPE_METADATA_MISMATCH"
    );

    const legacy = stripePrice(productId, "16x20", {
        metadata: {},
        product: { ...stripeProduct(productId), metadata: {} },
    });
    await assert.doesNotReject(() => resolve({ price: legacy }));

    const syncedPriceOnLegacyProduct = stripePrice(productId, "16x20", {
        product: { ...stripeProduct(productId), metadata: {} },
    });
    await assert.doesNotReject(() => resolve({ price: syncedPriceOnLegacyProduct }));
});

test("Firestore checkout shadow rejects a checkout-relevant product change during Stripe verification", async () => {
    const initial = productDocument();
    const changed = clone(initial);
    changed.prints.options[0].stripePriceId = "price_changed_during_verification";
    const code = await rejectionCode(() => resolve({
        product: initial,
        storeOptions: {
            secondReads: { "echoes-of-the-5th-sun": changed },
        },
    }));
    assert.equal(code, "STALE_PRODUCT");
});

test("Firestore checkout shadow resolves legacy labels, aggregates duplicates, and reads each product directly", async () => {
    const product = productDocument();
    product.prints.options[0].id = "small-print";
    const store = createStore({ "echoes-of-the-5th-sun": product });
    const price = stripePrice("echoes-of-the-5th-sun", "16x20", {
        metadata: {
            source: "likwit_admin_price_sync",
            firestore_product_id: "echoes-of-the-5th-sun",
            print_option_id: "small-print",
        },
    });
    const stripe = createStripe({ [price.id]: price });
    const result = await resolveFirestoreCheckoutShadow({
        items: [
            { productId: "echoes-of-the-5th-sun", size: "16x20", quantity: 1 },
            { productId: "echoes-of-the-5th-sun", size: "16x20", quantity: 2 },
        ],
        store,
        stripe,
        expectedLivemode: true,
    });

    assert.deepEqual(result, [{
        productId: "echoes-of-the-5th-sun",
        title: "Echoes of the 5th Sun",
        optionId: "small-print",
        label: "16x20",
        stripePriceId: PRICE_IDS["echoes-of-the-5th-sun"]["16x20"],
        stripeProductId: stripeProduct("echoes-of-the-5th-sun").id,
        amountCents: 10000,
        currency: "usd",
        quantity: 3,
        firestoreVersion: "version-echoes-of-the-5th-sun-1",
    }]);
    assert.deepEqual(store.calls.products, [
        "echoes-of-the-5th-sun",
        "echoes-of-the-5th-sun",
    ]);
    assert.deepEqual(store.calls.mappings, ["echoes-of-the-5th-sun"]);
    assert.equal(stripe.calls.priceRetrieves.length, 1);
    assert.deepEqual(stripe.calls.priceRetrieves[0].params, { expand: ["product"] });
});

test("whole-cart shadow resolution fails when any one line is invalid", async () => {
    const { products, prices } = fixture([
        "echoes-of-the-5th-sun",
        "the-jaguars-bloodline",
    ]);
    await assert.rejects(
        () => resolveFirestoreCheckoutShadow({
            items: [
                { productId: "echoes-of-the-5th-sun", size: "16x20", quantity: 1 },
                { productId: "the-jaguars-bloodline", size: "fake-size", quantity: 1 },
            ],
            store: createStore(products),
            stripe: createStripe(prices),
            expectedLivemode: true,
        }),
        (error) => error instanceof CheckoutShadowError && error.code === "OPTION_NOT_FOUND"
    );
});

for (const [productId, displayName] of [
    ["echoes-of-the-5th-sun", "Echoes"],
    ["the-jaguars-bloodline", "Jaguar"],
]) {
    test(`${displayName} legacy and Firestore checkout resolutions match for all four print sizes`, async () => {
        const { products, prices } = fixture([productId]);
        const items = Object.keys(PRICE_IDS[productId]).map((size) => ({ productId, size, quantity: 1 }));
        const stripe = createStripe(prices);
        const legacy = await buildTrustedCheckout({ items, stripe, expectedLivemode: true });
        const shadow = await resolveFirestoreCheckoutShadow({
            items,
            store: createStore(products),
            stripe,
            expectedLivemode: true,
        });

        assert.deepEqual(compareCheckoutCatalogs({ legacyCheckout: legacy, shadowCheckout: shadow }), {
            status: SHADOW_PARITY_STATUS.MATCH,
            reasonCode: null,
        });
        assert.deepEqual(
            shadow.map(({ stripePriceId, amountCents, currency }) => ({ stripePriceId, amountCents, currency })),
            Object.entries(PRICE_IDS[productId]).map(([size, stripePriceId]) => ({
                stripePriceId,
                amountCents: AMOUNTS[size],
                currency: "usd",
            }))
        );
    });
}

test("parity comparison classifies catalog mismatches without returning internal details", () => {
    const legacyCheckout = {
        lineItems: [{ price: "price_legacy", quantity: 1 }],
        cartItems: [{ productId: "art", title: "Art", size: "16x20", quantity: 1, unitPrice: 100, image: null }],
        currency: "USD",
    };
    const baseShadow = [{
        productId: "art",
        title: "Art",
        optionId: "16x20",
        label: "16x20",
        stripePriceId: "price_legacy",
        stripeProductId: "prod_art",
        amountCents: 10000,
        currency: "usd",
        quantity: 1,
        firestoreVersion: "v1",
    }];
    const cases = [
        [SHADOW_PARITY_STATUS.PRODUCT_MISMATCH, [{ ...baseShadow[0], productId: "other" }]],
        [SHADOW_PARITY_STATUS.OPTION_MISMATCH, [{ ...baseShadow[0], optionId: "other", label: "other" }]],
        [SHADOW_PARITY_STATUS.PRICE_ID_MISMATCH, [{ ...baseShadow[0], stripePriceId: "price_other" }]],
        [SHADOW_PARITY_STATUS.AMOUNT_MISMATCH, [{ ...baseShadow[0], amountCents: 9999 }]],
        [SHADOW_PARITY_STATUS.CURRENCY_MISMATCH, [{ ...baseShadow[0], currency: "cad" }]],
    ];
    for (const [status, shadowCheckout] of cases) {
        assert.deepEqual(
            compareCheckoutCatalogs({ legacyCheckout, shadowCheckout }),
            { status, reasonCode: null }
        );
    }
});

test("shadow denial and unexpected errors never replace a successful legacy checkout result", async (t) => {
    const trusted = {
        lineItems: [{ price: "price_legacy", quantity: 1 }],
        cartItems: [{ productId: "art", title: "Art", size: "16x20", quantity: 1, unitPrice: 100, image: null }],
        orderTotal: 100,
        currency: "USD",
    };
    for (const [name, shadowError, expectedStatus] of [
        ["denial", new CheckoutShadowError("PRODUCT_UNAVAILABLE", "hidden"), SHADOW_PARITY_STATUS.FIRESTORE_DENIED],
        ["unexpected error", new Error("database unavailable"), SHADOW_PARITY_STATUS.ERROR],
    ]) {
        await t.test(name, async () => {
            const logs = [];
            const result = await resolveLegacyCheckoutWithShadow({
                items: [{ productId: "art", size: "16x20", quantity: 1 }],
                buildLegacyCheckout: async () => clone(trusted),
                resolveShadowCheckout: async () => { throw shadowError; },
                logger: { info: (_message, details) => logs.push(details) },
            });
            assert.deepEqual(result, trusted);
            assert.equal(logs[0].status, expectedStatus);
            assert.equal(JSON.stringify(logs).includes("database unavailable"), false);
        });
    }
});

test("a stalled shadow resolver times out without blocking the legacy checkout result", async () => {
    const trusted = {
        lineItems: [{ price: "price_legacy", quantity: 1 }],
        cartItems: [{ productId: "art", title: "Art", size: "16x20", quantity: 1, unitPrice: 100, image: null }],
        orderTotal: 100,
        currency: "USD",
    };
    const logs = [];
    const startedAt = Date.now();
    const result = await resolveLegacyCheckoutWithShadow({
        items: [{ productId: "art", size: "16x20", quantity: 1 }],
        buildLegacyCheckout: async () => clone(trusted),
        resolveShadowCheckout: async () => new Promise(() => {}),
        shadowTimeoutMs: 10,
        logger: { info: (_message, details) => logs.push(details) },
    });

    assert.deepEqual(result, trusted);
    assert.equal(logs[0].status, SHADOW_PARITY_STATUS.ERROR);
    assert.ok(Date.now() - startedAt < 500);
});

test("legacy rejection remains authoritative while shadow records LEGACY_DENIED", async () => {
    const legacyError = Object.assign(new Error("legacy rejected"), { statusCode: 400 });
    const logs = [];
    await assert.rejects(
        () => resolveLegacyCheckoutWithShadow({
            items: [{ productId: "art", size: "16x20", quantity: 1 }],
            buildLegacyCheckout: async () => { throw legacyError; },
            resolveShadowCheckout: async () => [{
                productId: "art",
                title: "Art",
                optionId: "16x20",
                label: "16x20",
                stripePriceId: "price_shadow",
                stripeProductId: "prod_art",
                amountCents: 10000,
                currency: "usd",
                quantity: 1,
                firestoreVersion: "v1",
            }],
            logger: { info: (_message, details) => logs.push(details) },
        }),
        (error) => error === legacyError
    );
    assert.equal(logs[0].status, SHADOW_PARITY_STATUS.LEGACY_DENIED);
});

test("Firestore shadow store performs exact document reads and returns update versions", async () => {
    const calls = [];
    const snapshots = {
        "shopProducts/art": {
            exists: true,
            id: "art",
            data: () => ({ id: "art", title: "Art" }),
            updateTime: { toDate: () => new Date("2026-10-05T12:00:00.000Z") },
        },
        "adminStripePrintProductMappings/art": {
            exists: true,
            id: "art",
            data: () => ({ productId: "art", stripeProductId: "prod_art" }),
        },
    };
    const firestore = {
        collection(collectionName) {
            return {
                doc(documentId) {
                    const path = `${collectionName}/${documentId}`;
                    return {
                        async get() {
                            calls.push(path);
                            return snapshots[path] || { exists: false, id: documentId };
                        },
                    };
                },
            };
        },
    };
    const store = createFirestoreCheckoutShadowStore({ firestore });

    assert.deepEqual(await store.getProduct("art"), {
        id: "art",
        data: { id: "art", title: "Art" },
        version: "2026-10-05T12:00:00.000Z",
    });
    assert.deepEqual(await store.getProductMapping("art"), {
        productId: "art",
        stripeProductId: "prod_art",
    });
    assert.deepEqual(calls, [
        "shopProducts/art",
        "adminStripePrintProductMappings/art",
    ]);
});

test("trusted catalogs used by parity fixtures remain the exact production mappings", () => {
    for (const [productId, sizes] of Object.entries(PRICE_IDS)) {
        assert.deepEqual(STRIPE_CATALOG[productId].sizes, sizes);
    }
});

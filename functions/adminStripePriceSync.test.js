"use strict";
/* global require */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    StripePriceSyncError,
    canonicalLookupKeyFor,
    confirmStripePrintPriceSync,
    createMissingStripePrices,
    createFirestoreStripeSyncStore,
    handleAdminStripePrintPriceSync,
    lookupKeyFor,
    previewStripePrintPriceSync,
} = require("./adminStripePriceSync");

function productWithOptions(id = "new-piece") {
    return {
        id,
        title: "New Piece",
        prints: {
            available: false,
            defaultOptionId: null,
            options: [
                { id: "16x20", label: "16x20", amountCents: 10000, currency: "usd", stripePriceId: null, active: false, sortOrder: 0 },
                { id: "18x24", label: "18x24", amountCents: 20000, currency: "usd", stripePriceId: null, active: false, sortOrder: 1 },
            ],
        },
    };
}

function clone(value) {
    return structuredClone(value);
}

function matchesExpectedOptions(product, expectedOptions) {
    if (!Array.isArray(expectedOptions)) return true;
    const options = product.prints.options;
    if (options.length !== expectedOptions.length) return false;
    return expectedOptions.every((expected) => {
        const option = options.find((candidate) => candidate.id === expected.optionId);
        const stripePriceId = typeof option?.stripePriceId === "string" && option.stripePriceId.trim()
            ? option.stripePriceId.trim()
            : null;
        return option
            && option.label === expected.label
            && option.amountCents === expected.amountCents
            && option.currency === expected.currency
            && stripePriceId === expected.stripePriceId;
    });
}

function fakeStore(product) {
    let nextOperation = 1;
    const products = new Map([[product.id, clone(product)]]);
    const operations = new Map();
    const productMappings = new Map();
    const store = {
        productWrites: 0,
        products,
        operations,
        productMappings,
        async getProduct(productId) {
            return clone(products.get(productId) || null);
        },
        async createOperation(record) {
            const id = `operation-${nextOperation++}`;
            operations.set(id, clone(record));
            return id;
        },
        async getOperation(operationId) {
            const operation = operations.get(operationId);
            return operation ? { id: operationId, ...clone(operation) } : null;
        },
        async updateOperation(operationId, patch) {
            operations.set(operationId, { ...operations.get(operationId), ...clone(patch) });
        },
        async claimProductMapping(productId, operationId, proposedStripeProductId = null, expectedOptions = null) {
            if (!matchesExpectedOptions(products.get(productId), expectedOptions)) return { status: "stale" };
            const mapping = productMappings.get(productId) || null;
            if (mapping?.stripeProductId) {
                if (proposedStripeProductId && proposedStripeProductId !== mapping.stripeProductId) {
                    return { status: "conflict", stripeProductId: mapping.stripeProductId };
                }
                return { status: "mapped", stripeProductId: mapping.stripeProductId };
            }
            if (mapping?.claimOperationId && mapping.claimOperationId !== operationId) {
                return { status: "busy" };
            }
            if (proposedStripeProductId) {
                productMappings.set(productId, { stripeProductId: proposedStripeProductId, claimOperationId: null });
                return { status: "mapped", stripeProductId: proposedStripeProductId };
            }
            productMappings.set(productId, { stripeProductId: null, claimOperationId: operationId });
            return { status: "claimed" };
        },
        async finalizeProductMapping(productId, operationId, stripeProductId, expectedOptions = null) {
            if (!matchesExpectedOptions(products.get(productId), expectedOptions)) return { status: "stale" };
            const mapping = productMappings.get(productId) || null;
            if (mapping?.stripeProductId && mapping.stripeProductId !== stripeProductId) {
                return { status: "conflict", stripeProductId: mapping.stripeProductId };
            }
            if (mapping?.claimOperationId && mapping.claimOperationId !== operationId) {
                return { status: "conflict", stripeProductId: mapping.stripeProductId || null };
            }
            productMappings.set(productId, { stripeProductId, claimOperationId: null });
            return { status: "mapped", stripeProductId };
        },
        async releaseProductClaim(productId, operationId) {
            const mapping = productMappings.get(productId);
            if (mapping?.claimOperationId === operationId && !mapping.stripeProductId) {
                productMappings.set(productId, { stripeProductId: null, claimOperationId: null });
            }
        },
        async replacePriceIdsAtomically(productId, expectedOptions, replacements) {
            const current = products.get(productId);
            if (!matchesExpectedOptions(current, expectedOptions)) {
                return { status: "stale", message: "Product print options changed after confirmation." };
            }
            const options = current.prints.options.map((option) => ({ ...option }));
            for (const replacement of replacements) {
                const option = options.find((candidate) => candidate.id === replacement.optionId);
                if (!option) return { status: "stale", message: "A print option no longer exists." };
                option.stripePriceId = replacement.stripePriceId;
            }
            const changed = JSON.stringify(options) !== JSON.stringify(current.prints.options);
            if (changed) {
                current.prints.options = options;
                store.productWrites += 1;
            }
            return { status: changed ? "updated" : "unchanged" };
        },
    };
    return store;
}

function fakeStripe({ failOnceFor = null, priceRetrieveError = null, productCreateGate = null } = {}) {
    let nextProduct = 1;
    let nextPrice = 1;
    let failed = false;
    let currentPriceRetrieveError = priceRetrieveError;
    let currentPriceListErrorFor = null;
    const products = new Map();
    const prices = new Map();
    const lookupKeys = new Map();
    const calls = { productCreates: [], productRetrieves: [], productSearches: [], priceCreates: [], retrieves: [], lists: [] };
    const stripe = {
        calls,
        pricesById: prices,
        products: {
            async search(params) {
                calls.productSearches.push(clone(params));
                const firestoreProductId = /firestore_product_id'\]:'([^']+)'/.exec(params.query)?.[1];
                return {
                    data: [...products.values()]
                        .filter((product) => product.metadata?.source === "likwit_admin_price_sync"
                            && product.metadata?.canonical_product === "true"
                            && product.metadata?.firestore_product_id === firestoreProductId)
                        .map(clone),
                };
            },
            async retrieve(productId) {
                calls.productRetrieves.push(productId);
                const product = products.get(productId);
                if (!product) throw Object.assign(new Error("No such product"), { code: "resource_missing" });
                return clone(product);
            },
            async create(params, options) {
                calls.productCreates.push({ params: clone(params), options: clone(options) });
                if (productCreateGate) {
                    productCreateGate.started();
                    await productCreateGate.wait;
                }
                const product = { id: `prod_${nextProduct++}`, active: true, ...clone(params) };
                products.set(product.id, product);
                return clone(product);
            },
        },
        prices: {
            async retrieve(priceId) {
                calls.retrieves.push(priceId);
                if (currentPriceRetrieveError) throw Object.assign(new Error("Temporary Stripe retrieval failure"), currentPriceRetrieveError);
                const price = prices.get(priceId);
                if (!price) throw Object.assign(new Error("No such price"), { code: "resource_missing" });
                return clone(price);
            },
            async list(params) {
                calls.lists.push(clone(params));
                if (currentPriceListErrorFor === params.lookup_keys[0]) {
                    throw Object.assign(new Error("Temporary Stripe list failure"), { type: "StripeConnectionError" });
                }
                const priceIds = [...(lookupKeys.get(params.lookup_keys[0]) || [])];
                return {
                    data: priceIds
                        .map((priceId) => prices.get(priceId))
                        .filter((price) => typeof params.active !== "boolean" || price.active === params.active)
                        .map(clone),
                };
            },
            async create(params, options) {
                calls.priceCreates.push({ params: clone(params), options: clone(options) });
                if (failOnceFor === params.metadata.print_option_id && !failed) {
                    failed = true;
                    throw Object.assign(new Error("Temporary Stripe failure"), { code: "api_connection_error" });
                }
                const price = {
                    id: `price_${nextPrice++}`,
                    active: true,
                    type: "one_time",
                    unit_amount: params.unit_amount,
                    currency: params.currency,
                    product: params.product,
                    lookup_key: params.lookup_key,
                    metadata: clone(params.metadata),
                };
                prices.set(price.id, price);
                const ids = lookupKeys.get(price.lookup_key) || new Set();
                ids.add(price.id);
                lookupKeys.set(price.lookup_key, ids);
                return clone(price);
            },
        },
    };
    stripe.seedPrice = (price) => {
        prices.set(price.id, clone(price));
        if (price.lookup_key) {
            const ids = lookupKeys.get(price.lookup_key) || new Set();
            ids.add(price.id);
            lookupKeys.set(price.lookup_key, ids);
        }
        if (typeof price.product === "string" && !products.has(price.product)) {
            products.set(price.product, { id: price.product, active: true, metadata: {} });
        }
    };
    stripe.seedProduct = (product) => products.set(product.id, clone(product));
    stripe.setPriceRetrieveError = (error) => { currentPriceRetrieveError = error; };
    stripe.setPriceListErrorFor = (lookupKey) => { currentPriceListErrorFor = lookupKey; };
    return stripe;
}

async function confirmPreview(preview, product, stripe, store, choice = preview.recommendedCanonicalProductChoice) {
    return confirmStripePrintPriceSync({
        productId: product.id,
        operationId: preview.operationId,
        canonicalProductChoice: choice,
        requestedBy: "admin-user",
        stripe,
        store,
    });
}

test("callable handler rejects missing admin claims before accessing Stripe", async () => {
    let stripeAccessed = false;
    for (const auth of [null, { uid: "customer", token: {} }, { uid: "customer", token: { admin: false } }]) {
        await assert.rejects(
            () => handleAdminStripePrintPriceSync(
                { auth, data: { action: "preview", productId: "new-piece" } },
                { getStripe: () => { stripeAccessed = true; }, store: {} }
            ),
            (error) => error instanceof StripePriceSyncError
                && ["unauthenticated", "permission-denied"].includes(error.code)
        );
    }
    assert.equal(stripeAccessed, false);
});

test("callable handler rejects browser-supplied price fields", async () => {
    let stripeAccessed = false;
    await assert.rejects(
        () => handleAdminStripePrintPriceSync(
            { auth: { uid: "admin", token: { admin: true } }, data: { action: "preview", productId: "new-piece", amountCents: 1 } },
            { getStripe: () => { stripeAccessed = true; }, store: {} }
        ),
        (error) => error instanceof StripePriceSyncError && error.code === "invalid-argument"
    );
    assert.equal(stripeAccessed, false);
});

test("callable handler allows an authenticated admin to preview", async () => {
    const product = productWithOptions();
    const store = fakeStore(product);
    const stripe = fakeStripe();
    let stripeAccesses = 0;

    const result = await handleAdminStripePrintPriceSync(
        { auth: { uid: "admin-user", token: { admin: true } }, data: { action: "preview", productId: product.id } },
        { getStripe: () => { stripeAccesses += 1; return stripe; }, store }
    );

    assert.equal(result.status, "previewed");
    assert.equal(result.productId, product.id);
    assert.equal(stripeAccesses, 1);
});

test("callable handler rejects unsafe Firestore path identifiers before accessing Stripe", async () => {
    let stripeAccessed = false;
    const requests = [
        { action: "preview", productId: "x".repeat(101) },
        { action: "create", productId: "new-piece", operationId: "contains/slash" },
        { action: "create", productId: "new-piece", operationId: "x".repeat(151) },
    ];

    for (const data of requests) {
        await assert.rejects(
            () => handleAdminStripePrintPriceSync(
                { auth: { uid: "admin-user", token: { admin: true } }, data },
                { getStripe: () => { stripeAccessed = true; }, store: {} }
            ),
            (error) => error instanceof StripePriceSyncError && error.code === "invalid-argument"
        );
    }
    assert.equal(stripeAccessed, false);
});

test("preview preserves matching IDs and reports mismatched Stripe prices as conflicts", async () => {
    const product = productWithOptions();
    product.prints.options[0].stripePriceId = "price_matching";
    product.prints.options[1].stripePriceId = "price_conflict";
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice({ id: "price_matching", active: true, type: "one_time", unit_amount: 10000, currency: "usd", product: "prod_existing" });
    stripe.seedPrice({ id: "price_conflict", active: true, type: "one_time", unit_amount: 999, currency: "usd", product: "prod_existing" });

    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });

    assert.deepEqual(preview.summary, { existing: 1, missing: 0, recoverable: 0, conflicts: 1, invalid: 0 });
    assert.equal(preview.items[0].stripePriceId, "price_matching");
    assert.equal(preview.items[1].currentStripePriceId, "price_conflict");
    assert.match(preview.items[1].message, /amount does not match/i);
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("preview reports transient Stripe retrieval errors as unavailable", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    product.prints.options[0].stripePriceId = "price_existing";
    const store = fakeStore(product);
    const stripe = fakeStripe({ priceRetrieveError: { type: "StripeConnectionError" } });

    await assert.rejects(
        () => previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store }),
        (error) => error instanceof StripePriceSyncError && error.code === "unavailable"
    );
    assert.equal(store.operations.size, 0);
});

test("preview reports every existing Price when options span different Stripe Products", async () => {
    const product = productWithOptions();
    product.prints.options[0].stripePriceId = "price_product_a";
    product.prints.options[1].stripePriceId = "price_product_b";
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedProduct({ id: "prod_a", name: "Echoes 16x20", active: true, metadata: {} });
    stripe.seedProduct({ id: "prod_b", name: "Echoes 18x24", active: true, metadata: {} });
    stripe.seedPrice({ id: "price_product_a", active: true, type: "one_time", unit_amount: 10000, currency: "usd", product: "prod_a" });
    stripe.seedPrice({ id: "price_product_b", active: true, type: "one_time", unit_amount: 20000, currency: "usd", product: "prod_b" });

    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });

    assert.equal(preview.stripeProductId, null);
    assert.equal(preview.conflictCode, "multiple_stripe_products");
    assert.equal(
        preview.conflictGuidance,
        "Use one Stripe Product per artwork, with one Price per print size. These saved Price IDs belong to different Stripe Products."
    );
    assert.deepEqual(preview.conflictingStripeProducts, [
        { stripeProductId: "prod_a", stripeProductName: "Echoes 16x20" },
        { stripeProductId: "prod_b", stripeProductName: "Echoes 18x24" },
    ]);
    assert.deepEqual(preview.items.map((item) => item.status), ["conflict", "conflict"]);
    assert.deepEqual(
        preview.items.map((item) => [item.stripeProductId, item.stripeProductName]),
        [["prod_a", "Echoes 16x20"], ["prod_b", "Echoes 18x24"]]
    );
    assert.deepEqual(preview.summary, { existing: 0, missing: 0, recoverable: 0, conflicts: 2, invalid: 0 });
    assert.ok(preview.items.every((item) => /different Stripe Products/i.test(item.message)));
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("preview persists a server-derived plan without creating Stripe objects", async () => {
    const product = productWithOptions();
    const store = fakeStore(product);
    const stripe = fakeStripe();

    const preview = await previewStripePrintPriceSync({
        productId: product.id,
        requestedBy: "admin-user",
        stripe,
        store,
    });

    assert.equal(preview.status, "previewed");
    assert.equal(preview.operationId, "operation-1");
    assert.deepEqual(preview.summary, { existing: 0, missing: 2, recoverable: 0, conflicts: 0, invalid: 0 });
    assert.deepEqual(preview.items.map(({ optionId, status }) => ({ optionId, status })), [
        { optionId: "16x20", status: "missing" },
        { optionId: "18x24", status: "missing" },
    ]);
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
    assert.equal(store.operations.get("operation-1").requestedBy, "admin-user");
    assert.equal(store.operations.get("operation-1").productId, "new-piece");
    assert.equal(store.productWrites, 0);
});

test("confirm performs no Stripe writes and create is denied before confirmation", async () => {
    const product = productWithOptions();
    const store = fakeStore(product);
    const stripe = fakeStripe();
    const preview = await previewStripePrintPriceSync({
        productId: product.id,
        requestedBy: "admin-user",
        stripe,
        store,
    });

    await assert.rejects(
        () => createMissingStripePrices({
            productId: product.id,
            operationId: preview.operationId,
            requestedBy: "admin-user",
            stripe,
            store,
        }),
        (error) => error instanceof StripePriceSyncError && error.code === "failed-precondition"
    );

    const confirmed = await confirmStripePrintPriceSync({
        productId: product.id,
        operationId: preview.operationId,
        canonicalProductChoice: { mode: "new" },
        requestedBy: "admin-user",
        stripe,
        store,
    });

    assert.equal(confirmed.status, "confirmed");
    assert.deepEqual(confirmed.canonicalProductChoice, { mode: "new" });
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
    assert.equal(store.productWrites, 0);
});

test("multi-Product conflicts recommend and create a new canonical artwork Product", async () => {
    const product = productWithOptions("echoes-of-the-5th-sun");
    product.title = "Echoes of the 5th Sun";
    product.prints.options[0].stripePriceId = "price_old_16";
    product.prints.options[1].stripePriceId = "price_old_18";
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedProduct({ id: "prod_size_16", name: "Echoes 16x20", active: true, metadata: {} });
    stripe.seedProduct({ id: "prod_size_18", name: "Echoes 18x24", active: true, metadata: {} });
    stripe.seedPrice({ id: "price_old_16", active: true, type: "one_time", unit_amount: 10000, currency: "usd", product: "prod_size_16" });
    stripe.seedPrice({ id: "price_old_18", active: true, type: "one_time", unit_amount: 20000, currency: "usd", product: "prod_size_18" });

    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    assert.deepEqual(preview.recommendedCanonicalProductChoice, { mode: "new" });
    assert.equal(preview.canConfirm, true);

    await confirmStripePrintPriceSync({
        productId: product.id,
        operationId: preview.operationId,
        canonicalProductChoice: { mode: "new" },
        requestedBy: "admin-user",
        stripe,
        store,
    });
    const result = await createMissingStripePrices({
        productId: product.id,
        operationId: preview.operationId,
        requestedBy: "admin-user",
        stripe,
        store,
    });

    const canonicalProductId = result.stripeProductId;
    assert.equal(result.status, "completed");
    assert.equal(stripe.calls.productCreates.length, 1);
    assert.equal(stripe.calls.productCreates[0].params.name, "Echoes of the 5th Sun");
    assert.deepEqual(stripe.calls.priceCreates.map((call) => call.params.product), [canonicalProductId, canonicalProductId]);
    assert.deepEqual(
        store.products.get(product.id).prints.options.map((option) => option.stripePriceId),
        ["price_1", "price_2"]
    );
    assert.equal(store.productWrites, 1);
    assert.equal(stripe.pricesById.has("price_old_16"), true);
    assert.equal(stripe.pricesById.has("price_old_18"), true);
    assert.match(result.checkoutReadinessMessage, /trusted server checkout catalog/i);
});

test("an explicitly selected existing Product preserves its Price and replaces only other Firestore references", async () => {
    const product = productWithOptions("echoes-of-the-5th-sun");
    product.prints.options[0].stripePriceId = "price_keep";
    product.prints.options[1].stripePriceId = "price_replace";
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice({ id: "price_keep", active: true, type: "one_time", unit_amount: 10000, currency: "usd", product: "prod_selected" });
    stripe.seedPrice({ id: "price_replace", active: true, type: "one_time", unit_amount: 20000, currency: "usd", product: "prod_mistaken" });

    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store, { mode: "existing", stripeProductId: "prod_selected" });
    const result = await createMissingStripePrices({
        productId: product.id,
        operationId: preview.operationId,
        requestedBy: "admin-user",
        stripe,
        store,
    });

    assert.equal(result.status, "completed");
    assert.equal(result.stripeProductId, "prod_selected");
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 1);
    assert.equal(stripe.calls.priceCreates[0].params.product, "prod_selected");
    assert.deepEqual(
        store.products.get(product.id).prints.options.map((option) => option.stripePriceId),
        ["price_keep", "price_1"]
    );
    assert.equal(stripe.pricesById.has("price_replace"), true);
    assert.deepEqual(store.products.get(product.id).prints.options.map((option) => option.active), [false, false]);
    assert.equal(store.products.get(product.id).prints.available, false);
});

test("create rejects a stale product after confirmation before Stripe writes", async () => {
    const product = productWithOptions();
    const store = fakeStore(product);
    const stripe = fakeStripe();
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);
    store.products.get(product.id).prints.options[0].amountCents = 9999;

    await assert.rejects(
        () => createMissingStripePrices({
            productId: product.id,
            operationId: preview.operationId,
            requestedBy: "admin-user",
            stripe,
            store,
        }),
        (error) => error instanceof StripePriceSyncError && error.code === "failed-precondition"
    );
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
    assert.equal(store.productWrites, 0);
});

test("confirm rejects an existing canonical Product that preview did not verify", async () => {
    const product = productWithOptions();
    product.prints.options[0].stripePriceId = "price_existing";
    product.prints.options = [product.prints.options[0]];
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice({ id: "price_existing", active: true, type: "one_time", unit_amount: 10000, currency: "usd", product: "prod_verified" });
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });

    await assert.rejects(
        () => confirmStripePrintPriceSync({
            productId: product.id,
            operationId: preview.operationId,
            canonicalProductChoice: { mode: "existing", stripeProductId: "prod_unverified" },
            requestedBy: "admin-user",
            stripe,
            store,
        }),
        (error) => error instanceof StripePriceSyncError && error.code === "failed-precondition"
    );
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("preview rejects print options that differ from the server-owned standard prices", async () => {
    const product = productWithOptions();
    product.prints.options[0].amountCents = 9999;
    product.prints.options[1].currency = "eur";
    const store = fakeStore(product);
    const stripe = fakeStripe();

    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });

    assert.deepEqual(preview.summary, { existing: 0, missing: 0, recoverable: 0, conflicts: 0, invalid: 2 });
    assert.match(preview.items[0].message, /standard price is 10000 usd/i);
    assert.match(preview.items[1].message, /standard price is 20000 usd/i);
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("preview detects inactive deterministic lookup Prices instead of reporting them missing", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice({
        id: "price_inactive",
        active: false,
        type: "one_time",
        unit_amount: 10000,
        currency: "usd",
        product: "prod_existing",
        lookup_key: lookupKeyFor(product.id, "16x20"),
    });

    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });

    assert.equal(preview.items[0].status, "conflict");
    assert.match(preview.items[0].message, /inactive/i);
    assert.equal(preview.summary.missing, 0);
    assert.deepEqual(stripe.calls.lists.map((call) => call.active).sort(), [false, true]);
});

test("preview rejects inactive or mismatched Stripe Products", async () => {
    const product = productWithOptions();
    product.prints.options[0].stripePriceId = "price_inactive_product";
    product.prints.options[1].stripePriceId = "price_wrong_product";
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice({ id: "price_inactive_product", active: true, type: "one_time", unit_amount: 10000, currency: "usd", product: "prod_inactive" });
    stripe.seedPrice({ id: "price_wrong_product", active: true, type: "one_time", unit_amount: 20000, currency: "usd", product: "prod_wrong" });
    stripe.seedProduct({ id: "prod_inactive", active: false, metadata: { firestore_product_id: product.id } });
    stripe.seedProduct({ id: "prod_wrong", active: true, metadata: { firestore_product_id: "different-product" } });

    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });

    assert.deepEqual(preview.items.map((item) => item.status), ["conflict", "conflict"]);
    assert.match(preview.items[0].message, /Product is inactive/i);
    assert.match(preview.items[1].message, /belongs to a different Firestore product/i);
});

test("create attaches missing IDs once while preserving inactive checkout state", async () => {
    const product = productWithOptions();
    const store = fakeStore(product);
    const stripe = fakeStripe();
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);

    const created = await createMissingStripePrices({
        productId: product.id,
        operationId: preview.operationId,
        requestedBy: "admin-user",
        stripe,
        store,
    });
    const repeated = await createMissingStripePrices({
        productId: product.id,
        operationId: preview.operationId,
        requestedBy: "admin-user",
        stripe,
        store,
    });
    const saved = store.products.get(product.id);

    assert.equal(created.status, "completed");
    assert.deepEqual(repeated, created);
    assert.equal(stripe.calls.productCreates.length, 1);
    assert.equal(stripe.calls.priceCreates.length, 2);
    assert.ok(stripe.calls.productCreates[0].options.idempotencyKey.includes(product.id));
    assert.ok(stripe.calls.priceCreates.every((call) => call.options.idempotencyKey.includes(product.id)));
    assert.deepEqual(saved.prints.options.map((option) => Boolean(option.stripePriceId)), [true, true]);
    assert.deepEqual(saved.prints.options.map((option) => option.active), [false, false]);
    assert.equal(saved.prints.available, false);
    assert.equal(saved.prints.defaultOptionId, null);
});

test("distinct concurrent operations share one canonical Stripe Product", async () => {
    const product = productWithOptions();
    const store = fakeStore(product);
    let releaseProductCreate;
    let signalProductCreate;
    const productCreateStarted = new Promise((resolve) => { signalProductCreate = resolve; });
    const productCreateWait = new Promise((resolve) => { releaseProductCreate = resolve; });
    const stripe = fakeStripe({ productCreateGate: { started: signalProductCreate, wait: productCreateWait } });
    const firstPreview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    const secondPreview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(firstPreview, product, stripe, store);
    await confirmPreview(secondPreview, product, stripe, store);

    const firstRun = createMissingStripePrices({ productId: product.id, operationId: firstPreview.operationId, requestedBy: "admin-user", stripe, store });
    await productCreateStarted;
    const secondRun = createMissingStripePrices({ productId: product.id, operationId: secondPreview.operationId, requestedBy: "admin-user", stripe, store });
    releaseProductCreate();
    const initialResults = await Promise.all([firstRun, secondRun]);
    const completed = initialResults.find((result) => result.status === "completed");
    const blocked = initialResults.find((result) => result.status === "partial_failure");
    const savedPriceProductIds = new Set(
        store.products.get(product.id).prints.options.map((option) => stripe.pricesById.get(option.stripePriceId).product)
    );

    assert.ok(completed);
    assert.ok(blocked);
    assert.equal(stripe.calls.productCreates.length, 1);
    assert.equal(savedPriceProductIds.size, 1);
    assert.equal(store.productMappings.get(product.id).stripeProductId, [...savedPriceProductIds][0]);
});

test("an active Product claim prevents an existing candidate from reporting success", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    product.prints.options[0].stripePriceId = "price_existing";
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice({ id: "price_existing", active: true, type: "one_time", unit_amount: 10000, currency: "usd", product: "prod_existing" });
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);
    await store.claimProductMapping(product.id, "other-operation");

    const result = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });

    assert.equal(result.status, "partial_failure");
    assert.equal(result.results[0].status, "failed");
    assert.match(result.results[0].message, /another Stripe sync/i);
    assert.equal(store.productMappings.get(product.id).stripeProductId, null);
});

test("a concurrent saved Price change prevents a stale canonical Product mapping", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    product.prints.options[0].stripePriceId = "price_initial";
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice({ id: "price_initial", active: true, type: "one_time", unit_amount: 10000, currency: "usd", product: "prod_initial" });
    stripe.seedPrice({ id: "price_concurrent", active: true, type: "one_time", unit_amount: 10000, currency: "usd", product: "prod_concurrent" });
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);
    const claim = store.claimProductMapping.bind(store);
    store.claimProductMapping = async (...args) => {
        store.products.get(product.id).prints.options[0].stripePriceId = "price_concurrent";
        return claim(...args);
    };

    const result = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });

    assert.equal(result.status, "completed_with_conflicts");
    assert.equal(result.results[0].status, "conflict");
    assert.match(result.results[0].message, /changed during Stripe sync/i);
    assert.equal(store.productMappings.has(product.id), false);
    assert.equal(store.products.get(product.id).prints.options[0].stripePriceId, "price_concurrent");
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("a transient saved Price verification failure blocks all Stripe creation", async () => {
    const product = productWithOptions();
    product.prints.options[0].stripePriceId = "price_existing";
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice({ id: "price_existing", active: true, type: "one_time", unit_amount: 10000, currency: "usd", product: "prod_existing" });
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);
    stripe.setPriceRetrieveError({ type: "StripeConnectionError" });

    const result = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });

    assert.equal(result.status, "partial_failure");
    assert.equal(result.results[0].status, "failed");
    assert.equal(store.productWrites, 0);
    assert.deepEqual(store.products.get(product.id).prints.options.map((option) => option.stripePriceId), ["price_existing", null]);
});

test("a transient lookup preflight failure blocks all Stripe creation", async () => {
    const product = productWithOptions();
    const store = fakeStore(product);
    const stripe = fakeStripe();
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);
    stripe.setPriceListErrorFor(canonicalLookupKeyFor(product.id, "16x20", "prod_1"));

    const result = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });

    assert.equal(result.status, "partial_failure");
    assert.equal(result.results[0].status, "failed");
    assert.equal(store.productWrites, 0);
});

test("create recovers an unmapped Stripe Product from sync metadata", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedProduct({
        id: "prod_recovered",
        active: true,
        metadata: { source: "likwit_admin_price_sync", canonical_product: "true", firestore_product_id: product.id },
    });
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);

    const result = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });

    assert.equal(result.status, "completed");
    assert.equal(result.stripeProductId, "prod_recovered");
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(store.productMappings.get(product.id).stripeProductId, "prod_recovered");
});

test("create adopts the Product from a recoverable lookup Price without sync metadata", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice({
        id: "price_recoverable",
        active: true,
        type: "one_time",
        unit_amount: 10000,
        currency: "usd",
        product: "prod_untagged",
        lookup_key: lookupKeyFor(product.id, "16x20"),
    });
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);

    const result = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });

    assert.equal(result.status, "completed");
    assert.equal(result.stripeProductId, "prod_untagged");
    assert.equal(result.results[0].status, "attached");
    assert.equal(store.products.get(product.id).prints.options[0].stripePriceId, "price_recoverable");
    assert.equal(store.productMappings.get(product.id).stripeProductId, "prod_untagged");
    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("a concurrent canonical option edit prevents stale Price attachment", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    const store = fakeStore(product);
    const replace = store.replacePriceIdsAtomically.bind(store);
    store.replacePriceIdsAtomically = async (...args) => {
        store.products.get(product.id).prints.options[0].amountCents = 9999;
        return replace(...args);
    };
    const stripe = fakeStripe();
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);

    const result = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });

    assert.equal(result.status, "completed_with_conflicts");
    assert.equal(result.results[0].status, "conflict");
    assert.match(result.results[0].message, /changed after confirmation/i);
    assert.equal(store.products.get(product.id).prints.options[0].stripePriceId, null);
});

test("a concurrent Stripe ID edit prevents the atomic Firestore replacement", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    const store = fakeStore(product);
    const replace = store.replacePriceIdsAtomically.bind(store);
    store.replacePriceIdsAtomically = async (...args) => {
        store.products.get(product.id).prints.options[0].stripePriceId = "price_concurrent";
        return replace(...args);
    };
    const stripe = fakeStripe();
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);

    const result = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });

    assert.equal(result.status, "completed_with_conflicts");
    assert.equal(result.results[0].status, "conflict");
    assert.equal(store.products.get(product.id).prints.options[0].stripePriceId, "price_concurrent");
});

test("partial failures persist progress and retry only unfinished prices", async () => {
    const product = productWithOptions();
    const store = fakeStore(product);
    const stripe = fakeStripe({ failOnceFor: "18x24" });
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);

    const partial = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });
    assert.equal(partial.status, "partial_failure");
    assert.deepEqual(store.products.get(product.id).prints.options.map((option) => option.stripePriceId), [null, null]);
    assert.equal(store.productWrites, 0);

    const recovered = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });
    assert.equal(recovered.status, "completed");
    assert.equal(stripe.calls.productCreates.length, 1);
    assert.equal(stripe.calls.priceCreates.length, 3);
    assert.equal(store.products.get(product.id).prints.options.every((option) => option.stripePriceId), true);
});

test("retry recovers created Stripe Prices after the atomic Firestore update failed", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    const store = fakeStore(product);
    const replace = store.replacePriceIdsAtomically.bind(store);
    let failUpdate = true;
    store.replacePriceIdsAtomically = async (...args) => {
        if (failUpdate) {
            failUpdate = false;
            throw new Error("Temporary Firestore failure");
        }
        return replace(...args);
    };
    const stripe = fakeStripe();
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);

    const partial = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });
    const recovered = await createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store });

    assert.equal(partial.status, "partial_failure");
    assert.equal(recovered.status, "completed");
    assert.equal(recovered.results[0].status, "attached");
    assert.equal(stripe.calls.priceCreates.length, 1);
    assert.equal(store.products.get(product.id).prints.options[0].stripePriceId, "price_1");
});

test("a concurrent Stripe ID conflict is reported without overwriting it", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    const store = fakeStore(product);
    const stripe = fakeStripe();
    const preview = await previewStripePrintPriceSync({ productId: product.id, requestedBy: "admin-user", stripe, store });
    await confirmPreview(preview, product, stripe, store);
    store.products.get(product.id).prints.options[0].stripePriceId = "price_manual";

    await assert.rejects(
        () => createMissingStripePrices({ productId: product.id, operationId: preview.operationId, requestedBy: "admin-user", stripe, store }),
        (error) => error instanceof StripePriceSyncError && error.code === "failed-precondition"
    );
    assert.equal(store.products.get(product.id).prints.options[0].stripePriceId, "price_manual");
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("Firestore adapter persists operations and atomically replaces a confirmed Price set", async () => {
    const product = productWithOptions();
    product.prints.options = [product.prints.options[0]];
    const operationWrites = [];
    const productUpdates = [];
    const operationRef = {
        id: "generated-operation",
        async set(data, options) {
            operationWrites.push({ data: clone(data), options: options ? clone(options) : null });
        },
        async get() {
            return { exists: true, data: () => ({ status: "previewed" }) };
        },
    };
    const productRef = { kind: "product" };
    const mappingRef = { kind: "mapping" };
    let mapping = null;
    const mappingWrites = [];
    const firestore = {
        collection(name) {
            if (name === "adminStripePriceSyncOperations") return { doc: () => operationRef };
            if (name === "adminStripePrintProductMappings") return { doc: () => mappingRef };
            if (name === "shopProducts") return { doc: () => productRef };
            throw new Error(`Unexpected collection ${name}`);
        },
        async runTransaction(callback) {
            return callback({
                get: async (ref) => ref.kind === "mapping"
                    ? { exists: Boolean(mapping), data: () => clone(mapping) }
                    : { exists: true, data: () => clone(product) },
                set: (ref, data, options) => {
                    assert.equal(ref, mappingRef);
                    mapping = { ...(mapping || {}), ...clone(data) };
                    mappingWrites.push({ data: clone(data), options: clone(options) });
                },
                update: (_ref, update) => {
                    productUpdates.push(clone(update));
                    product.prints.options = clone(update["prints.options"]);
                },
            });
        },
    };
    const store = createFirestoreStripeSyncStore({ firestore, serverTimestamp: () => "SERVER_TIMESTAMP" });

    const operationId = await store.createOperation({ status: "previewed", productId: product.id });
    const expectedOption = { optionId: "16x20", label: "16x20", amountCents: 10000, currency: "usd" };
    product.prints.options[0].stripePriceId = "price_created";
    const expectedMappingOptions = [{ ...expectedOption, stripePriceId: "price_created" }];
    const staleMapping = await store.claimProductMapping(product.id, operationId, null, [
        { ...expectedOption, stripePriceId: "price_other" },
    ]);
    const claimed = await store.claimProductMapping(product.id, operationId, null, expectedMappingOptions);
    const blockedCandidate = await store.claimProductMapping(product.id, "operation-2", "prod_other", expectedMappingOptions);
    const finalized = await store.finalizeProductMapping(product.id, operationId, "prod_canonical", expectedMappingOptions);
    const mapped = await store.claimProductMapping(product.id, "operation-2", null, expectedMappingOptions);
    const atomic = await store.replacePriceIdsAtomically(product.id, expectedMappingOptions, [
        { optionId: "16x20", stripePriceId: "price_atomic" },
    ]);

    assert.equal(operationId, "generated-operation");
    assert.equal(operationWrites[0].data.createdAt, "SERVER_TIMESTAMP");
    assert.equal(operationWrites[0].data.updatedAt, "SERVER_TIMESTAMP");
    assert.equal(staleMapping.status, "stale");
    assert.equal(claimed.status, "claimed");
    assert.equal(blockedCandidate.status, "busy");
    assert.deepEqual(finalized, { status: "mapped", stripeProductId: "prod_canonical" });
    assert.deepEqual(mapped, { status: "mapped", stripeProductId: "prod_canonical" });
    assert.deepEqual(atomic, { status: "updated" });
    assert.equal(mappingWrites.length, 2);
    assert.equal(productUpdates.length, 1);
    assert.equal(productUpdates[0]["prints.options"][0].stripePriceId, "price_atomic");
    assert.equal(productUpdates[0]["prints.options"][0].active, false);
    assert.equal(productUpdates[0]["prints.available"], undefined);
    assert.equal(productUpdates[0]["prints.defaultOptionId"], undefined);
});

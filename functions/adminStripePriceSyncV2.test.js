"use strict";
/* global require */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    PRINT_SYNC_V2_SCHEMA_VERSION,
    StripePriceSyncV2Error,
    applyStripePrintPriceSyncV2,
    canonicalPrintTerms,
    canonicalPrintTermsHash,
    createFirestoreStripePriceSyncV2Store,
    handleAdminStripePrintPriceSyncV2,
    previewStripePrintPriceSyncV2,
    proposedPrintsFingerprint,
    publishedPrintsFingerprint,
    versionedPriceIdempotencyKey,
    versionedPriceLookupKey,
} = require("./adminStripePriceSyncV2");

function clone(value) {
    return structuredClone(value);
}

function printOption(overrides = {}) {
    return {
        id: "16x20",
        label: "16x20",
        amountCents: 10000,
        currency: "usd",
        stripePriceId: "price_100",
        active: true,
        sortOrder: 0,
        ...overrides,
    };
}

function productFixture(overrides = {}) {
    return {
        id: "artwork-one",
        title: "Artwork One",
        prints: {
            available: true,
            defaultOptionId: "16x20",
            options: [printOption()],
        },
        ...overrides,
    };
}

function proposalFrom(product, mutate = (value) => value) {
    const proposal = {
        available: product.prints.available,
        defaultOptionId: product.prints.defaultOptionId,
        options: product.prints.options.map((option) => ({
            optionId: option.id,
            label: option.label,
            amountCents: option.amountCents,
            currency: option.currency,
            active: option.active,
            sortOrder: option.sortOrder,
        })),
    };
    return mutate(clone(proposal));
}

function stripeProduct(id = "prod_art", overrides = {}) {
    return {
        id,
        active: true,
        livemode: true,
        metadata: { firestore_product_id: "artwork-one", source: "likwit_admin_price_sync" },
        ...overrides,
    };
}

function stripePrice(id, overrides = {}) {
    return {
        id,
        active: true,
        type: "one_time",
        unit_amount: 10000,
        currency: "usd",
        livemode: true,
        product: "prod_art",
        lookup_key: null,
        metadata: {
            source: "likwit_admin_price_sync",
            firestore_product_id: "artwork-one",
            print_option_id: "16x20",
        },
        ...overrides,
    };
}

function fakeStripe() {
    const products = new Map([["prod_art", stripeProduct()]]);
    const prices = new Map([["price_100", stripePrice("price_100")]]);
    const idempotency = new Map();
    const calls = { priceCreates: [], priceDeletes: [], priceUpdates: [], productCreates: [], productUpdates: [], retrieves: [], lists: [] };
    let nextPrice = 1;
    let nextProduct = 1;
    const stripe = {
        calls,
        productsById: products,
        pricesById: prices,
        products: {
            async retrieve(id) {
                const product = products.get(id);
                if (!product) throw Object.assign(new Error("missing"), { code: "resource_missing" });
                return clone(product);
            },
            async search({ query }) {
                const productId = /firestore_product_id'\]:'([^']+)'/.exec(query)?.[1];
                return { data: [...products.values()].filter((item) => item.metadata?.firestore_product_id === productId).map(clone) };
            },
            async create(params, options) {
                calls.productCreates.push({ params: clone(params), options: clone(options) });
                const key = options?.idempotencyKey;
                if (key && idempotency.has(key)) return clone(idempotency.get(key));
                const product = { id: `prod_created_${nextProduct++}`, active: true, livemode: true, ...clone(params) };
                products.set(product.id, product);
                if (key) idempotency.set(key, product);
                return clone(product);
            },
            async update(id, params, options) {
                calls.productUpdates.push({ id, params: clone(params), options: clone(options) });
                const product = products.get(id);
                if (!product) throw Object.assign(new Error("missing"), { code: "resource_missing" });
                const updated = { ...product, ...clone(params) };
                products.set(id, updated);
                return clone(updated);
            },
        },
        prices: {
            async retrieve(id) {
                calls.retrieves.push(id);
                const price = prices.get(id);
                if (!price) throw Object.assign(new Error("missing"), { code: "resource_missing" });
                return clone(price);
            },
            async list(params) {
                calls.lists.push(clone(params));
                let values = [...prices.values()];
                if (params.product) values = values.filter((price) => price.product === params.product);
                if (params.lookup_keys) values = values.filter((price) => params.lookup_keys.includes(price.lookup_key));
                if (typeof params.active === "boolean") values = values.filter((price) => price.active === params.active);
                return { data: values.slice(0, params.limit || 100), has_more: false };
            },
            async create(params, options) {
                calls.priceCreates.push({ params: clone(params), options: clone(options) });
                const key = options?.idempotencyKey;
                if (key && idempotency.has(key)) return clone(idempotency.get(key));
                const price = stripePrice(`price_created_${nextPrice++}`, {
                    unit_amount: params.unit_amount,
                    currency: params.currency,
                    product: params.product,
                    lookup_key: params.lookup_key,
                    metadata: clone(params.metadata),
                });
                prices.set(price.id, price);
                if (key) idempotency.set(key, price);
                return clone(price);
            },
        },
    };
    stripe.seedProduct = (value) => products.set(value.id, clone(value));
    stripe.seedPrice = (value) => prices.set(value.id, clone(value));
    return stripe;
}

function fakeStore(product = productFixture(), mapping = {
    schemaVersion: 2,
    productId: "artwork-one",
    stripeProductId: "prod_art",
    livemode: true,
}) {
    const products = new Map([[product.id, clone(product)]]);
    const mappings = new Map(mapping ? [[product.id, clone(mapping)]] : []);
    const operations = new Map();
    let operationCounter = 1;
    const store = {
        productWrites: 0,
        products,
        mappings,
        operations,
        async getProduct(id) { return clone(products.get(id) || null); },
        async getProductMapping(id) { return clone(mappings.get(id) || null); },
        async findProductMappingsByStripeProductId(id) {
            return [...mappings.values()]
                .filter((value) => value.stripeProductId === id)
                .map(clone);
        },
        async createOperation(value) {
            const id = `operation_${operationCounter++}`;
            operations.set(id, clone(value));
            return id;
        },
        async getOperation(id) {
            return operations.has(id) ? { id, ...clone(operations.get(id)) } : null;
        },
        async updateOperation(id, patch) {
            operations.set(id, { ...operations.get(id), ...clone(patch) });
        },
        async claimProductMapping({ productId, operationId, expectedBaseFingerprint, livemode }) {
            const current = products.get(productId);
            if (publishedPrintsFingerprint(current.prints) !== expectedBaseFingerprint) return { status: "stale" };
            const mappingValue = mappings.get(productId);
            if (mappingValue?.stripeProductId) return { status: "mapped", ...clone(mappingValue) };
            mappings.set(productId, { productId, claimOperationId: operationId, livemode });
            return { status: "claimed" };
        },
        async finalizeProductMapping({ productId, operationId, stripeProductId, livemode, expectedBaseFingerprint }) {
            if (publishedPrintsFingerprint(products.get(productId).prints) !== expectedBaseFingerprint) return { status: "stale" };
            const existing = mappings.get(productId);
            if (existing?.stripeProductId && existing.stripeProductId !== stripeProductId) return { status: "conflict" };
            if (existing?.claimOperationId && existing.claimOperationId !== operationId) return { status: "conflict" };
            const next = {
                schemaVersion: 2,
                productId,
                stripeProductId,
                livemode,
                ...(existing?.stripeProductId ? {} : { establishedByOperationId: operationId }),
            };
            mappings.set(productId, next);
            return { status: "mapped", ...clone(next) };
        },
        async publishPrintsAtomically({ productId, operationId, baseFingerprint, mapping: expectedMapping, prints, response }) {
            const current = products.get(productId);
            const operation = operations.get(operationId);
            const currentMapping = mappings.get(productId);
            if (!operation || operation.status !== "applying") return { status: "conflict", reasonCode: "OPERATION_STATE_CHANGED" };
            if (publishedPrintsFingerprint(current.prints) !== baseFingerprint) return { status: "stale", reasonCode: "PRINTS_CHANGED" };
            if (operation.proposedFingerprint !== proposedPrintsFingerprint(operation.proposedPrints, operation.items)) {
                return { status: "conflict", reasonCode: "PROPOSED_STATE_CHANGED" };
            }
            if (expectedMapping === null ? Boolean(currentMapping?.stripeProductId) : (
                currentMapping?.stripeProductId !== expectedMapping.stripeProductId
                || currentMapping?.livemode !== expectedMapping.livemode
            )) {
                return { status: "stale", reasonCode: "MAPPING_CHANGED" };
            }
            current.prints = clone(prints);
            store.productWrites += 1;
            operations.set(operationId, { ...operation, status: "completed", response: clone(response) });
            return { status: "updated" };
        },
    };
    return store;
}

async function preview({ product = productFixture(), proposal, store, stripe, nowMs = 1000 } = {}) {
    const selectedStore = store || fakeStore(product);
    const selectedStripe = stripe || fakeStripe();
    const result = await previewStripePrintPriceSyncV2({
        productId: product.id,
        proposedPrints: proposal || proposalFrom(product),
        requestedBy: "admin-1",
        stripe: selectedStripe,
        store: selectedStore,
        expectedLivemode: true,
        nowMs,
    });
    return { result, store: selectedStore, stripe: selectedStripe };
}

test("commercial terms hash changes only for commercial identity fields", () => {
    const base = canonicalPrintTerms({
        livemode: true,
        productId: "artwork-one",
        optionId: "16x20",
        amountCents: 10000,
        currency: "usd",
        stripeProductId: "prod_art",
    });
    assert.deepEqual(base, {
        schemaVersion: 2,
        livemode: true,
        productId: "artwork-one",
        optionId: "16x20",
        amountCents: 10000,
        currency: "usd",
        stripeProductId: "prod_art",
    });
    const hash = canonicalPrintTermsHash(base);
    assert.equal(hash.length, 64);
    assert.equal(canonicalPrintTermsHash({ ...base, label: "Renamed" }), hash);
    for (const changed of [
        { amountCents: 12500 },
        { currency: "cad" },
        { optionId: "18x24" },
        { productId: "other-art" },
        { stripeProductId: "prod_other" },
        { livemode: false },
    ]) {
        assert.notEqual(canonicalPrintTermsHash({ ...base, ...changed }), hash);
    }
    assert.match(versionedPriceLookupKey(base), /^likwit-print-v2-artwork-one-16x20-[a-f0-9]{24}$/);
    assert.equal(versionedPriceIdempotencyKey(base), `likwit-admin-print-price-v2:${hash}`);
});

test("proposed-state fingerprint includes all UI fields and server-owned current Price IDs", () => {
    const proposal = proposalFrom(productFixture());
    const items = [{ optionId: "16x20", currentStripePriceId: "price_100", classification: "NO_CHANGE" }];
    const fingerprint = proposedPrintsFingerprint(proposal, items);
    assert.equal(fingerprint.length, 64);
    assert.notEqual(
        proposedPrintsFingerprint(proposal, [{ ...items[0], currentStripePriceId: "price_other" }]),
        fingerprint
    );
    assert.notEqual(
        proposedPrintsFingerprint({ ...proposal, available: false, defaultOptionId: null }, items),
        fingerprint
    );
    const relabeled = clone(proposal);
    relabeled.options[0].label = "Museum 16x20";
    assert.notEqual(proposedPrintsFingerprint(relabeled, items), fingerprint);
});

test("preview rejects unsupported browser Stripe authority fields", async () => {
    const product = productFixture();
    for (const injected of [
        { stripePriceId: "price_fake" },
        { stripeProductId: "prod_fake" },
        { livemode: true },
        { canonicalProductId: "prod_fake" },
        { resolvedTerms: { amountCents: 1 } },
    ]) {
        await assert.rejects(
            () => preview({ proposal: { ...proposalFrom(product), ...injected } }),
            (error) => error instanceof StripePriceSyncV2Error && error.code === "invalid-argument"
        );
    }
    const nestedPriceId = proposalFrom(product);
    nestedPriceId.options[0].stripePriceId = "price_fake";
    await assert.rejects(
        () => preview({ proposal: nestedPriceId }),
        (error) => error instanceof StripePriceSyncV2Error && error.code === "invalid-argument"
    );
});

test("preview accepts a custom size and classifies a price increase without mutation", async () => {
    const product = productFixture();
    const proposed = proposalFrom(product, (value) => {
        value.options[0].amountCents = 12500;
        value.options.push({ optionId: "12x18", label: "12x18", amountCents: 7500, currency: "usd", active: true, sortOrder: 1 });
        return value;
    });
    const { result, store, stripe } = await preview({ product, proposal: proposed });
    assert.equal(result.schemaVersion, PRINT_SYNC_V2_SCHEMA_VERSION);
    assert.deepEqual(result.items.map((item) => [item.optionId, item.classification]), [
        ["16x20", "CREATE_NEW_PRICE"],
        ["12x18", "CREATE_NEW_PRICE"],
    ]);
    assert.equal(store.productWrites, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
    assert.equal(stripe.calls.productCreates.length, 0);
});

test("preview classifies label-only reuse, disable, remove, and unchanged state", async () => {
    const product = productFixture({
        prints: {
            available: true,
            defaultOptionId: "16x20",
            options: [
                printOption(),
                printOption({ id: "18x24", label: "18x24", amountCents: 20000, stripePriceId: "price_200", sortOrder: 1 }),
                printOption({ id: "24x36", label: "24x36", amountCents: 30000, stripePriceId: "price_300", sortOrder: 2 }),
            ],
        },
    });
    const stripe = fakeStripe();
    stripe.seedPrice(stripePrice("price_200", { unit_amount: 20000, metadata: { firestore_product_id: product.id, print_option_id: "18x24" } }));
    stripe.seedPrice(stripePrice("price_300", { unit_amount: 30000, metadata: { firestore_product_id: product.id, print_option_id: "24x36" } }));
    const proposed = proposalFrom(product, (value) => {
        value.options[0].label = "Museum 16x20";
        value.options[1].active = false;
        value.options.splice(2, 1);
        return value;
    });
    const { result } = await preview({ product, proposal: proposed, store: fakeStore(product), stripe });
    assert.deepEqual(result.items.map((item) => [item.optionId, item.classification]), [
        ["16x20", "REUSE_EXISTING_PRICE"],
        ["18x24", "DISABLE"],
        ["24x36", "REMOVE"],
    ]);
    assert.equal(stripe.calls.priceCreates.length, 0);

    const unchanged = await preview({ product, proposal: proposalFrom(product), store: fakeStore(product), stripe });
    assert.deepEqual(unchanged.result.items.map((item) => item.classification), ["NO_CHANGE", "NO_CHANGE", "NO_CHANGE"]);
});

test("preview blocks removing an active default without a replacement", async () => {
    const product = productFixture();
    const proposed = proposalFrom(product, (value) => {
        value.options = [];
        return value;
    });
    await assert.rejects(
        () => preview({ product, proposal: proposed }),
        (error) => error instanceof StripePriceSyncV2Error && error.code === "failed-precondition"
    );
});

test("changing a published option ID is planned as a new option plus removal", async () => {
    const product = productFixture();
    const proposed = proposalFrom(product, (value) => {
        value.defaultOptionId = "museum-16x20";
        value.options[0].optionId = "museum-16x20";
        return value;
    });
    const { result } = await preview({ product, proposal: proposed });
    assert.deepEqual(result.items.map((item) => [item.optionId, item.classification]), [
        ["museum-16x20", "CREATE_NEW_PRICE"],
        ["16x20", "REMOVE"],
    ]);
});

test("apply creates and verifies a new immutable Price before one atomic print publication", async () => {
    const product = productFixture();
    const proposed = proposalFrom(product, (value) => {
        value.options[0].amountCents = 12500;
        return value;
    });
    const { result: previewResult, store, stripe } = await preview({ product, proposal: proposed });
    const applied = await applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: previewResult.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1100,
    });
    assert.equal(applied.status, "completed");
    assert.equal(stripe.calls.priceCreates.length, 1);
    assert.equal(stripe.calls.priceDeletes.length, 0);
    assert.equal(stripe.calls.priceUpdates.length, 0);
    assert.equal(store.productWrites, 1);
    const saved = store.products.get(product.id).prints.options[0];
    assert.equal(saved.amountCents, 12500);
    assert.match(saved.stripePriceId, /^price_created_/);
    assert.equal(stripe.pricesById.get("price_100").active, true);

    const replay = await applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: previewResult.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1200,
    });
    assert.deepEqual(replay, applied);
    assert.equal(stripe.calls.priceCreates.length, 1);
    assert.equal(store.productWrites, 1);
});

test("apply preserves canonical Stripe Product image synchronization", async () => {
    const product = productFixture({
        primaryImageId: "primary",
        images: [{ id: "primary", storagePath: "airbrush/artwork-one.webp" }],
    });
    const stripe = fakeStripe();
    const store = fakeStore(product);
    const proposal = proposalFrom(product, (value) => {
        value.options[0].label = "Museum 16x20";
        return value;
    });
    const { result } = await preview({ product, proposal, store, stripe });
    const imageUrl = "https://firebasestorage.googleapis.com/v0/b/example/o/airbrush%2Fartwork-one.webp?alt=media";
    const applied = await applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: result.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1100,
        resolveProductImageUrl: async () => imageUrl,
    });
    assert.deepEqual(applied.warnings, []);
    assert.deepEqual(stripe.calls.productUpdates[0].params, { images: [imageUrl] });
});

test("apply creates and maps a canonical Product for a product with no prior Stripe identity", async () => {
    const product = productFixture({
        id: "new-artwork",
        title: "New Artwork",
        prints: { available: false, defaultOptionId: null, options: [] },
    });
    const store = fakeStore(product, null);
    const stripe = fakeStripe();
    const proposal = {
        available: true,
        defaultOptionId: "panorama-12x30",
        options: [{
            optionId: "panorama-12x30",
            label: "Panorama 12x30",
            amountCents: 15000,
            currency: "usd",
            active: true,
            sortOrder: 0,
        }],
    };
    const { result } = await preview({ product, proposal, store, stripe });
    assert.equal(result.items[0].classification, "CREATE_NEW_PRICE");
    assert.equal(stripe.calls.productCreates.length, 0);

    await applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: result.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1100,
    });

    assert.equal(stripe.calls.productCreates.length, 1);
    assert.equal(stripe.calls.priceCreates.length, 1);
    assert.match(store.mappings.get(product.id).stripeProductId, /^prod_created_/);
    assert.equal(store.products.get(product.id).prints.options[0].amountCents, 15000);
});

test("an interrupted applying operation can be retried with the same immutable identities", async () => {
    const product = productFixture();
    const proposed = proposalFrom(product, (value) => {
        value.options[0].amountCents = 12500;
        return value;
    });
    const { result, store, stripe } = await preview({ product, proposal: proposed });
    store.operations.get(result.operationId).status = "applying";

    const applied = await applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: result.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1100,
    });

    assert.equal(applied.status, "completed");
    assert.equal(stripe.calls.priceCreates.length, 1);
    assert.equal(store.productWrites, 1);
});

test("a concurrent completion returns the stored response without downgrading the operation", async () => {
    const product = productFixture();
    const proposed = proposalFrom(product, (value) => {
        value.options[0].amountCents = 12500;
        return value;
    });
    const { result, store, stripe } = await preview({ product, proposal: proposed });
    const concurrentResponse = {
        schemaVersion: 2,
        operationId: result.operationId,
        productId: product.id,
        status: "completed",
        stripeProductId: "prod_art",
        items: [],
    };
    store.publishPrintsAtomically = async () => {
        store.operations.set(result.operationId, {
            ...store.operations.get(result.operationId),
            status: "completed",
            response: concurrentResponse,
        });
        return { status: "completed", response: concurrentResponse };
    };

    const applied = await applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: result.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1100,
    });

    assert.deepEqual(applied, concurrentResponse);
    assert.equal(store.operations.get(result.operationId).status, "completed");
});

test("reverting to an earlier amount attaches the unique active matching Price", async () => {
    const product = productFixture({
        prints: {
            available: true,
            defaultOptionId: "16x20",
            options: [printOption({ amountCents: 12500, stripePriceId: "price_125" })],
        },
    });
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice(stripePrice("price_125", { unit_amount: 12500 }));
    const proposed = proposalFrom(product, (value) => {
        value.options[0].amountCents = 10000;
        return value;
    });
    const { result } = await preview({ product, proposal: proposed, store, stripe });
    assert.equal(result.items[0].classification, "ATTACH_EXISTING_PRICE");
    assert.equal(result.items[0].resolvedStripePriceId, "price_100");
});

test("a legacy canonical mapping is verified and upgraded lazily during apply", async () => {
    const product = productFixture();
    const store = fakeStore(product, { productId: product.id, stripeProductId: "prod_art" });
    const stripe = fakeStripe();
    const proposed = proposalFrom(product, (value) => {
        value.options[0].label = "Archival 16x20";
        return value;
    });
    const { result } = await preview({ product, proposal: proposed, store, stripe });
    const applied = await applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: result.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1100,
    });
    assert.equal(applied.status, "completed");
    assert.deepEqual(store.mappings.get(product.id), {
        schemaVersion: 2,
        productId: product.id,
        stripeProductId: "prod_art",
        livemode: true,
    });
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("wrong canonical Product on the current Price blocks preview", async () => {
    const product = productFixture();
    const stripe = fakeStripe();
    stripe.seedProduct(stripeProduct("prod_wrong"));
    stripe.seedPrice(stripePrice("price_100", { product: "prod_wrong" }));
    const { result } = await preview({ product, proposal: proposalFrom(product), store: fakeStore(product), stripe });
    assert.equal(result.items[0].classification, "CONFLICT_BLOCKED");
    assert.match(result.items[0].message, /another Product/i);
});

test("conflicting V2 commercial metadata on the current Price blocks preview", async () => {
    const product = productFixture();
    const stripe = fakeStripe();
    stripe.seedPrice(stripePrice("price_100", {
        metadata: {
            source: "likwit_admin_price_sync",
            schema_version: "2",
            firestore_product_id: product.id,
            print_option_id: "16x20",
            terms_hash: "not-the-current-commercial-hash",
        },
    }));

    const { result } = await preview({ product, proposal: proposalFrom(product), store: fakeStore(product), stripe });
    assert.equal(result.items[0].classification, "CONFLICT_BLOCKED");
    assert.match(result.items[0].message, /metadata/i);
});

test("a valid V2 current Price still permits an intentional amount change", async () => {
    const product = productFixture();
    const stripe = fakeStripe();
    const publishedTerms = canonicalPrintTerms({
        livemode: true,
        productId: product.id,
        optionId: "16x20",
        amountCents: 10000,
        currency: "usd",
        stripeProductId: "prod_art",
    });
    stripe.seedPrice(stripePrice("price_100", {
        metadata: {
            source: "likwit_admin_price_sync",
            schema_version: "2",
            firestore_product_id: product.id,
            print_option_id: "16x20",
            terms_hash: canonicalPrintTermsHash(publishedTerms),
        },
    }));
    const proposed = proposalFrom(product, (value) => {
        value.options[0].amountCents = 12500;
        return value;
    });

    const { result } = await preview({ product, proposal: proposed, store: fakeStore(product), stripe });
    assert.equal(result.items[0].classification, "CREATE_NEW_PRICE");
});

test("a Stripe Product mapped to another Firestore product blocks preview", async () => {
    const product = productFixture();
    const store = fakeStore(product);
    store.mappings.set("other-artwork", {
        schemaVersion: 2,
        productId: "other-artwork",
        stripeProductId: "prod_art",
        livemode: true,
    });

    await assert.rejects(
        () => preview({ product, proposal: proposalFrom(product), store, stripe: fakeStripe() }),
        (error) => error instanceof StripePriceSyncV2Error
            && error.reasonCode === "STRIPE_PRODUCT_MISMATCH"
    );
});

test("expired mapping claims recover while active claims block preview", async () => {
    const product = productFixture();
    const stripe = fakeStripe();
    const expiredStore = fakeStore(product, {
        productId: product.id,
        livemode: true,
        claimOperationId: "abandoned",
        claimExpiresAtMs: 999,
    });
    const expired = await preview({ product, store: expiredStore, stripe, nowMs: 1000 });
    assert.equal(expired.result.canApply, true);

    const activeStore = fakeStore(product, {
        productId: product.id,
        livemode: true,
        claimOperationId: "active",
        claimExpiresAtMs: 1001,
    });
    await assert.rejects(
        () => preview({ product, store: activeStore, stripe, nowMs: 1000 }),
        (error) => error instanceof StripePriceSyncV2Error && error.reasonCode === "MAPPING_BUSY"
    );
});

test("a legacy saved Price can establish its canonical mapping during apply", async () => {
    const product = productFixture();
    const stripe = fakeStripe();
    const store = fakeStore(product, null);
    const proposal = proposalFrom(product, (value) => {
        value.options[0].label = "Museum 16x20";
        return value;
    });
    const { result } = await preview({ product, proposal, store, stripe });
    assert.equal(result.stripeProductId, "prod_art");
    const applied = await applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: result.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1100,
    });
    assert.equal(applied.status, "completed");
    assert.equal(store.mappings.get(product.id).stripeProductId, "prod_art");
});

test("transient Stripe retrieval errors fail preview without creating a replacement", async () => {
    const product = productFixture();
    const stripe = fakeStripe();
    const store = fakeStore(product);
    stripe.prices.retrieve = async () => {
        throw Object.assign(new Error("network"), { code: "api_connection_error" });
    };
    await assert.rejects(
        () => preview({ product, store, stripe }),
        (error) => error instanceof StripePriceSyncV2Error
            && error.code === "unavailable"
            && error.reasonCode === "STRIPE_PRICE_UNAVAILABLE"
    );
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("wrong livemode, recurring, inactive, and duplicate exact Prices fail closed", async (t) => {
    const product = productFixture({ prints: { available: true, defaultOptionId: "16x20", options: [printOption({ stripePriceId: null })] } });
    const cases = [
        ["wrong livemode", [stripePrice("price_bad", { livemode: false })]],
        ["recurring", [stripePrice("price_bad", { type: "recurring" })]],
        ["inactive", [stripePrice("price_bad", { active: false })]],
        ["duplicates", [stripePrice("price_a"), stripePrice("price_b")]],
    ];
    for (const [name, candidates] of cases) {
        await t.test(name, async () => {
            const stripe = fakeStripe();
            stripe.pricesById.clear();
            for (const candidate of candidates) stripe.seedPrice(candidate);
            const { result } = await preview({ product, proposal: proposalFrom(product), store: fakeStore(product), stripe });
            assert.equal(result.items[0].classification, "CONFLICT_BLOCKED");
        });
    }
});

test("stale print or mapping state after Stripe success publishes nothing", async (t) => {
    for (const kind of ["active", "default", "remove", "order", "price", "mapping"]) {
        await t.test(kind, async () => {
            const product = productFixture();
            const proposed = proposalFrom(product, (value) => {
                value.options[0].amountCents = 12500;
                return value;
            });
            const { result, store, stripe } = await preview({ product, proposal: proposed });
            if (kind === "active") store.products.get(product.id).prints.options[0].active = false;
            if (kind === "default") store.products.get(product.id).prints.defaultOptionId = null;
            if (kind === "remove") store.products.get(product.id).prints.options = [];
            if (kind === "order") store.products.get(product.id).prints.options[0].sortOrder = 9;
            if (kind === "price") store.products.get(product.id).prints.options[0].stripePriceId = "price_other";
            if (kind === "mapping") store.mappings.get(product.id).stripeProductId = "prod_other";

            await assert.rejects(
                () => applyStripePrintPriceSyncV2({
                    productId: product.id,
                    operationId: result.operationId,
                    requestedBy: "admin-1",
                    stripe,
                    store,
                    expectedLivemode: true,
                    nowMs: 1100,
                }),
                (error) => error instanceof StripePriceSyncV2Error && error.code === "failed-precondition"
            );
            assert.equal(store.productWrites, 0);
        });
    }
});

test("one Price failure leaves every proposed option unpublished", async () => {
    const product = productFixture({
        prints: {
            available: true,
            defaultOptionId: "16x20",
            options: [
                printOption(),
                printOption({ id: "18x24", label: "18x24", amountCents: 20000, stripePriceId: "price_200", sortOrder: 1 }),
            ],
        },
    });
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice(stripePrice("price_200", { unit_amount: 20000, metadata: { firestore_product_id: product.id, print_option_id: "18x24" } }));
    const proposed = proposalFrom(product, (value) => {
        value.options[0].amountCents = 12500;
        value.options[1].amountCents = 22500;
        return value;
    });
    const { result } = await preview({ product, proposal: proposed, store, stripe });
    const create = stripe.prices.create.bind(stripe.prices);
    stripe.prices.create = async (params, options) => {
        if (params.metadata.print_option_id === "18x24") throw Object.assign(new Error("temporary"), { code: "api_error" });
        return create(params, options);
    };
    await assert.rejects(() => applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: result.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1100,
    }));
    assert.equal(store.productWrites, 0);
    assert.deepEqual(store.products.get(product.id).prints, product.prints);
    assert.equal([...stripe.pricesById.values()].some((price) => price.unit_amount === 12500), true);
});

test("disable and remove apply without mutating Stripe objects", async () => {
    const product = productFixture({
        prints: {
            available: false,
            defaultOptionId: null,
            options: [
                printOption(),
                printOption({ id: "18x24", label: "18x24", amountCents: 20000, stripePriceId: "price_200", sortOrder: 1 }),
            ],
        },
    });
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice(stripePrice("price_200", { unit_amount: 20000, metadata: { firestore_product_id: product.id, print_option_id: "18x24" } }));
    const proposed = proposalFrom(product, (value) => {
        value.options[0].active = false;
        value.options.splice(1, 1);
        return value;
    });
    const { result } = await preview({ product, proposal: proposed, store, stripe });
    await applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: result.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1100,
    });
    assert.equal(stripe.calls.priceCreates.length, 0);
    assert.equal(stripe.calls.priceUpdates.length, 0);
    assert.equal(stripe.calls.priceDeletes.length, 0);
    assert.deepEqual(store.products.get(product.id).prints.options, [printOption({ active: false })]);
    assert.equal(stripe.pricesById.get("price_200").active, true);
});

test("removing the only unsynced option does not create a Stripe Product", async () => {
    const product = productFixture({
        id: "unsynced-artwork",
        title: "Unsynced Artwork",
        prints: {
            available: false,
            defaultOptionId: null,
            options: [printOption({ stripePriceId: null, active: false })],
        },
    });
    const store = fakeStore(product, null);
    const stripe = fakeStripe();
    const proposed = { available: false, defaultOptionId: null, options: [] };
    const { result } = await preview({ product, proposal: proposed, store, stripe });
    assert.equal(result.items[0].classification, "REMOVE");

    await applyStripePrintPriceSyncV2({
        productId: product.id,
        operationId: result.operationId,
        requestedBy: "admin-1",
        stripe,
        store,
        expectedLivemode: true,
        nowMs: 1100,
    });

    assert.equal(stripe.calls.productCreates.length, 0);
    assert.equal(stripe.calls.priceCreates.length, 0);
    assert.deepEqual(store.products.get(product.id).prints.options, []);
});

test("disable verifies the saved Price before preserving its historical ID", async () => {
    const product = productFixture();
    const store = fakeStore(product);
    const stripe = fakeStripe();
    stripe.seedPrice(stripePrice("price_100", { active: false }));
    const proposed = proposalFrom(product, (value) => {
        value.available = false;
        value.defaultOptionId = null;
        value.options[0].active = false;
        return value;
    });

    const { result } = await preview({ product, proposal: proposed, store, stripe });
    assert.equal(result.items[0].classification, "CONFLICT_BLOCKED");
    assert.match(result.items[0].message, /inactive/i);
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("concurrent identical plans resolve to one commercial Price identity", async () => {
    const product = productFixture();
    const stripe = fakeStripe();
    const firstStore = fakeStore(product);
    const secondStore = fakeStore(product);
    const proposed = proposalFrom(product, (value) => {
        value.options[0].amountCents = 12500;
        return value;
    });
    const first = await preview({ product, proposal: proposed, store: firstStore, stripe });
    const second = await preview({ product, proposal: proposed, store: secondStore, stripe });
    await applyStripePrintPriceSyncV2({ productId: product.id, operationId: first.result.operationId, requestedBy: "admin-1", stripe, store: firstStore, expectedLivemode: true, nowMs: 1100 });
    await applyStripePrintPriceSyncV2({ productId: product.id, operationId: second.result.operationId, requestedBy: "admin-1", stripe, store: secondStore, expectedLivemode: true, nowMs: 1100 });
    const matching = [...stripe.pricesById.values()].filter((price) => price.unit_amount === 12500 && price.product === "prod_art");
    assert.equal(matching.length, 1);
    assert.equal(firstStore.products.get(product.id).prints.options[0].stripePriceId, matching[0].id);
    assert.equal(secondStore.products.get(product.id).prints.options[0].stripePriceId, matching[0].id);
});

test("created Price verification blocks wrong amount and currency before publication", async (t) => {
    for (const [name, patch] of [["amount", { unit_amount: 1 }], ["currency", { currency: "cad" }]]) {
        await t.test(name, async () => {
            const product = productFixture();
            const store = fakeStore(product);
            const stripe = fakeStripe();
            const proposed = proposalFrom(product, (value) => {
                value.options[0].amountCents = 12500;
                return value;
            });
            const { result } = await preview({ product, proposal: proposed, store, stripe });
            const create = stripe.prices.create.bind(stripe.prices);
            stripe.prices.create = async (params, options) => {
                const created = await create(params, options);
                const corrupted = { ...created, ...patch };
                stripe.pricesById.set(created.id, corrupted);
                return corrupted;
            };
            await assert.rejects(
                () => applyStripePrintPriceSyncV2({ productId: product.id, operationId: result.operationId, requestedBy: "admin-1", stripe, store, expectedLivemode: true, nowMs: 1100 }),
                (error) => error instanceof StripePriceSyncV2Error && error.code === "failed-precondition"
            );
            assert.equal(store.productWrites, 0);
        });
    }
});

test("apply rejects a current V2 Price whose commercial metadata changed after preview", async () => {
    const product = productFixture();
    const store = fakeStore(product);
    const stripe = fakeStripe();
    const terms = canonicalPrintTerms({
        livemode: true,
        productId: product.id,
        optionId: "16x20",
        amountCents: 10000,
        currency: "usd",
        stripeProductId: "prod_art",
    });
    stripe.seedPrice(stripePrice("price_100", {
        metadata: {
            firestore_product_id: product.id,
            print_option_id: "16x20",
            terms_hash: canonicalPrintTermsHash(terms),
        },
    }));
    const proposed = proposalFrom(product, (value) => {
        value.options[0].label = "Museum 16x20";
        return value;
    });
    const { result } = await preview({ product, proposal: proposed, store, stripe });
    stripe.pricesById.get("price_100").metadata.terms_hash = "changed-after-preview";

    await assert.rejects(
        () => applyStripePrintPriceSyncV2({
            productId: product.id,
            operationId: result.operationId,
            requestedBy: "admin-1",
            stripe,
            store,
            expectedLivemode: true,
            nowMs: 1100,
        }),
        (error) => error instanceof StripePriceSyncV2Error
            && error.reasonCode === "STRIPE_PRICE_CHANGED"
    );
    assert.equal(store.productWrites, 0);
});

test("callable requires admin and rejects obsolete v1 operations", async () => {
    const product = productFixture();
    const store = fakeStore(product);
    const stripe = fakeStripe();
    await assert.rejects(
        () => handleAdminStripePrintPriceSyncV2(
            { auth: { uid: "not-admin", token: {} }, data: { action: "preview", productId: product.id, proposedPrints: proposalFrom(product) } },
            { getStripe: () => stripe, store, expectedLivemode: true }
        ),
        (error) => error instanceof StripePriceSyncV2Error && error.code === "permission-denied"
    );
    store.operations.set("old_operation", { type: "stripe_print_price_sync", status: "confirmed", requestedBy: "admin-1", productId: product.id });
    await assert.rejects(
        () => handleAdminStripePrintPriceSyncV2(
            { auth: { uid: "admin-1", token: { admin: true } }, data: { action: "apply", productId: product.id, operationId: "old_operation" } },
            { getStripe: () => stripe, store, expectedLivemode: true }
        ),
        (error) => error instanceof StripePriceSyncV2Error
            && error.code === "failed-precondition"
            && /Preview again/i.test(error.message)
    );
});

test("the Function-first rollout remains compatible with the previous preview/create client", async () => {
    const product = productFixture();
    const store = fakeStore(product);
    const stripe = fakeStripe();
    const dependencies = { getStripe: () => stripe, store, expectedLivemode: true, nowMs: 1000 };
    const auth = { uid: "admin-1", token: { admin: true } };

    const previewResult = await handleAdminStripePrintPriceSyncV2(
        { auth, data: { action: "preview", productId: product.id } },
        dependencies
    );
    assert.equal(previewResult.status, "confirmed");
    assert.equal(previewResult.items[0].status, "existing");

    const applyResult = await handleAdminStripePrintPriceSyncV2(
        { auth, data: { action: "create", productId: product.id, operationId: previewResult.operationId } },
        { ...dependencies, nowMs: 1100 }
    );
    assert.equal(applyResult.status, "completed");
    assert.equal(store.productWrites, 1);
    assert.equal(stripe.calls.priceCreates.length, 0);
});

test("Firestore V2 adapter atomically publishes prints and completes the operation", async () => {
    const documents = new Map();
    let generated = 1;
    const ref = (collectionName, id) => ({ collectionName, id, path: `${collectionName}/${id}` });
    const snapshot = (documentRef) => {
        const value = documents.get(documentRef.path);
        return {
            exists: value !== undefined,
            id: documentRef.id,
            data: () => clone(value),
        };
    };
    const firestore = {
        collection(collectionName) {
            return {
                doc(id = `generated_${generated++}`) {
                    const documentRef = ref(collectionName, id);
                    documentRef.get = async () => snapshot(documentRef);
                    documentRef.set = async (value, options) => {
                        const current = options?.merge ? documents.get(documentRef.path) || {} : {};
                        documents.set(documentRef.path, { ...current, ...clone(value) });
                    };
                    return documentRef;
                },
            };
        },
        async runTransaction(callback) {
            const writes = [];
            const result = await callback({
                async get(documentRef) { return snapshot(documentRef); },
                set(documentRef, value, options) { writes.push(["set", documentRef, clone(value), options]); },
                update(documentRef, value) { writes.push(["update", documentRef, clone(value)]); },
            });
            for (const [kind, documentRef, value, options] of writes) {
                const current = kind === "set" && options?.merge ? documents.get(documentRef.path) || {} : documents.get(documentRef.path) || {};
                documents.set(documentRef.path, { ...current, ...value });
            }
            return result;
        },
    };
    const serverTimestamp = () => "server-time";
    const product = productFixture();
    documents.set(`shopProducts/${product.id}`, clone(product));
    documents.set(`adminStripePrintProductMappings/${product.id}`, {
        schemaVersion: 2,
        productId: product.id,
        stripeProductId: "prod_art",
        livemode: true,
    });
    const store = createFirestoreStripePriceSyncV2Store({ firestore, serverTimestamp, now: () => 1100 });
    const operationId = await store.createOperation({
        schemaVersion: 2,
        type: "stripe_print_price_sync_v2",
        status: "applying",
        productId: product.id,
        requestedBy: "admin-1",
        expiresAtMs: 2000,
        baseFingerprint: publishedPrintsFingerprint(product.prints),
        proposedPrints: proposalFrom(product, (value) => {
            value.options[0].label = "Updated label";
            return value;
        }),
        items: [{
            optionId: "16x20",
            currentStripePriceId: "price_100",
            classification: "REUSE_EXISTING_PRICE",
        }],
    });
    const operation = documents.get(`adminStripePriceSyncOperations/${operationId}`);
    operation.proposedFingerprint = proposedPrintsFingerprint(operation.proposedPrints, operation.items);
    const prints = clone(product.prints);
    prints.options[0].label = "Updated label";
    const response = { status: "completed", operationId, productId: product.id };
    const result = await store.publishPrintsAtomically({
        productId: product.id,
        operationId,
        requestedBy: "admin-1",
        expiresAtMs: 2000,
        baseFingerprint: publishedPrintsFingerprint(product.prints),
        mapping: { schemaVersion: 2, productId: product.id, stripeProductId: "prod_art", livemode: true },
        expectedLivemode: true,
        prints,
        response,
    });
    assert.deepEqual(result, { status: "updated" });
    assert.deepEqual(documents.get(`shopProducts/${product.id}`).prints, prints);
    assert.equal(documents.get(`shopProducts/${product.id}`).updatedAt, "server-time");
    assert.equal(documents.get(`adminStripePriceSyncOperations/${operationId}`).status, "completed");
    assert.deepEqual(documents.get(`adminStripePriceSyncOperations/${operationId}`).response, response);
});

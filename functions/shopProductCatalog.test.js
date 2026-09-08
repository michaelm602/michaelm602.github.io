"use strict";
/* global __dirname, require */

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const {
    assertValidShopProductDocument,
    isPublicShopProduct,
    validateShopProductDocument,
} = require("./shopProductSchema");
const {
    buildCatalogParityReport,
    mapSourceCatalog,
} = require("./shopProductMapper");
const {
    DEFAULT_PRODUCT_CATALOG_MODE,
    createShopProductRepository,
    resolveProductCatalogMode,
} = require("./shopProductRepository");
const { STRIPE_CATALOG } = require("./stripeCatalog");

async function loadSourceProducts() {
    const { getAllProducts } = await import("../src/data/products.js");
    return getAllProducts({ includeDrafts: true });
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function fakeFirestore(documents) {
    return {
        collection(name) {
            assert.equal(name, "shopProducts");
            return {
                async get() {
                    return {
                        docs: documents.map((document) => ({
                            id: document.id,
                            data: () => clone(document),
                        })),
                    };
                },
            };
        },
    };
}

test("all current storefront products map deterministically without catalog drift", async () => {
    const sourceProducts = await loadSourceProducts();
    const mapped = mapSourceCatalog(sourceProducts);

    assert.equal(mapped.length, 15);
    assert.deepEqual(mapSourceCatalog(sourceProducts), mapped);

    for (const [index, source] of sourceProducts.entries()) {
        const document = mapped[index];
        assert.equal(document.id, source.id);
        assert.equal(document.slug, source.slug);
        assert.equal(document.title, source.title);
        assert.equal(document.shortDescription, source.shortDescription);
        assert.equal(document.longDescription, source.description);
        assert.equal(document.category, source.category);
        assert.deepEqual(document.tags, source.tags);
        assert.equal(document.featured, source.featured);
        assert.equal(document.active, source.status === "active");
        assert.equal(document.sortOrder, index);
        assert.deepEqual(document.relatedProductIds, source.relatedProductIds);
        assert.deepEqual(
            document.images.map(({ storagePath, thumbnailPath, alt, sortOrder }) => ({
                storagePath,
                thumbnailPath,
                alt,
                sortOrder,
            })),
            source.images.map((image, imageIndex) => ({
                storagePath: image.full,
                thumbnailPath: image.thumb,
                alt: image.alt,
                sortOrder: imageIndex,
            }))
        );
        assert.deepEqual(
            document.prints.options.map((option) => ({
                label: option.label,
                amountCents: option.amountCents,
                stripePriceId: option.stripePriceId,
            })),
            source.sizes.map((size) => ({
                label: size.label,
                amountCents: size.price * 100,
                stripePriceId: size.stripePriceId,
            }))
        );
        assert.deepEqual(validateShopProductDocument(document), []);
    }
});

test("parity report preserves all 60 prices, image paths, IDs, and slugs", async () => {
    const sourceProducts = await loadSourceProducts();
    const mapped = mapSourceCatalog(sourceProducts);
    const report = buildCatalogParityReport(sourceProducts, mapped);

    assert.equal(report.valid, true);
    assert.deepEqual(report.summary, {
        productCount: 15,
        slugCount: 15,
        printOptionCount: 60,
        stripePriceIdCount: 60,
        imagePathCount: 15,
        thumbnailPathCount: 15,
    });
    assert.deepEqual(report.duplicateProductIds, []);
    assert.deepEqual(report.duplicateSlugs, []);
    assert.deepEqual(report.duplicateStripePriceIds, []);
    assert.deepEqual(report.missingStripePriceIds, []);
    assert.deepEqual(report.invalidPrices, []);
    assert.deepEqual(report.missingImagePaths, []);
    assert.deepEqual(report.parityErrors, []);

    const sourcePriceIds = sourceProducts.flatMap((product) =>
        product.sizes.map((size) => size.stripePriceId)
    );
    const mappedPriceIds = mapped.flatMap((product) =>
        product.prints.options.map((option) => option.stripePriceId)
    );
    assert.equal(new Set(mappedPriceIds).size, 60);
    assert.deepEqual(mappedPriceIds, sourcePriceIds);
});

test("Overwhelmed maps as sold with prints available and original checkout disabled", async () => {
    const mapped = mapSourceCatalog(await loadSourceProducts());
    const overwhelmed = mapped.find((product) => product.id === "overwhelmed");

    assert.deepEqual(overwhelmed.original, {
        status: "sold",
        size: "16x20",
        medium: null,
        price: { amountCents: null, currency: "usd" },
        checkoutEnabled: false,
        quantity: 0,
    });
    assert.equal(overwhelmed.prints.available, true);
    assert.equal(overwhelmed.prints.options.length, 4);
});

test("schema rejects invalid prices, missing Stripe IDs, and inconsistent states", async () => {
    const [valid] = mapSourceCatalog(await loadSourceProducts());
    assert.doesNotThrow(() => assertValidShopProductDocument(valid));

    const invalidPrice = clone(valid);
    invalidPrice.prints.options[0].amountCents = -1;
    assert.throws(() => assertValidShopProductDocument(invalidPrice), /amountCents/);

    const missingStripePrice = clone(valid);
    missingStripePrice.prints.options[0].stripePriceId = "";
    assert.throws(() => assertValidShopProductDocument(missingStripePrice), /stripePriceId/);

    const archivedAndActive = clone(valid);
    archivedAndActive.archivedAt = "2026-09-07T00:00:00.000Z";
    assert.throws(
        () => assertValidShopProductDocument(archivedAndActive),
        /archived.*active/i
    );
});

test("schema supports the planned original, print, portfolio-only, inactive, and archived states", async () => {
    const [base] = mapSourceCatalog(await loadSourceProducts());
    const originalContactOnly = clone(base);
    originalContactOnly.original = {
        status: "available",
        size: "16x20",
        medium: "Existing source metadata",
        price: { amountCents: 50000, currency: "usd" },
        checkoutEnabled: false,
        quantity: 1,
    };
    originalContactOnly.prints = { available: false, defaultOptionId: null, options: [] };

    const portfolioOnly = clone(base);
    portfolioOnly.channels = { shop: false, portfolio: true };

    const inactive = clone(base);
    inactive.active = false;

    const archived = clone(inactive);
    archived.archivedAt = "2026-09-07T00:00:00.000Z";

    for (const document of [base, originalContactOnly, portfolioOnly, inactive, archived]) {
        assert.deepEqual(validateShopProductDocument(document), []);
    }
});

test("parity reporting lists invalid source metadata instead of failing before the report", async () => {
    const sourceProducts = clone(await loadSourceProducts());
    sourceProducts[0].sizes[0].stripePriceId = "";
    sourceProducts[1].sizes[0].price = -5;
    sourceProducts[2].images[0].full = "";
    sourceProducts[3].id = sourceProducts[2].id;
    sourceProducts[4].slug = sourceProducts[2].slug;

    const report = buildCatalogParityReport(sourceProducts, mapSourceCatalog(sourceProducts));
    assert.equal(report.valid, false);
    assert.deepEqual(report.missingStripePriceIds, ["adoration-in-the-lights-darkness:16x20"]);
    assert.deepEqual(report.invalidPrices, ["alter-ego:16x20"]);
    assert.deepEqual(report.missingImagePaths, ["blind-faith:image-1"]);
    assert.deepEqual(report.duplicateProductIds, ["blind-faith"]);
    assert.deepEqual(report.duplicateSlugs, ["blind-faith"]);
});

test("future public queries exclude inactive, archived, and non-shop products", async () => {
    const [base] = mapSourceCatalog(await loadSourceProducts());
    assert.equal(isPublicShopProduct(base), true);

    const inactive = { ...base, active: false };
    const archived = { ...base, active: false, archivedAt: "2026-09-07T00:00:00.000Z" };
    const portfolioOnly = { ...base, channels: { shop: false, portfolio: true } };

    assert.equal(isPublicShopProduct(inactive), false);
    assert.equal(isPublicShopProduct(archived), false);
    assert.equal(isPublicShopProduct(portfolioOnly), false);
});

test("source catalog remains the default whole-catalog repository mode", async () => {
    assert.equal(DEFAULT_PRODUCT_CATALOG_MODE, "source");
    assert.equal(resolveProductCatalogMode({}), "source");

    const repository = createShopProductRepository({
        env: {},
        sourceCatalog: STRIPE_CATALOG,
    });
    assert.equal(repository.mode, "source");
    assert.deepEqual(await repository.loadCheckoutCatalog(), STRIPE_CATALOG);
});

test("Firestore mode loads one complete source without per-product fallback", async () => {
    const documents = mapSourceCatalog(await loadSourceProducts());
    const oneVisible = documents.find((product) => product.id === "serenity");
    const inactive = { ...documents[0], active: false };
    const repository = createShopProductRepository({
        env: { PRODUCT_CATALOG_MODE: "firestore" },
        firestore: fakeFirestore([oneVisible, inactive]),
        sourceCatalog: STRIPE_CATALOG,
    });

    const catalog = await repository.loadCheckoutCatalog();
    assert.equal(repository.mode, "firestore");
    assert.deepEqual(Object.keys(catalog), ["serenity"]);
    assert.deepEqual(catalog.serenity, STRIPE_CATALOG.serenity);
});

test("checkout remains wired to the existing trusted static server catalog", () => {
    const indexSource = readFileSync(path.join(__dirname, "index.js"), "utf8");
    assert.match(indexSource, /require\("\.\/stripeCatalog"\)/);
    assert.doesNotMatch(indexSource, /require\("\.\/shopProductRepository"\)/);
    assert.match(indexSource, /await buildTrustedCheckout\(/);
});

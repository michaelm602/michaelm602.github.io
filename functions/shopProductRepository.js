"use strict";
/* global module, process, require */

const { STRIPE_CATALOG } = require("./stripeCatalog");
const {
    SHOP_PRODUCTS_COLLECTION,
    assertValidShopProductDocument,
    isPublicShopProduct,
} = require("./shopProductSchema");

const DEFAULT_PRODUCT_CATALOG_MODE = "source";
const FIRESTORE_PRODUCT_CATALOG_MODE = "firestore";
const PRODUCT_CATALOG_MODE_ENV_VAR = "PRODUCT_CATALOG_MODE";

function resolveProductCatalogMode(env = process.env) {
    const value = env?.[PRODUCT_CATALOG_MODE_ENV_VAR];
    if (value === undefined || value === null || String(value).trim() === "") {
        return DEFAULT_PRODUCT_CATALOG_MODE;
    }
    const normalized = String(value).trim().toLowerCase();
    if (![DEFAULT_PRODUCT_CATALOG_MODE, FIRESTORE_PRODUCT_CATALOG_MODE].includes(normalized)) {
        throw new Error(
            `${PRODUCT_CATALOG_MODE_ENV_VAR} must be "source" or "firestore", received "${value}".`
        );
    }
    return normalized;
}

function firestoreDocumentsToCheckoutCatalog(documents) {
    const catalog = {};
    const sorted = [...documents].sort(
        (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
    );

    for (const document of sorted) {
        if (!isPublicShopProduct(document) || !document.prints.available) continue;
        const sizes = Object.fromEntries(
            document.prints.options
                .filter((option) => option.active)
                .sort((left, right) => left.sortOrder - right.sortOrder)
                .map((option) => [option.label, option.stripePriceId])
        );
        if (!Object.keys(sizes).length) continue;
        catalog[document.id] = { title: document.title, sizes };
    }
    return catalog;
}

function createShopProductRepository({
    env = process.env,
    mode = resolveProductCatalogMode(env),
    sourceCatalog = STRIPE_CATALOG,
    firestore = null,
} = {}) {
    if (![DEFAULT_PRODUCT_CATALOG_MODE, FIRESTORE_PRODUCT_CATALOG_MODE].includes(mode)) {
        throw new Error(`Unsupported product catalog mode: ${mode}`);
    }

    return {
        mode,
        async loadCheckoutCatalog() {
            if (mode === DEFAULT_PRODUCT_CATALOG_MODE) return sourceCatalog;
            if (!firestore?.collection) {
                throw new Error("Firestore is required when product catalog mode is firestore.");
            }

            const snapshot = await firestore.collection(SHOP_PRODUCTS_COLLECTION).get();
            const documents = snapshot.docs.map((snapshotDocument) => {
                const document = snapshotDocument.data();
                if (document.id !== snapshotDocument.id) {
                    throw new Error(
                        `Firestore product document ID mismatch: ${snapshotDocument.id} != ${document.id}.`
                    );
                }
                return assertValidShopProductDocument(document);
            });
            return firestoreDocumentsToCheckoutCatalog(documents);
        },
    };
}

module.exports = {
    DEFAULT_PRODUCT_CATALOG_MODE,
    FIRESTORE_PRODUCT_CATALOG_MODE,
    PRODUCT_CATALOG_MODE_ENV_VAR,
    createShopProductRepository,
    firestoreDocumentsToCheckoutCatalog,
    resolveProductCatalogMode,
};

"use strict";
/* global module, require */

const { validateShopProductDocument } = require("./shopProductSchema");

const DEFAULT_CURRENCY = "usd";

function normalizeOptionId(label, index) {
    const normalized = String(label || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return normalized || `option-${index + 1}`;
}

function mapOriginal(original = null) {
    const status = original?.status || "not_for_sale";
    const rawAmount = original?.price?.amountCents;
    const amountCents = Number.isSafeInteger(rawAmount) ? rawAmount : null;

    return {
        status,
        size: original?.size || null,
        medium: original?.medium || null,
        price: {
            amountCents,
            currency: String(original?.price?.currency || DEFAULT_CURRENCY).toLowerCase(),
        },
        checkoutEnabled: false,
        quantity: status === "available" ? 1 : 0,
    };
}

function mapSourceProduct(product, sortOrder = 0) {
    const images = (product.images || []).map((image, index) => ({
        id: `image-${index + 1}`,
        storagePath: image.full || "",
        thumbnailPath: image.thumb || null,
        alt: image.alt || "",
        sortOrder: index,
    }));
    const options = (product.sizes || []).map((size, index) => ({
        id: normalizeOptionId(size.label, index),
        label: size.label,
        amountCents: Number.isFinite(size.price) ? Math.round(size.price * 100) : null,
        currency: DEFAULT_CURRENCY,
        stripePriceId: size.stripePriceId || "",
        active: true,
        sortOrder: index,
    }));
    const defaultOption = options.find((option) => option.label === product.defaultSize) || null;
    const printsAvailable = product.printsAvailable !== false && options.length > 0;

    return {
        id: product.id,
        slug: product.slug,
        title: product.title,
        shortDescription: product.shortDescription || "",
        longDescription: product.description || "",
        category: product.category,
        tags: [...(product.tags || [])],
        images,
        primaryImageId: images[0]?.id || null,
        original: mapOriginal(product.original),
        prints: {
            available: printsAvailable,
            defaultOptionId: printsAvailable ? defaultOption?.id || options[0]?.id || null : null,
            options,
        },
        channels: {
            shop: product.channels?.shop ?? true,
            portfolio: product.channels?.portfolio ?? true,
        },
        active: product.status === "active",
        featured: Boolean(product.featured),
        sortOrder,
        relatedProductIds: [...(product.relatedProductIds || [])],
        seo: {
            title: product.seo?.title || "",
            description: product.seo?.description || "",
        },
        createdAt: null,
        updatedAt: null,
        archivedAt: null,
    };
}

function mapSourceCatalog(products) {
    if (!Array.isArray(products)) throw new Error("Source products must be an array.");
    return products.map((product, index) => mapSourceProduct(product, index));
}

function duplicates(values) {
    const seen = new Set();
    const repeated = new Set();
    for (const value of values) {
        if (seen.has(value)) repeated.add(value);
        seen.add(value);
    }
    return [...repeated].sort();
}

function sameJson(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function buildCatalogParityReport(sourceProducts, documents) {
    const source = Array.isArray(sourceProducts) ? sourceProducts : [];
    const mapped = Array.isArray(documents) ? documents : [];
    const mappedOptions = mapped.flatMap((product) =>
        (product.prints?.options || []).map((option) => ({ productId: product.id, ...option }))
    );
    const mappedImages = mapped.flatMap((product) =>
        (product.images || []).map((image) => ({ productId: product.id, ...image }))
    );
    const missingStripePriceIds = mappedOptions
        .filter((option) => option.active && !option.stripePriceId)
        .map((option) => `${option.productId}:${option.label}`);
    const invalidPrices = mappedOptions
        .filter((option) => !Number.isSafeInteger(option.amountCents) || option.amountCents <= 0)
        .map((option) => `${option.productId}:${option.label}`);
    const missingImagePaths = mappedImages
        .filter((image) => !image.storagePath)
        .map((image) => `${image.productId}:${image.id}`);
    const parityErrors = [];

    if (source.length !== mapped.length) {
        parityErrors.push(`Product count changed from ${source.length} to ${mapped.length}.`);
    }

    source.forEach((product, index) => {
        const document = mapped[index];
        if (!document) return;
        const fields = ["id", "slug", "title", "category"];
        for (const field of fields) {
            if (document[field] !== product[field]) {
                parityErrors.push(`${product.id || index}: ${field} changed.`);
            }
        }
        if (!sameJson(document.tags, product.tags || [])) parityErrors.push(`${product.id}: tags changed.`);
        if (document.featured !== Boolean(product.featured)) parityErrors.push(`${product.id}: featured changed.`);
        if (document.active !== (product.status === "active")) parityErrors.push(`${product.id}: active state changed.`);

        const sourceImagePaths = (product.images || []).map((image) => image.full);
        const mappedImagePaths = (document.images || []).map((image) => image.storagePath);
        if (!sameJson(mappedImagePaths, sourceImagePaths)) parityErrors.push(`${product.id}: image paths changed.`);

        const sourcePrints = (product.sizes || []).map((size) => ({
            label: size.label,
            amountCents: Number.isFinite(size.price) ? Math.round(size.price * 100) : null,
            stripePriceId: size.stripePriceId,
        }));
        const mappedPrints = (document.prints?.options || []).map((option) => ({
            label: option.label,
            amountCents: option.amountCents,
            stripePriceId: option.stripePriceId,
        }));
        if (!sameJson(mappedPrints, sourcePrints)) parityErrors.push(`${product.id}: print options changed.`);
        for (const issue of validateShopProductDocument(document)) {
            parityErrors.push(`${product.id}: ${issue}`);
        }
    });

    const duplicateProductIds = duplicates(mapped.map((product) => product.id));
    const duplicateSlugs = duplicates(mapped.map((product) => product.slug));
    const duplicateStripePriceIds = duplicates(mappedOptions.map((option) => option.stripePriceId).filter(Boolean));
    const summary = {
        productCount: mapped.length,
        slugCount: new Set(mapped.map((product) => product.slug)).size,
        printOptionCount: mappedOptions.length,
        stripePriceIdCount: mappedOptions.filter((option) => option.stripePriceId).length,
        imagePathCount: mappedImages.filter((image) => image.storagePath).length,
        thumbnailPathCount: mappedImages.filter((image) => image.thumbnailPath).length,
    };
    const report = {
        summary,
        duplicateProductIds,
        duplicateSlugs,
        duplicateStripePriceIds,
        missingStripePriceIds,
        invalidPrices,
        missingImagePaths,
        parityErrors,
    };
    report.valid = Object.entries(report)
        .filter(([key]) => key !== "summary")
        .every(([, value]) => !Array.isArray(value) || value.length === 0);
    return report;
}

module.exports = {
    DEFAULT_CURRENCY,
    buildCatalogParityReport,
    mapSourceCatalog,
    mapSourceProduct,
};

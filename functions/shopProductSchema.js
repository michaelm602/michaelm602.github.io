"use strict";
/* global module */

const SHOP_PRODUCTS_COLLECTION = "shopProducts";
const ORIGINAL_STATUSES = Object.freeze(["available", "sold", "not_for_sale"]);

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTimestampValue(value) {
    return (
        value === null ||
        value instanceof Date ||
        typeof value === "string" ||
        (isPlainObject(value) && typeof value.toDate === "function")
    );
}

function validateShopProductDocument(document) {
    const issues = [];
    const add = (path, message) => issues.push(`${path}: ${message}`);
    const requireString = (value, path, { allowEmpty = false } = {}) => {
        if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
            add(path, allowEmpty ? "must be a string" : "must be a non-empty string");
        }
    };
    const requireNullableString = (value, path) => {
        if (value !== null && typeof value !== "string") {
            add(path, "must be a string or null");
        }
    };

    if (!isPlainObject(document)) return ["document: must be an object"];

    requireString(document.id, "id");
    requireString(document.slug, "slug");
    requireString(document.title, "title");
    requireString(document.shortDescription, "shortDescription", { allowEmpty: true });
    requireString(document.longDescription, "longDescription", { allowEmpty: true });
    requireString(document.category, "category");

    if (!Array.isArray(document.tags) || document.tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
        add("tags", "must be an array of non-empty strings");
    }

    if (!Array.isArray(document.images)) {
        add("images", "must be an array");
    } else if (document.images.length === 0) {
        if (document.active && document.channels?.shop) {
            add("images", "must contain at least one image for an active shop product");
        }
        if (document.primaryImageId !== null) {
            add("primaryImageId", "must be null when images are empty");
        }
    } else {
        const imageIds = new Set();
        document.images.forEach((image, index) => {
            const path = `images[${index}]`;
            if (!isPlainObject(image)) {
                add(path, "must be an object");
                return;
            }
            requireString(image.id, `${path}.id`);
            requireString(image.storagePath, `${path}.storagePath`);
            requireNullableString(image.thumbnailPath, `${path}.thumbnailPath`);
            requireString(image.alt, `${path}.alt`, { allowEmpty: true });
            if (!Number.isSafeInteger(image.sortOrder) || image.sortOrder < 0) {
                add(`${path}.sortOrder`, "must be a non-negative integer");
            }
            if (imageIds.has(image.id)) add(`${path}.id`, "must be unique within images");
            imageIds.add(image.id);
        });
        if (typeof document.primaryImageId !== "string" || !imageIds.has(document.primaryImageId)) {
            add("primaryImageId", "must reference an image ID");
        }
    }

    const original = document.original;
    if (!isPlainObject(original)) {
        add("original", "must be an object");
    } else {
        if (!ORIGINAL_STATUSES.includes(original.status)) {
            add("original.status", `must be one of ${ORIGINAL_STATUSES.join(", ")}`);
        }
        requireNullableString(original.size, "original.size");
        requireNullableString(original.medium, "original.medium");
        if (!isPlainObject(original.price)) {
            add("original.price", "must be an object");
        } else {
            const amount = original.price.amountCents;
            if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)) {
                add("original.price.amountCents", "must be a positive integer or null");
            }
            if (typeof original.price.currency !== "string" || !/^[a-z]{3}$/.test(original.price.currency)) {
                add("original.price.currency", "must be a lowercase three-letter currency code");
            }
        }
        if (original.checkoutEnabled !== false) {
            add("original.checkoutEnabled", "must remain false until trusted original checkout exists");
        }
        if (![0, 1].includes(original.quantity)) {
            add("original.quantity", "must be 0 or 1");
        }
        if (original.status === "available" && original.quantity !== 1) {
            add("original.quantity", "must be 1 when the original is available");
        }
        if (["sold", "not_for_sale"].includes(original.status) && original.quantity !== 0) {
            add("original.quantity", "must be 0 when the original is sold or not for sale");
        }
    }

    const prints = document.prints;
    if (!isPlainObject(prints)) {
        add("prints", "must be an object");
    } else {
        if (typeof prints.available !== "boolean") add("prints.available", "must be a boolean");
        if (!Array.isArray(prints.options)) {
            add("prints.options", "must be an array");
        } else {
            const optionIds = new Set();
            prints.options.forEach((option, index) => {
                const path = `prints.options[${index}]`;
                if (!isPlainObject(option)) {
                    add(path, "must be an object");
                    return;
                }
                requireString(option.id, `${path}.id`);
                requireString(option.label, `${path}.label`);
                if (!Number.isSafeInteger(option.amountCents) || option.amountCents <= 0) {
                    add(`${path}.amountCents`, "must be a positive integer");
                }
                if (typeof option.currency !== "string" || !/^[a-z]{3}$/.test(option.currency)) {
                    add(`${path}.currency`, "must be a lowercase three-letter currency code");
                }
                if (typeof option.active !== "boolean") add(`${path}.active`, "must be a boolean");
                if (!Number.isSafeInteger(option.sortOrder) || option.sortOrder < 0) {
                    add(`${path}.sortOrder`, "must be a non-negative integer");
                }
                if (option.active) requireString(option.stripePriceId, `${path}.stripePriceId`);
                else requireNullableString(option.stripePriceId, `${path}.stripePriceId`);
                if (optionIds.has(option.id)) add(`${path}.id`, "must be unique within print options");
                optionIds.add(option.id);
            });

            if (prints.available) {
                if (!prints.options.some((option) => option?.active)) {
                    add("prints.options", "must contain an active option when prints are available");
                }
                if (typeof prints.defaultOptionId !== "string" || !optionIds.has(prints.defaultOptionId)) {
                    add("prints.defaultOptionId", "must reference a print option ID");
                }
            } else if (prints.defaultOptionId !== null) {
                add("prints.defaultOptionId", "must be null when prints are unavailable");
            }
        }
    }

    if (!isPlainObject(document.channels)) {
        add("channels", "must be an object");
    } else {
        if (typeof document.channels.shop !== "boolean") add("channels.shop", "must be a boolean");
        if (typeof document.channels.portfolio !== "boolean") add("channels.portfolio", "must be a boolean");
    }

    for (const field of ["active", "featured"]) {
        if (typeof document[field] !== "boolean") add(field, "must be a boolean");
    }
    if (!Number.isSafeInteger(document.sortOrder) || document.sortOrder < 0) {
        add("sortOrder", "must be a non-negative integer");
    }
    if (!Array.isArray(document.relatedProductIds) || document.relatedProductIds.some((id) => typeof id !== "string")) {
        add("relatedProductIds", "must be an array of strings");
    }

    if (!isPlainObject(document.seo)) {
        add("seo", "must be an object");
    } else {
        requireString(document.seo.title, "seo.title", { allowEmpty: true });
        requireString(document.seo.description, "seo.description", { allowEmpty: true });
    }

    for (const field of ["createdAt", "updatedAt", "archivedAt"]) {
        if (!isTimestampValue(document[field])) add(field, "must be a timestamp value or null");
    }
    if (document.archivedAt !== null && document.active) {
        add("archivedAt", "an archived product cannot remain active");
    }

    return issues;
}

function assertValidShopProductDocument(document) {
    const issues = validateShopProductDocument(document);
    if (issues.length) {
        const id = typeof document?.id === "string" ? document.id : "unknown";
        throw new Error(`Invalid shop product ${id}: ${issues.join("; ")}`);
    }
    return document;
}

function isPublicShopProduct(document) {
    return Boolean(document?.active && !document?.archivedAt && document?.channels?.shop);
}

module.exports = {
    ORIGINAL_STATUSES,
    SHOP_PRODUCTS_COLLECTION,
    assertValidShopProductDocument,
    isPublicShopProduct,
    validateShopProductDocument,
};

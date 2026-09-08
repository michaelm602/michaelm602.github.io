export const ORIGINAL_CHECKOUT_WARNING =
  "Original online checkout is disabled. Available originals should use contact-to-purchase until one-of-one inventory checkout is implemented.";
const ORIGINAL_STATUSES = new Set(["available", "sold", "not_for_sale"]);
const PRODUCT_PATH_PATTERN = /^(airbrush|photoshop)\/.+/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY_PATTERN = /^[a-z]{3}$/;
const MAX_IMAGES = 8;
const MAX_PRINT_OPTIONS = 8;
const MAX_STRING_LIST_ITEMS = 12;
const PRODUCT_KEYS = [
  "id", "slug", "title", "shortDescription", "longDescription", "category",
  "tags", "images", "primaryImageId", "original", "prints", "channels",
  "active", "featured", "sortOrder", "relatedProductIds", "seo",
  "createdAt", "updatedAt", "archivedAt",
];
const IMAGE_KEYS = ["id", "storagePath", "thumbnailPath", "alt", "sortOrder"];
const ORIGINAL_KEYS = ["status", "size", "medium", "price", "checkoutEnabled", "quantity"];
const PRICE_KEYS = ["amountCents", "currency"];
const PRINTS_KEYS = ["available", "defaultOptionId", "options"];
const PRINT_OPTION_KEYS = ["id", "label", "amountCents", "currency", "stripePriceId", "active", "sortOrder"];
const CHANNEL_KEYS = ["shop", "portfolio"];
const SEO_KEYS = ["title", "description"];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function integerOr(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

function nullablePositiveInteger(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : value;
}

function normalizedId(value, fallback) {
  const id = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return id || fallback;
}

export function normalizeCurrency(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return CURRENCY_PATTERN.test(normalized) ? normalized : "usd";
}

export function createUniquePrintOptionId(value, options = [], excludedIndex = -1) {
  const usedIds = new Set(
    (Array.isArray(options) ? options : [])
      .filter((_, index) => index !== excludedIndex)
      .map((option) => normalizedId(option?.id, ""))
      .filter(Boolean)
  );
  const requested = normalizedId(value, "");
  if (!requested) {
    let index = 1;
    while (usedIds.has(`option-${index}`)) index += 1;
    return `option-${index}`;
  }
  if (!usedIds.has(requested)) return requested;
  let suffix = 2;
  while (usedIds.has(`${requested}-${suffix}`)) suffix += 1;
  return `${requested}-${suffix}`;
}

export function deriveOriginalQuantity(status) {
  return status === "available" ? 1 : 0;
}

export function isAllowedProductImagePath(path) {
  return typeof path === "string"
    && path.trim().length <= 500
    && PRODUCT_PATH_PATTERN.test(path.trim());
}

export function createBlankAdminProduct() {
  return {
    id: "",
    slug: "",
    title: "",
    shortDescription: "",
    longDescription: "",
    category: "",
    tags: [],
    images: [],
    primaryImageId: null,
    original: {
      status: "not_for_sale",
      size: null,
      medium: null,
      price: { amountCents: null, currency: "usd" },
      checkoutEnabled: false,
      quantity: 0,
    },
    prints: { available: false, defaultOptionId: null, options: [] },
    channels: { shop: false, portfolio: false },
    active: false,
    featured: false,
    sortOrder: 0,
    relatedProductIds: [],
    seo: { title: "", description: "" },
    createdAt: null,
    updatedAt: null,
    archivedAt: null,
  };
}

export function cloneAdminProduct(product) {
  const original = isPlainObject(product?.original) ? product.original : {};
  const price = isPlainObject(original.price) ? original.price : {};
  const prints = isPlainObject(product?.prints) ? product.prints : {};
  const channels = isPlainObject(product?.channels) ? product.channels : {};
  const seo = isPlainObject(product?.seo) ? product.seo : {};
  return {
    ...createBlankAdminProduct(),
    ...product,
    tags: Array.isArray(product?.tags) ? [...product.tags] : [],
    images: Array.isArray(product?.images) ? product.images.map((image) => ({ ...image })) : [],
    original: {
      ...createBlankAdminProduct().original,
      ...original,
      price: {
        ...createBlankAdminProduct().original.price,
        ...price,
      },
      checkoutEnabled: false,
    },
    prints: {
      ...createBlankAdminProduct().prints,
      ...prints,
      options: Array.isArray(prints.options) ? prints.options.map((option) => ({ ...option })) : [],
    },
    channels: {
      ...createBlankAdminProduct().channels,
      ...channels,
    },
    relatedProductIds: Array.isArray(product?.relatedProductIds) ? [...product.relatedProductIds] : [],
    seo: { ...createBlankAdminProduct().seo, ...seo },
  };
}

export function normalizeAdminProductForSave(product) {
  const draft = cloneAdminProduct(product);
  const images = draft.images.slice(0, MAX_IMAGES).map((image, index) => ({
    id: normalizedId(image.id, `image-${index + 1}`),
    storagePath: String(image.storagePath || "").trim(),
    thumbnailPath: String(image.thumbnailPath || "").trim() || null,
    alt: String(image.alt || "").trim(),
    sortOrder: integerOr(image.sortOrder, index),
  }));
  const options = draft.prints.options.slice(0, MAX_PRINT_OPTIONS).map((option, index) => ({
    id: normalizedId(option.id || option.label, `option-${index + 1}`),
    label: String(option.label || "").trim(),
    amountCents: nullablePositiveInteger(option.amountCents),
    currency: normalizeCurrency(option.currency),
    stripePriceId: String(option.stripePriceId || "").trim() || null,
    active: Boolean(option.active),
    sortOrder: integerOr(option.sortOrder, index),
  }));
  const activeOptionIds = new Set(options.filter((option) => option.active).map((option) => option.id));
  const printsAvailable = Boolean(draft.prints.available);
  const requestedDefault = draft.prints.defaultOptionId;

  return {
    id: String(draft.id || "").trim(),
    slug: String(draft.slug || "").trim().toLowerCase(),
    title: String(draft.title || "").trim(),
    shortDescription: String(draft.shortDescription || "").trim(),
    longDescription: String(draft.longDescription || "").trim(),
    category: String(draft.category || "").trim(),
    tags: draft.tags.map((tag) => String(tag).trim()).filter(Boolean),
    images,
    primaryImageId: images.some((image) => image.id === draft.primaryImageId)
      ? draft.primaryImageId
      : images[0]?.id || null,
    original: {
      status: draft.original.status,
      size: String(draft.original.size || "").trim() || null,
      medium: String(draft.original.medium || "").trim() || null,
      price: {
        amountCents: nullablePositiveInteger(draft.original.price?.amountCents),
        currency: normalizeCurrency(draft.original.price?.currency),
      },
      checkoutEnabled: false,
      quantity: deriveOriginalQuantity(draft.original.status),
    },
    prints: {
      available: printsAvailable,
      defaultOptionId: printsAvailable
        ? activeOptionIds.has(requestedDefault)
          ? requestedDefault
          : options.find((option) => option.active)?.id || null
        : null,
      options,
    },
    channels: {
      shop: Boolean(draft.channels.shop),
      portfolio: Boolean(draft.channels.portfolio),
    },
    active: Boolean(draft.active),
    featured: Boolean(draft.featured),
    sortOrder: integerOr(draft.sortOrder, 0),
    relatedProductIds: draft.relatedProductIds.map((id) => String(id).trim()).filter(Boolean),
    seo: {
      title: String(draft.seo.title || "").trim(),
      description: String(draft.seo.description || "").trim(),
    },
    createdAt: draft.createdAt ?? null,
    updatedAt: draft.updatedAt ?? null,
    archivedAt: draft.archivedAt ?? null,
  };
}

function validateObjectShape(value, allowedKeys, label, add) {
  if (!isPlainObject(value)) {
    add(`${label} must be an object.`);
    return false;
  }
  const actualKeys = Object.keys(value);
  const unknownKeys = actualKeys.filter((key) => !allowedKeys.includes(key));
  const missingKeys = allowedKeys.filter((key) => !Object.hasOwn(value, key));
  if (unknownKeys.length) add(`${label} contains unsupported fields: ${unknownKeys.join(", ")}.`);
  if (missingKeys.length) add(`${label} is missing required fields: ${missingKeys.join(", ")}.`);
  return true;
}

function validateText(value, label, maxLength, add, { required = false, nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "string") {
    add(`${label} must be ${nullable ? "a string or null" : "a string"}.`);
    return;
  }
  const trimmed = value.trim();
  if (required && !trimmed) add(`${label} is required.`);
  if (trimmed.length > maxLength) add(`${label} must be no more than ${maxLength} characters.`);
}

function currencyForValidation(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized || "usd";
}

export function validateAdminProduct(product) {
  const errors = [];
  const warnings = [];
  const add = (message) => errors.push(message);

  if (!isPlainObject(product)) return { errors: ["Product data is required."], warnings };
  validateObjectShape(product, PRODUCT_KEYS, "Product", add);
  validateText(product.id, "Product ID", 100, add, { required: true });
  if (typeof product.id === "string" && product.id.trim() && !SLUG_PATTERN.test(product.id.trim())) {
    add("Product ID must use lowercase letters, numbers, and hyphens.");
  }
  validateText(product.slug, "Slug", 150, add, { required: true });
  if (typeof product.slug === "string" && product.slug.trim() && !SLUG_PATTERN.test(product.slug.trim())) {
    add("Slug must use lowercase letters, numbers, and hyphens.");
  }
  validateText(product.title, "Title", 200, add, { required: true });
  validateText(product.shortDescription, "Short description", 500, add);
  validateText(product.longDescription, "Long description", 5000, add);
  validateText(product.category, "Category", 100, add, { required: true });
  if (!Array.isArray(product.tags) || product.tags.length > MAX_STRING_LIST_ITEMS) {
    add(`Tags must contain no more than ${MAX_STRING_LIST_ITEMS} values.`);
  } else {
    product.tags.forEach((tag, index) => {
      if (typeof tag === "string" && !tag.trim()) return;
      validateText(tag, `Tag ${index + 1}`, 100, add, { required: true });
    });
  }
  if (!Array.isArray(product.relatedProductIds) || product.relatedProductIds.length > MAX_STRING_LIST_ITEMS) {
    add(`Related products must contain no more than ${MAX_STRING_LIST_ITEMS} IDs.`);
  } else {
    product.relatedProductIds.forEach((id, index) => validateText(id, `Related product ${index + 1}`, 100, add, { required: true }));
  }

  const images = Array.isArray(product.images) ? product.images : [];
  if (!Array.isArray(product.images)) add("Images must be a list.");
  if (images.length > MAX_IMAGES) add(`Products can have no more than ${MAX_IMAGES} images.`);
  if (product.active && product.channels?.shop && images.length === 0) {
    add("Active shop products require at least one image.");
  }
  const imageIds = new Set();
  const normalizedImageIds = new Set();
  images.forEach((image, index) => {
    const label = `Image ${index + 1}`;
    if (!validateObjectShape(image, IMAGE_KEYS, label, add)) return;
    validateText(image.id, `${label} ID`, 100, add, { required: true });
    if (typeof image.id === "string" && image.id.trim() && !SLUG_PATTERN.test(image.id.trim())) {
      add(`${label} ID must use lowercase letters, numbers, and hyphens.`);
    }
    if (imageIds.has(image.id)) add(`${label} ID must be unique.`);
    imageIds.add(image.id);
    const normalizedImageId = normalizedId(image.id, "");
    if (normalizedImageId && normalizedImageIds.has(normalizedImageId)) {
      add("Image IDs must be unique after normalization.");
    }
    normalizedImageIds.add(normalizedImageId);
    if (!isAllowedProductImagePath(image.storagePath)) {
      add(`${label} storage path must begin with airbrush/ or photoshop/.`);
    }
    if (image.thumbnailPath && !isAllowedProductImagePath(image.thumbnailPath)) {
      add(`${label} thumbnail path must begin with airbrush/ or photoshop/.`);
    }
    if (image.thumbnailPath !== null && typeof image.thumbnailPath !== "string") {
      add(`${label} thumbnail path must be a string or null.`);
    }
    validateText(image.alt, `${label} alt text`, 300, add);
    if (!Number.isSafeInteger(Number(image.sortOrder)) || Number(image.sortOrder) < 0) {
      add(`${label} sort order must be a non-negative integer.`);
    }
  });
  if (images.length && !imageIds.has(product.primaryImageId)) {
    add("Primary image must reference one of the product images.");
  }
  if (!images.length && product.primaryImageId !== null) {
    add("Primary image must be null when there are no images.");
  }

  const original = isPlainObject(product.original) ? product.original : {};
  if (validateObjectShape(product.original, ORIGINAL_KEYS, "Original", add)) {
    if (!ORIGINAL_STATUSES.has(original.status)) add("Original status is invalid.");
    validateText(original.size, "Original size", 200, add, { nullable: true });
    validateText(original.medium, "Original medium", 300, add, { nullable: true });
    if (original.checkoutEnabled !== false) add("Original online checkout must remain disabled.");
    if (original.quantity !== deriveOriginalQuantity(original.status)) {
      add("Original quantity must match its availability status.");
    }
  }
  const originalPrice = isPlainObject(original.price) ? original.price : {};
  if (validateObjectShape(original.price, PRICE_KEYS, "Original price", add)) {
    const originalAmount = originalPrice.amountCents;
    if (originalAmount !== null && originalAmount !== "" && (!Number.isSafeInteger(Number(originalAmount)) || Number(originalAmount) <= 0)) {
      add("Original price must be a positive whole-cent amount or blank.");
    }
    if (!CURRENCY_PATTERN.test(currencyForValidation(originalPrice.currency))) {
      add("Original currency must be a lowercase three-letter code.");
    }
    if (original.status === "available") {
      if (!original.size) warnings.push("Available original has no size; contact-to-purchase can remain active, but add it when known.");
      if (!original.medium) warnings.push("Available original has no medium; contact-to-purchase can remain active, but add it when known.");
      if (!originalAmount) warnings.push("Available original has no price; contact-to-purchase can remain active without one.");
    }
  }

  const prints = isPlainObject(product.prints) ? product.prints : {};
  validateObjectShape(product.prints, PRINTS_KEYS, "Prints", add);
  if (typeof prints.available !== "boolean") add("Print availability must be true or false.");
  const options = Array.isArray(prints.options) ? prints.options : [];
  if (!Array.isArray(prints.options)) add("Print options must be a list.");
  if (options.length > MAX_PRINT_OPTIONS) add(`Products can have no more than ${MAX_PRINT_OPTIONS} print options.`);
  const optionIds = new Set();
  const normalizedOptionIds = new Set();
  options.forEach((option, index) => {
    if (!isPlainObject(option)) {
      add(`Print option ${index + 1} must be an object.`);
      return;
    }
    const label = `Print option ${index + 1}`;
    validateObjectShape(option, PRINT_OPTION_KEYS, label, add);
    validateText(option.id, `${label} ID`, 100, add, { required: true });
    if (typeof option.id === "string" && option.id.trim() && !SLUG_PATTERN.test(option.id.trim())) {
      add(`${label} ID must use lowercase letters, numbers, and hyphens.`);
    }
    if (optionIds.has(option.id)) add(`${label} ID must be unique.`);
    optionIds.add(option.id);
    const normalizedOptionId = normalizedId(option.id, "");
    if (normalizedOptionId && normalizedOptionIds.has(normalizedOptionId)) {
      add("Print option IDs must be unique after normalization.");
    }
    normalizedOptionIds.add(normalizedOptionId);
    validateText(option.label, `${label} label`, 100, add, { required: true });
    if (!Number.isSafeInteger(Number(option.amountCents)) || Number(option.amountCents) <= 0) {
      add(`${label} price must be a positive whole-cent amount.`);
    }
    if (!CURRENCY_PATTERN.test(currencyForValidation(option.currency))) add(`${label} currency must be a lowercase three-letter code.`);
    validateText(option.stripePriceId, `${label} Stripe Price ID`, 150, add, { nullable: true });
    if (option.active && !stringValue(option.stripePriceId).trim()) add(`${label} requires a Stripe Price ID while active.`);
    if (typeof option.active !== "boolean") add(`${label} active must be true or false.`);
    if (!Number.isSafeInteger(Number(option.sortOrder)) || Number(option.sortOrder) < 0) add(`${label} sort order must be a non-negative integer.`);
  });
  const activeOptions = options.filter((option) => option.active);
  if (prints.available && activeOptions.length === 0) add("Prints marked available require an active print option.");
  if (prints.available && !activeOptions.some((option) => option.id === prints.defaultOptionId)) {
    add("Default print option must reference an active print option.");
  }
  if (!prints.available && prints.defaultOptionId !== null) {
    add("Default print option must be null when " + "prints are unavailable.");
  }

  const channels = isPlainObject(product.channels) ? product.channels : {};
  if (validateObjectShape(product.channels, CHANNEL_KEYS, "Channels", add)) {
    if (typeof channels.shop !== "boolean") add("Shop channel must be true or false.");
    if (typeof channels.portfolio !== "boolean") add("Portfolio channel must be true or false.");
  }
  if (!Number.isSafeInteger(Number(product.sortOrder)) || Number(product.sortOrder) < 0) {
    add("Product sort order must be a non-negative integer.");
  }
  if (typeof product.active !== "boolean") add("Active must be true or false.");
  if (typeof product.featured !== "boolean") add("Featured must be true or false.");
  const seo = isPlainObject(product.seo) ? product.seo : {};
  if (validateObjectShape(product.seo, SEO_KEYS, "SEO", add)) {
    validateText(seo.title, "SEO title", 200, add);
    validateText(seo.description, "SEO description", 500, add);
  }
  if (product.archivedAt && product.active) add("Archived products cannot be active.");
  return { errors, warnings };
}

export function archiveProductDraft(product, archivedAt) {
  return {
    ...cloneAdminProduct(product),
    active: false,
    channels: { ...product.channels, shop: false },
    archivedAt,
  };
}

export function restoreProductDraft(product) {
  return { ...cloneAdminProduct(product), active: false, archivedAt: null };
}

export function formatProductMoney(amountCents, currency = "usd") {
  if (!Number.isSafeInteger(Number(amountCents)) || Number(amountCents) <= 0) return "Not set";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizeCurrency(currency).toUpperCase(),
  }).format(Number(amountCents) / 100);
}

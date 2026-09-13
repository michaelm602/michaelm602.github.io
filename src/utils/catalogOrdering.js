export const CATALOG_ORDERING_CHANNELS = Object.freeze(["shop", "portfolio"]);
export const MAX_CATALOG_ORDERING_IDS = 100;

function timestampMillis(value) {
  if (typeof value?.toMillis === "function") {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "string" || typeof value === "number") {
    const millis = new Date(value).getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
}

function productTimestampMillis(product) {
  return timestampMillis(product?.updatedAt) ?? timestampMillis(product?.createdAt);
}

function legacyPortfolioSortOrder(product) {
  const value = Number(product?.sortOrder);
  return Number.isSafeInteger(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
}

function legacyShopSortOrder(product) {
  const value = Number(product?.sortOrder ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function sanitizeCatalogOrdering(value) {
  const productIds = Array.isArray(value?.productIds) ? value.productIds : [];
  const seen = new Set();
  const sanitized = [];

  for (const rawId of productIds) {
    if (sanitized.length >= MAX_CATALOG_ORDERING_IDS) break;
    if (typeof rawId !== "string") continue;
    const id = rawId.trim();
    if (!id || id.length > 100 || seen.has(id)) continue;
    seen.add(id);
    sanitized.push(id);
  }

  return sanitized;
}

export function compareLegacyShopProducts(left, right) {
  const order = legacyShopSortOrder(left) - legacyShopSortOrder(right);
  if (order) return order;
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

export function compareLegacyPortfolioProducts(left, right) {
  const featuredOrder = Number(right?.featured === true) - Number(left?.featured === true);
  if (featuredOrder) return featuredOrder;

  const order = legacyPortfolioSortOrder(left) - legacyPortfolioSortOrder(right);
  if (order) return order;

  const timestampOrder = (productTimestampMillis(right) ?? Number.NEGATIVE_INFINITY)
    - (productTimestampMillis(left) ?? Number.NEGATIVE_INFINITY);
  if (timestampOrder) return timestampOrder;

  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

export function applyCatalogOrdering(products, productIds, fallbackComparator) {
  const source = Array.isArray(products) ? products : [];
  const comparator = typeof fallbackComparator === "function"
    ? fallbackComparator
    : compareLegacyShopProducts;
  const productsById = new Map();

  for (const product of source) {
    if (typeof product?.id === "string" && !productsById.has(product.id)) {
      productsById.set(product.id, product);
    }
  }

  const ordered = [];
  const placed = new Set();
  for (const id of sanitizeCatalogOrdering({ productIds })) {
    const product = productsById.get(id);
    if (!product) continue;
    ordered.push(product);
    placed.add(id);
  }

  const unlisted = source
    .filter((product) => typeof product?.id !== "string" || !placed.has(product.id))
    .sort(comparator);

  return [...ordered, ...unlisted];
}

export function moveCatalogOrderingId(productIds, productId, offset) {
  const ids = sanitizeCatalogOrdering({ productIds });
  const fromIndex = ids.indexOf(productId);
  const toIndex = fromIndex + offset;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= ids.length) return ids;

  const moved = [...ids];
  const [item] = moved.splice(fromIndex, 1);
  moved.splice(toIndex, 0, item);
  return moved;
}

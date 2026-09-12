const PUBLIC_CATALOG_CHANNELS = new Set(["shop", "portfolio"]);

export function normalizePortfolioStoragePath(path) {
  if (typeof path !== "string") return null;
  const normalized = path.trim().replace(/\\/g, "/").toLowerCase();
  if (!normalized) return null;
  return normalized.replace(/\.[^./]+$/, "").replace(/__thumb$/, "");
}

function addProductMediaPaths(target, product, firestoreShape = false) {
  for (const image of Array.isArray(product?.images) ? product.images : []) {
    const paths = firestoreShape
      ? [image?.storagePath, image?.thumbnailPath]
      : [image?.full, image?.thumb];
    for (const path of paths) {
      const basePath = normalizePortfolioStoragePath(path);
      if (basePath) target.add(basePath);
    }
  }
}

function isVisiblePortfolioProduct(product) {
  return product?.active === true
    && product?.archivedAt == null
    && product?.channels?.portfolio === true;
}

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

function productSortOrder(product) {
  const value = Number(product?.sortOrder);
  return Number.isSafeInteger(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
}

function compareManagedPortfolioProducts(left, right) {
  const featuredOrder = Number(right?.featured === true) - Number(left?.featured === true);
  if (featuredOrder) return featuredOrder;

  const sortOrder = productSortOrder(left) - productSortOrder(right);
  if (sortOrder) return sortOrder;

  const timestampOrder = (productTimestampMillis(right) ?? Number.NEGATIVE_INFINITY)
    - (productTimestampMillis(left) ?? Number.NEGATIVE_INFINITY);
  if (timestampOrder) return timestampOrder;

  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function visiblePortfolioProductsByPath(documents) {
  const productsByPath = new Map();
  for (const product of Array.isArray(documents) ? documents : []) {
    if (!isVisiblePortfolioProduct(product)) continue;
    for (const image of Array.isArray(product.images) ? product.images : []) {
      for (const path of [image?.storagePath, image?.thumbnailPath]) {
        const normalizedPath = normalizePortfolioStoragePath(path);
        if (!normalizedPath) continue;
        const existing = productsByPath.get(normalizedPath);
        if (!existing || compareManagedPortfolioProducts(product, existing) < 0) {
          productsByPath.set(normalizedPath, product);
        }
      }
    }
  }
  return productsByPath;
}

export function sortPortfolioMedia(media, { visibleProductDocuments = [] } = {}) {
  const productsByPath = visiblePortfolioProductsByPath(visibleProductDocuments);

  return (Array.isArray(media) ? media : [])
    .map((item, index) => {
      const normalizedPath = normalizePortfolioStoragePath(item?.fullPath);
      return {
        item,
        index,
        normalizedPath: normalizedPath || "",
        product: normalizedPath ? productsByPath.get(normalizedPath) || null : null,
      };
    })
    .sort((left, right) => {
      if (Boolean(left.product) !== Boolean(right.product)) return left.product ? -1 : 1;

      if (left.product && right.product) {
        const managedOrder = compareManagedPortfolioProducts(left.product, right.product);
        if (managedOrder) return managedOrder;
      } else {
        const unmanagedOrder = (timestampMillis(right.item?.timeCreated) ?? Number.NEGATIVE_INFINITY)
          - (timestampMillis(left.item?.timeCreated) ?? Number.NEGATIVE_INFINITY);
        if (unmanagedOrder) return unmanagedOrder;
      }

      const filenameOrder = left.normalizedPath.localeCompare(right.normalizedPath);
      return filenameOrder || left.index - right.index;
    })
    .map(({ item }) => item);
}

export function filterPortfolioStorageItems(
  items,
  { managedProducts = [], visibleProductDocuments = [] } = {}
) {
  const managedPaths = new Set();
  for (const product of managedProducts) addProductMediaPaths(managedPaths, product);

  const visiblePaths = new Set();
  for (const product of visibleProductDocuments) {
    if (!isVisiblePortfolioProduct(product)) continue;
    addProductMediaPaths(visiblePaths, product, true);
  }

  return (Array.isArray(items) ? items : []).filter((item) => {
    const basePath = normalizePortfolioStoragePath(item?.fullPath);
    return !basePath || !managedPaths.has(basePath) || visiblePaths.has(basePath);
  });
}

function sortByOrder(left, right) {
  return (left?.sortOrder ?? 0) - (right?.sortOrder ?? 0);
}

function formatOriginalMoney(amountCents, currency = "usd") {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return null;
  const amount = amountCents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: typeof currency === "string" ? currency.toUpperCase() : "USD",
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function findTrustedSourceOption(document, option, sourceProducts) {
  const sourceProduct = sourceProducts.find((product) => product.id === document.id);
  const sourceOption = sourceProduct?.sizes?.find((size) => size.label === option.label);
  if (!sourceOption) return null;

  const sourceAmountCents = Math.round(Number(sourceOption.price) * 100);
  const matches =
    sourceAmountCents === option.amountCents &&
    option.currency === "usd" &&
    typeof option.stripePriceId === "string" &&
    option.stripePriceId.length > 0 &&
    option.stripePriceId === sourceOption.stripePriceId;

  return matches ? sourceOption : null;
}

export function filterPublicCatalog(documents, channel = "shop") {
  if (!PUBLIC_CATALOG_CHANNELS.has(channel)) {
    throw new Error(`Unsupported public catalog channel: ${channel}`);
  }

  return (Array.isArray(documents) ? documents : [])
    .filter(
      (document) =>
        document?.active === true &&
        document?.archivedAt == null &&
        document?.channels?.[channel] === true
    )
    .sort((left, right) => sortByOrder(left, right) || left.id.localeCompare(right.id));
}

export function mapFirestoreProductForStorefront(document, { sourceProducts = [] } = {}) {
  const images = [...(Array.isArray(document?.images) ? document.images : [])]
    .sort((left, right) => {
      if (left.id === document.primaryImageId) return -1;
      if (right.id === document.primaryImageId) return 1;
      return sortByOrder(left, right);
    })
    .map((image) => ({
      id: image.id,
      full: image.storagePath,
      thumb: image.thumbnailPath || image.storagePath,
      alt: image.alt || document.title,
    }));

  const sizes = [...(Array.isArray(document?.prints?.options) ? document.prints.options : [])]
    .filter((option) => option?.active === true)
    .sort(sortByOrder)
    .map((option) => {
      const checkoutSupported = Boolean(
        findTrustedSourceOption(document, option, sourceProducts)
      );
      return {
        id: option.id,
        label: option.label,
        price: option.amountCents / 100,
        amountCents: option.amountCents,
        currency: option.currency,
        checkoutSupported,
        ...(checkoutSupported
          ? {}
          : {
              configurationIssue:
                "This print option is temporarily unavailable while its checkout configuration is reviewed.",
            }),
      };
    });

  const defaultOption = sizes.find((option) => option.id === document?.prints?.defaultOptionId);

  return {
    id: document.id,
    slug: document.slug,
    title: document.title,
    description: document.longDescription || "",
    shortDescription: document.shortDescription || "",
    category: document.category || "",
    tags: Array.isArray(document.tags) ? [...document.tags] : [],
    images,
    original: {
      status: document?.original?.status || "not_for_sale",
      size: document?.original?.size || null,
      medium: document?.original?.medium || null,
      price: {
        amountCents: document?.original?.price?.amountCents ?? null,
        currency: document?.original?.price?.currency || "usd",
      },
      checkoutEnabled: false,
      quantity: document?.original?.status === "available" ? 1 : 0,
    },
    printsAvailable: document?.prints?.available === true && sizes.length > 0,
    sizes,
    defaultSize: defaultOption?.label || sizes[0]?.label || null,
    featured: document.featured === true,
    sortOrder: document.sortOrder ?? 0,
    relatedProductIds: Array.isArray(document.relatedProductIds)
      ? [...document.relatedProductIds]
      : [],
    seo: {
      title: document?.seo?.title || "",
      description: document?.seo?.description || "",
    },
    status: "active",
    catalogSource: "firestore",
  };
}

export function mapSourceProductForStorefront(product) {
  const sizes = (Array.isArray(product?.sizes) ? product.sizes : []).map(
    (option) => ({
      label: option.label,
      price: option.price,
      checkoutSupported: true,
    })
  );

  return {
    ...product,
    images: (product?.images || []).map((image) => ({ ...image })),
    sizes,
    printsAvailable: product?.printsAvailable !== false && sizes.length > 0,
    original: {
      status: product?.original?.status || "not_for_sale",
      size: product?.original?.size || null,
      medium: product?.original?.medium || null,
      price: {
        amountCents: product?.original?.price?.amountCents ?? null,
        currency: product?.original?.price?.currency || "usd",
      },
      checkoutEnabled: false,
      quantity: product?.original?.status === "available" ? 1 : 0,
    },
    catalogSource: "source",
  };
}

export async function loadSelectedStorefrontCatalog({
  mode,
  loadFirestoreDocuments,
  loadSourceProducts,
  sourceProducts = [],
  channel = "shop",
}) {
  if (mode === "source") {
    const products = await loadSourceProducts();
    return products.map(mapSourceProductForStorefront);
  }
  if (mode !== "firestore") {
    throw new Error(`Unsupported storefront catalog mode: ${mode}`);
  }

  const documents = await loadFirestoreDocuments(channel);
  return filterPublicCatalog(documents, channel).map((document) =>
    mapFirestoreProductForStorefront(document, { sourceProducts })
  );
}

export function getOriginalPresentation(product) {
  const original = product?.original;
  if (!original || original.status === "not_for_sale") {
    return { visible: false, label: "", details: [], contactPath: null };
  }

  const details = [
    original.size || null,
    original.medium || null,
    formatOriginalMoney(original.price?.amountCents, original.price?.currency),
  ].filter(Boolean);

  if (original.status === "sold") {
    return { visible: true, label: "Original sold", details, contactPath: null };
  }

  return {
    visible: true,
    label: "Original available",
    details,
    contactPath: `/contact?intent=original&product=${encodeURIComponent(product.slug)}&productName=${encodeURIComponent(product.title)}`,
  };
}

export function getCheckoutableProductSizeOptions(product) {
  return (product?.sizes || []).filter((option) => option.checkoutSupported !== false);
}

export function isProductSizeCheckoutSupported(product, sizeLabel) {
  return Boolean(
    product?.sizes?.find(
      (option) => option.label === sizeLabel && option.checkoutSupported !== false
    )
  );
}

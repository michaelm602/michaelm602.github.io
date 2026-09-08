export const SOURCE_STOREFRONT_CATALOG_MODE = "source";
export const FIRESTORE_STOREFRONT_CATALOG_MODE = "firestore";

export function resolveStorefrontCatalogMode({ configuredMode, isProduction = false } = {}) {
  const normalized =
    configuredMode === undefined || configuredMode === null
      ? ""
      : String(configuredMode).trim().toLowerCase();

  if (!normalized) {
    return isProduction
      ? FIRESTORE_STOREFRONT_CATALOG_MODE
      : SOURCE_STOREFRONT_CATALOG_MODE;
  }

  if (![SOURCE_STOREFRONT_CATALOG_MODE, FIRESTORE_STOREFRONT_CATALOG_MODE].includes(normalized)) {
    throw new Error('VITE_STOREFRONT_CATALOG_MODE must be "source" or "firestore".');
  }

  return normalized;
}

export const STOREFRONT_CATALOG_MODE = resolveStorefrontCatalogMode({
  configuredMode: import.meta.env?.VITE_STOREFRONT_CATALOG_MODE,
  isProduction: Boolean(import.meta.env?.PROD),
});

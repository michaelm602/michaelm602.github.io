import { stripStorageFileExtension } from "./storageMedia.js";
import { createBlankAdminProduct } from "./adminProduct.js";

function safeIdStem(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "artwork";
}

function titleFromPath(path) {
  const filename = String(path || "").split("/").pop() || "";
  return stripStorageFileExtension(filename).replace(/__thumb$/i, "");
}

export function createUniqueArtworkImageId(media, images = []) {
  const isFirstImage = images.length === 0;
  const label = media?.title || titleFromPath(media?.fullPath);
  const suffix = isFirstImage ? "primary" : "image";
  const stem = safeIdStem(label)
    .slice(0, 100 - suffix.length - 1)
    .replace(/-+$/g, "") || "artwork";
  const requested = `${stem}-${suffix}`;
  const usedIds = new Set(images.map((image) => safeIdStem(image?.id)));

  if (!usedIds.has(requested)) return requested;

  let duplicate = 2;
  while (true) {
    const duplicateSuffix = `-${duplicate}`;
    const candidate = `${requested.slice(0, 100 - duplicateSuffix.length)}${duplicateSuffix}`;
    if (!usedIds.has(candidate)) return candidate;
    duplicate += 1;
  }
}

export function addArtworkMediaToProductDraft(product, media) {
  const images = Array.isArray(product?.images) ? product.images : [];
  const image = {
    id: createUniqueArtworkImageId(media, images),
    storagePath: media.fullPath,
    thumbnailPath: media.thumbnailPath || null,
    alt: String(product?.title || "").trim(),
    sortOrder: images.length,
  };

  return {
    ...product,
    images: [...images.map((existing) => ({ ...existing })), image],
    primaryImageId: images.length === 0 ? image.id : product.primaryImageId,
  };
}

export function getArtworkManagementState(media, products = []) {
  const fullPath = typeof media?.fullPath === "string" ? media.fullPath : "";
  const managedProducts = (Array.isArray(products) ? products : [])
    .filter((product) => Array.isArray(product?.images) && product.images.some(
      (image) => image?.storagePath === fullPath
    ))
    .map((product) => ({ id: product.id, title: product.title }));

  return { managed: managedProducts.length > 0, products: managedProducts };
}

// This prepares an inactive, Portfolio-only draft. It never writes Firestore
// or Storage: the owner reviews the draft in Admin Products before saving.
export function createPortfolioProductDraftFromArtworkMedia(media) {
  const draft = createBlankAdminProduct();
  return addArtworkMediaToProductDraft({
    ...draft,
    title: String(media?.title || "").trim(),
    category: "Airbrush",
    channels: { shop: false, portfolio: true },
    active: false,
  }, media);
}

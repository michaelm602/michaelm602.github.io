const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const VARIANT_PRIORITY = ["webp", "jpg", "jpeg", "png"];

export function getStorageFileExtension(name = "") {
  const match = String(name).match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

export function stripStorageFileExtension(name = "") {
  return String(name).replace(/\.[^.]+$/, "");
}

export function isStorageImage(name = "") {
  return IMAGE_EXTENSIONS.has(getStorageFileExtension(name));
}

function preferredVariant(variants) {
  for (const extension of VARIANT_PRIORITY) {
    if (variants.has(extension)) return variants.get(extension);
  }
  return null;
}

export function groupStorageImageRefs(items = []) {
  const grouped = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.name || !isStorageImage(item.name)) continue;

    const extension = getStorageFileExtension(item.name);
    const filenameBase = stripStorageFileExtension(item.name);
    const isThumbnail = /__thumb$/i.test(filenameBase);
    const title = isThumbnail ? filenameBase.replace(/__thumb$/i, "") : filenameBase;
    const key = title;

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        title,
        fullVariants: new Map(),
        thumbnailVariants: new Map(),
        variantRefs: [],
      });
    }

    const group = grouped.get(key);
    if (!isThumbnail) group.title = filenameBase;
    const variants = isThumbnail ? group.thumbnailVariants : group.fullVariants;
    variants.set(extension, item);
    group.variantRefs.push(item);
  }

  return Array.from(grouped.values())
    .map((group) => {
      const fullRef = preferredVariant(group.fullVariants);
      const thumbnailRef = preferredVariant(group.thumbnailVariants);
      if (!fullRef) return null;
      return {
        key: group.key,
        title: group.title,
        fullRef,
        thumbnailRef,
        fullPath: fullRef.fullPath,
        thumbnailPath: thumbnailRef?.fullPath || null,
        variantRefs: group.variantRefs,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title));
}

import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase";

function isStorageObjectMissing(error) {
  return error?.code === "storage/object-not-found";
}

async function getStorageUrl(path) {
  if (!path) return null;

  try {
    return await getDownloadURL(ref(storage, path));
  } catch (error) {
    if (isStorageObjectMissing(error)) {
      return null;
    }

    throw error;
  }
}

export async function resolveProductImageUrl(image, preferred = "thumb") {
  if (!image) return null;

  const primaryPath = preferred === "full" ? image.full || image.thumb : image.thumb || image.full;
  const fallbackPath = preferred === "full" ? image.thumb || null : image.full || null;

  const primaryUrl = await getStorageUrl(primaryPath);
  if (primaryUrl) {
    return primaryUrl;
  }

  if (fallbackPath && fallbackPath !== primaryPath) {
    return getStorageUrl(fallbackPath);
  }

  return null;
}

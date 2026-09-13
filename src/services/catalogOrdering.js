import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  CATALOG_ORDERING_CHANNELS,
  sanitizeCatalogOrdering,
} from "../utils/catalogOrdering";

export const CATALOG_ORDERING_COLLECTION = "catalogOrdering";

function assertChannel(channel) {
  if (!CATALOG_ORDERING_CHANNELS.includes(channel)) {
    throw new Error(`Unsupported catalog ordering channel: ${channel}`);
  }
}

export async function getCatalogOrdering(channel) {
  assertChannel(channel);
  const snapshot = await getDoc(doc(db, CATALOG_ORDERING_COLLECTION, channel));
  return snapshot.exists() ? sanitizeCatalogOrdering(snapshot.data()) : [];
}

export async function saveCatalogOrdering(channel, productIds) {
  assertChannel(channel);
  const sanitizedIds = sanitizeCatalogOrdering({ productIds });
  await setDoc(doc(db, CATALOG_ORDERING_COLLECTION, channel), {
    productIds: sanitizedIds,
  });
  return sanitizedIds;
}

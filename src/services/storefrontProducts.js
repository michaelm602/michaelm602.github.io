import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getAllProducts, products as sourceProducts } from "../data/products";
import { STOREFRONT_CATALOG_MODE } from "../config/storefrontCatalog";
import { loadSelectedStorefrontCatalog } from "../utils/storefrontProduct";
import { CATALOG_ORDERING_CHANNELS, sanitizeCatalogOrdering } from "../utils/catalogOrdering";

export const STOREFRONT_PRODUCTS_COLLECTION = "shopProducts";
export const CATALOG_ORDERING_COLLECTION = "catalogOrdering";

export async function loadPublicFirestoreDocuments(channel = "shop") {
  const snapshot = await getDocs(
    query(
      collection(db, STOREFRONT_PRODUCTS_COLLECTION),
      where("active", "==", true),
      where("archivedAt", "==", null),
      where(`channels.${channel}`, "==", true)
    )
  );

  return snapshot.docs.map((snapshotDocument) => ({
    ...snapshotDocument.data(),
    id: snapshotDocument.id,
  }));
}

export async function loadPublicCatalogOrdering(channel = "shop") {
  if (!CATALOG_ORDERING_CHANNELS.includes(channel)) {
    throw new Error(`Unsupported public catalog ordering channel: ${channel}`);
  }

  const snapshot = await getDoc(doc(db, CATALOG_ORDERING_COLLECTION, channel));
  return snapshot.exists() ? sanitizeCatalogOrdering(snapshot.data()) : [];
}

export function loadStorefrontCatalog({
  mode = STOREFRONT_CATALOG_MODE,
  channel = "shop",
} = {}) {
  return loadSelectedStorefrontCatalog({
    mode,
    channel,
    loadFirestoreDocuments: loadPublicFirestoreDocuments,
    loadCatalogOrdering: loadPublicCatalogOrdering,
    loadSourceProducts: async () => getAllProducts(),
    sourceProducts,
  });
}

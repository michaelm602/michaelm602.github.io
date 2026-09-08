import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getAllProducts, products as sourceProducts } from "../data/products";
import { STOREFRONT_CATALOG_MODE } from "../config/storefrontCatalog";
import { loadSelectedStorefrontCatalog } from "../utils/storefrontProduct";

export const STOREFRONT_PRODUCTS_COLLECTION = "shopProducts";

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

export function loadStorefrontCatalog({
  mode = STOREFRONT_CATALOG_MODE,
  channel = "shop",
} = {}) {
  return loadSelectedStorefrontCatalog({
    mode,
    channel,
    loadFirestoreDocuments: loadPublicFirestoreDocuments,
    loadSourceProducts: async () => getAllProducts(),
    sourceProducts,
  });
}

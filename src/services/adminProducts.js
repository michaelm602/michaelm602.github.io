import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  archiveProductDraft,
  normalizeAdminProductForSave,
  validateAdminProduct,
} from "../utils/adminProduct";

export const SHOP_PRODUCTS_COLLECTION = "shopProducts";

export async function listAdminProducts() {
  const snapshot = await getDocs(collection(db, SHOP_PRODUCTS_COLLECTION));
  return snapshot.docs
    .map((snapshotDocument) => ({ ...snapshotDocument.data(), id: snapshotDocument.id }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
}

export async function saveAdminProduct(product, { isNew = false } = {}) {
  const inputValidation = validateAdminProduct(product);
  if (inputValidation.errors.length) {
    const error = new Error(inputValidation.errors.join(" "));
    error.code = "invalid-product";
    error.validation = inputValidation;
    throw error;
  }

  const normalized = normalizeAdminProductForSave(product);
  const validation = validateAdminProduct(normalized);
  if (validation.errors.length) {
    const error = new Error(validation.errors.join(" "));
    error.code = "invalid-product";
    error.validation = validation;
    throw error;
  }

  const productRef = doc(db, SHOP_PRODUCTS_COLLECTION, normalized.id);
  if (isNew && (await getDoc(productRef)).exists()) {
    const error = new Error(`A product with ID "${normalized.id}" already exists.`);
    error.code = "already-exists";
    throw error;
  }

  const { createdAt: _createdAt, updatedAt: _updatedAt, ...catalogFields } = normalized;
  if (isNew) {
    await setDoc(productRef, {
      ...catalogFields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(productRef, {
      ...catalogFields,
      updatedAt: serverTimestamp(),
    });
  }
  return normalized.id;
}

export async function archiveAdminProduct(product) {
  const archived = archiveProductDraft(product, serverTimestamp());
  await updateDoc(doc(db, SHOP_PRODUCTS_COLLECTION, product.id), {
    active: archived.active,
    channels: archived.channels,
    archivedAt: archived.archivedAt,
    updatedAt: serverTimestamp(),
  });
}

export async function restoreAdminProduct(productId) {
  await updateDoc(doc(db, SHOP_PRODUCTS_COLLECTION, productId), {
    active: false,
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const firestoreRules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
const storageRules = await readFile(new URL("../storage.rules", import.meta.url), "utf8");

test("Firestore keeps orders closed and scopes admin writes to homepage content", () => {
  assert.match(firestoreRules, /match \/orders\/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
  assert.match(firestoreRules, /request\.auth\.token\.admin == true/);
  assert.match(firestoreRules, /match \/siteContent\/home[\s\S]*allow read: if true;[\s\S]*allow create, update, delete: if isAdmin\(\);/);
  assert.doesNotMatch(firestoreRules, /allow write: if true/);
});

test("shopProducts permits constrained Shop and Portfolio reads while keeping writes admin-only", () => {
  assert.match(firestoreRules, /match \/shopProducts\/\{productId\}/);
  assert.match(firestoreRules, /function isPublicStorefrontProduct\(data\)/);
  assert.match(firestoreRules, /data\.active == true/);
  assert.match(firestoreRules, /data\.archivedAt == null/);
  assert.match(firestoreRules, /data\.channels\.shop == true\s*\|\|\s*data\.channels\.portfolio == true/);
  assert.match(firestoreRules, /allow read: if isAdmin\(\) \|\| isPublicStorefrontProduct\(resource\.data\);/);
  assert.match(firestoreRules, /allow create: if isAdmin\(\)[\s\S]*isValidShopProductCreate/);
  assert.match(firestoreRules, /allow update: if isAdmin\(\)[\s\S]*isValidShopProductUpdate/);
  assert.match(firestoreRules, /allow delete: if false;/);
  assert.match(firestoreRules, /original\.checkoutEnabled == false/);
  assert.match(firestoreRules, /data\.diff\(resource\.data\)\.removedKeys\(\)\.size\(\) == 0/);
  assert.match(firestoreRules, /changed\.hasAny\(\['prints'\]\)[\s\S]*isValidPrints\(data\.prints\)/);
  assert.match(firestoreRules, /changed\.hasAny\(\['original'\]\)[\s\S]*isValidOriginal\(data\.original\)/);
  assert.match(firestoreRules, /changed\.hasAny\(\['images', 'primaryImageId', 'active', 'channels'\]\)[\s\S]*isValidUpdatedImageState\(data\)/);
  assert.match(firestoreRules, /changed\.hasAny\(\['title'\]\)[\s\S]*isValidUpdatedText\(data\.title, 200, true\)/);
  assert.match(firestoreRules, /match \/shopInventory\/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
});

test("Storage exposes only storefront paths and requires the admin claim for writes", () => {
  for (const path of ["site/home", "airbrush", "photoshop", "tattoos", "portfolio-videos"]) {
    assert.match(storageRules, new RegExp(`match /${path.replace("/", "\\/")}/`));
  }
  assert.match(storageRules, /request\.auth\.token\.admin == true/);
  assert.match(storageRules, /allow create, update, delete: if isAdmin\(\);/);
  assert.match(storageRules, /match \/\{allPaths=\*\*\}[\s\S]*allow read, write: if false;/);
  assert.doesNotMatch(storageRules, /allow write: if true/);
});

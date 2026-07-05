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

test("Storage exposes only storefront paths and requires the admin claim for writes", () => {
  for (const path of ["site/home", "airbrush", "photoshop", "tattoos", "portfolio-videos"]) {
    assert.match(storageRules, new RegExp(`match /${path.replace("/", "\\/")}/`));
  }
  assert.match(storageRules, /request\.auth\.token\.admin == true/);
  assert.match(storageRules, /allow create, update, delete: if isAdmin\(\);/);
  assert.match(storageRules, /match \/\{allPaths=\*\*\}[\s\S]*allow read, write: if false;/);
  assert.doesNotMatch(storageRules, /allow write: if true/);
});

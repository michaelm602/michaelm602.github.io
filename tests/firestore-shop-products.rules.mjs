import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";

import { deleteApp as deleteAdminApp, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { FieldValue, getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { deleteApp as deleteClientApp, initializeApp as initializeClientApp } from "firebase/app";
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore as getClientFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  createBlankAdminProduct,
  normalizeAdminProductForCreate,
  normalizeAdminProductForSave,
  validateAdminProduct,
} from "../src/utils/adminProduct.js";

const projectId = "demo-shop-product-rules";
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Run with npm run test:firestore-rules; emulator host is required.");
}
const [emulatorHost, emulatorPortText] = (
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080"
).split(":");
const emulatorPort = Number(emulatorPortText);
const importedProducts = JSON.parse(
  await readFile(new URL("../artifacts/shop-products-migration.json", import.meta.url), "utf8")
);

let adminApp;
let adminDb;
const clientApps = [];

function createClient(name, mockUserToken) {
  const app = initializeClientApp(
    { projectId, apiKey: "demo-key" },
    `${name}-${Date.now()}-${clientApps.length}`
  );
  const firestore = getClientFirestore(app);
  connectFirestoreEmulator(
    firestore,
    emulatorHost,
    emulatorPort,
    mockUserToken ? { mockUserToken } : undefined
  );
  clientApps.push(app);
  return firestore;
}

function normalizedSavePayload(snapshot) {
  const normalized = normalizeAdminProductForSave({
    ...snapshot.data(),
    id: snapshot.id,
  });
  const validation = validateAdminProduct(normalized);
  assert.deepEqual(validation.errors, [], `${snapshot.id} must normalize without client errors`);
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...catalogFields } = normalized;
  return { ...catalogFields, updatedAt: serverTimestamp() };
}

function isPermissionDenied(error) {
  assert.equal(error?.code, "permission-denied");
  return true;
}

function newProductPayload(id, optionCount = 0) {
  const draft = createBlankAdminProduct();
  Object.assign(draft, {
    id, slug: id, title: "New original", category: "Airbrush",
    active: true, channels: { shop: true, portfolio: false },
    images: [{ id: "image-1", storagePath: "airbrush/New.webp", thumbnailPath: null, alt: "New original", sortOrder: 0 }],
    primaryImageId: "image-1",
  });
  draft.original.status = "available";
  draft.original.quantity = 1;
  draft.prints = {
    available: optionCount > 0,
    defaultOptionId: optionCount ? "option-1" : null,
    options: Array.from({ length: optionCount }, (_, index) => ({
      id: `option-${index + 1}`, label: `Print ${index + 1}`, amountCents: 2500,
      currency: "usd", stripePriceId: `price_emulator${index + 1}`, active: true, sortOrder: index,
    })),
  };
  const normalized = normalizeAdminProductForCreate(draft);
  assert.deepEqual(validateAdminProduct(normalized).errors, []);
  return { ...normalized, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}


before(async () => {
  adminApp = initializeAdminApp({ projectId }, `rules-seed-${Date.now()}`);
  adminDb = getAdminFirestore(adminApp);
  const batch = adminDb.batch();
  for (const product of importedProducts) {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...catalogFields } = product;
    batch.set(adminDb.collection("shopProducts").doc(product.id), {
      ...catalogFields,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const baseHiddenProduct = importedProducts[0];
  const hiddenProducts = [
    {
      ...baseHiddenProduct,
      id: "hidden-inactive",
      slug: "hidden-inactive",
      active: false,
    },
    {
      ...baseHiddenProduct,
      id: "hidden-archived",
      slug: "hidden-archived",
      active: false,
      archivedAt: FieldValue.serverTimestamp(),
    },
    {
      ...baseHiddenProduct,
      id: "hidden-no-channel",
      slug: "hidden-no-channel",
      channels: { shop: false, portfolio: false },
    },
    {
      ...baseHiddenProduct,
      id: "hidden-portfolio-tattoo",
      slug: "hidden-portfolio-tattoo",
      category: "Tattoo",
      channels: { shop: false, portfolio: true },
    },
  ];
  for (const product of hiddenProducts) {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...catalogFields } = product;
    batch.set(adminDb.collection("shopProducts").doc(product.id), {
      ...catalogFields,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
});

after(async () => {
  await Promise.all(clientApps.map((app) => deleteClientApp(app)));
  await deleteAdminApp(adminApp);
});

test("an admin can save all 15 imported products unchanged", async () => {
  assert.equal(importedProducts.length, 15);
  const adminDbClient = createClient("admin-save", {
    sub: "admin-user",
    user_id: "admin-user",
    admin: true,
  });

  for (const product of importedProducts) {
    const productRef = doc(adminDbClient, "shopProducts", product.id);
    const snapshot = await getDoc(productRef);
    assert.equal(snapshot.exists(), true, `${product.id} must be readable by the admin`);
    await updateDoc(productRef, normalizedSavePayload(snapshot));
  }
});

test("an admin can save valid text, prints, original, and image section changes", async (context) => {
  const adminDbClient = createClient("admin-section-updates", {
    sub: "admin-user",
    user_id: "admin-user",
    admin: true,
  });
  const cases = [
    {
      product: importedProducts[1],
      changes: (data) => ({ title: `${data.title} updated` }),
    },
    {
      product: importedProducts[2],
      changes: (data) => ({
        prints: {
          ...data.prints,
          options: data.prints.options.map((option, index) =>
            index === 0 ? { ...option, label: `${option.label} print` } : option
          ),
        },
      }),
    },
    {
      product: importedProducts[3],
      changes: (data) => ({ original: { ...data.original, size: "Size on request" } }),
    },
    {
      product: importedProducts[4],
      changes: (data) => ({
        images: data.images.map((image, index) =>
          index === 0 ? { ...image, alt: `${image.alt} updated` } : image
        ),
      }),
    },
  ];

  for (const { product, changes } of cases) {
    await context.test(product.id, async () => {
      const productRef = doc(adminDbClient, "shopProducts", product.id);
      const snapshot = await getDoc(productRef);
      await updateDoc(productRef, { ...changes(snapshot.data()), updatedAt: serverTimestamp() });
    });
  }
});

test("a public client can read active, unarchived shop products with the required query", async () => {
  const publicDb = createClient("public");
  const productRef = doc(publicDb, "shopProducts", importedProducts[0].id);

  const snapshot = await getDoc(productRef);
  assert.equal(snapshot.exists(), true);

  const publicShopQuery = query(
    collection(publicDb, "shopProducts"),
    where("active", "==", true),
    where("archivedAt", "==", null),
    where("channels.shop", "==", true)
  );
  const catalog = await getDocs(publicShopQuery);
  assert.equal(catalog.size, 15);

});

test("public reads deny hidden products and queries missing required visibility constraints", async () => {
  const publicDb = createClient("public-hidden");

  for (const productId of [
    "hidden-inactive",
    "hidden-archived",
    "hidden-no-channel",
    "hidden-portfolio-tattoo",
  ]) {
    await assert.rejects(
      () => getDoc(doc(publicDb, "shopProducts", productId)),
      isPermissionDenied
    );
  }

  const catalog = collection(publicDb, "shopProducts");
  const insufficientQueries = [
    query(catalog),
    query(catalog, where("active", "==", true), where("archivedAt", "==", null)),
    query(catalog, where("active", "==", true), where("channels.shop", "==", true)),
    query(catalog, where("archivedAt", "==", null), where("channels.shop", "==", true)),
    query(catalog, where("active", "==", false), where("archivedAt", "==", null), where("channels.shop", "==", true)),
    query(catalog, where("active", "==", true), where("archivedAt", "==", null), where("channels.shop", "==", false)),
    query(catalog, where("active", "==", true), where("archivedAt", "==", null), where("channels.portfolio", "==", true)),
  ];
  for (const insufficientQuery of insufficientQueries) {
    await assert.rejects(() => getDocs(insufficientQuery), isPermissionDenied);
  }
});

test("public clients cannot create, update, or delete shop products", async () => {
  const publicDb = createClient("public-writes");
  const productRef = doc(publicDb, "shopProducts", importedProducts[0].id);

  await assert.rejects(
    () => updateDoc(productRef, { title: "Blocked public edit", updatedAt: serverTimestamp() }),
    isPermissionDenied
  );
  await assert.rejects(() => deleteDoc(productRef), isPermissionDenied);
  await assert.rejects(
    () => setDoc(doc(publicDb, "shopProducts", "public-create"), {
      ...importedProducts[0],
      id: "public-create",
      slug: "public-create",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    isPermissionDenied
  );
});

test("an admin can read products hidden from public catalog channels", async () => {
  const adminDbClient = createClient("admin-hidden-read", {
    sub: "admin-user",
    user_id: "admin-user",
    admin: true,
  });
  const snapshot = await getDoc(doc(adminDbClient, "shopProducts", "hidden-no-channel"));
  assert.equal(snapshot.exists(), true);
});

test("an authenticated non-admin cannot write shop products", async () => {
  const nonAdminDb = createClient("non-admin", {
    sub: "customer-user",
    user_id: "customer-user",
    admin: false,
  });
  const productRef = doc(nonAdminDb, "shopProducts", importedProducts[0].id);

  await assert.rejects(
    () => updateDoc(productRef, { title: "Blocked non-admin edit", updatedAt: serverTimestamp() }),
    isPermissionDenied
  );
});

test("an admin cannot enable original checkout", async () => {
  const adminDbClient = createClient("admin-original-denial", {
    sub: "admin-user",
    user_id: "admin-user",
    admin: true,
  });
  const productRef = doc(adminDbClient, "shopProducts", importedProducts[0].id);
  const snapshot = await getDoc(productRef);

  await assert.rejects(
    () => updateDoc(productRef, {
      original: { ...snapshot.data().original, checkoutEnabled: true },
      updatedAt: serverTimestamp(),
    }),
    isPermissionDenied
  );
});

test("changed sections reject invalid nested and text data", async () => {
  const adminDbClient = createClient("admin-invalid-sections", {
    sub: "admin-user",
    user_id: "admin-user",
    admin: true,
  });

  const oversizedTitleRef = doc(adminDbClient, "shopProducts", importedProducts[5].id);
  await assert.rejects(
    () => updateDoc(oversizedTitleRef, {
      title: "x".repeat(201),
      updatedAt: serverTimestamp(),
    }),
    isPermissionDenied
  );

  const invalidPrintsRef = doc(adminDbClient, "shopProducts", importedProducts[6].id);
  const invalidPrintsSnapshot = await getDoc(invalidPrintsRef);
  const invalidPrints = {
    ...invalidPrintsSnapshot.data().prints,
    options: invalidPrintsSnapshot.data().prints.options.map((option, index) =>
      index === 0 ? { ...option, stripePriceId: null } : option
    ),
  };
  await assert.rejects(
    () => updateDoc(invalidPrintsRef, { prints: invalidPrints, updatedAt: serverTimestamp() }),
    isPermissionDenied
  );

  const invalidImagesRef = doc(adminDbClient, "shopProducts", importedProducts[7].id);
  const invalidImagesSnapshot = await getDoc(invalidImagesRef);
  const invalidImages = invalidImagesSnapshot.data().images.map((image, index) =>
    index === 0 ? { ...image, storagePath: "private/not-allowed.webp" } : image
  );
  await assert.rejects(
    () => updateDoc(invalidImagesRef, { images: invalidImages, updatedAt: serverTimestamp() }),
    isPermissionDenied
  );
});

test("an admin cannot delete a shop product", async () => {
  const adminDbClient = createClient("admin-delete-denial", {
    sub: "admin-user",
    user_id: "admin-user",
    admin: true,
  });
  const productRef = doc(adminDbClient, "shopProducts", importedProducts[0].id);

  await assert.rejects(() => deleteDoc(productRef), isPermissionDenied);
});

test("admin creates original-only contact products and valid print products", async (context) => {
  const client = createClient("admin-create", { sub: "admin-user", admin: true });
  for (const count of [0, 1, 4, 8]) {
    await context.test(`${count} print options`, async () => {
      const payload = newProductPayload(`new-product-${count}`, count);
      context.diagnostic(`Normalized create payload: ${JSON.stringify(payload)}`);
      const ref = doc(client, "shopProducts", payload.id);
      assert.equal((await getDoc(ref)).exists(), false);
      await setDoc(ref, payload);
      const saved = (await getDoc(ref)).data();
      assert.equal(saved.original.status, "available");
      assert.equal(saved.original.checkoutEnabled, false);
      assert.equal(saved.prints.options.length, count);
      assert.ok(saved.createdAt.toMillis() > 0);
      assert.equal(saved.createdAt.toMillis(), saved.updatedAt.toMillis());
    });
  }
});

test("admin creates valid products with default and custom metadata at print boundaries", async (context) => {
  const client = createClient("admin-create-boundaries", { sub: "admin-user", admin: true });
  const cases = [
    ["eight-options-default-original", 8, (payload) => {
      payload.original.status = "not_for_sale";
      payload.original.quantity = 0;
    }],
    ["eight-options-last-default", 8, (payload) => {
      payload.prints.defaultOptionId = "option-8";
      payload.prints.options = normalizeAdminProductForCreate(payload).prints.options;
    }],
    ["four-options-custom-metadata", 4, (payload) => {
      payload.original.size = "24 x 36 inches";
      payload.original.medium = "Airbrush on canvas";
      payload.original.price.amountCents = 125000;
      payload.tags = ["portrait", "airbrush"];
      payload.relatedProductIds = ["related-piece"];
      payload.seo = { title: "New original artwork", description: "An original airbrush artwork." };
    }],
  ];
  for (const [name, count, customize] of cases) {
    await context.test(name, async () => {
      const payload = newProductPayload(name, count);
      customize(payload);
      await setDoc(doc(client, "shopProducts", name), payload);
      assert.equal((await getDoc(doc(client, "shopProducts", name))).exists(), true);
    });
  }
});

test("public and non-admin clients cannot create a valid original-only product", async () => {
  for (const [name, token] of [["public-create-valid", null], ["non-admin-create", { sub: "customer", admin: false }]]) {
    const client = createClient(name, token);
    await assert.rejects(() => setDoc(doc(client, "shopProducts", name), newProductPayload(name)), isPermissionDenied);
  }
});

test("admin create rejects unsafe or malformed product fields", async (context) => {
  const client = createClient("admin-invalid-create", { sub: "admin-user", admin: true });
  const cases = [
    ["original-checkout", (p) => { p.original.checkoutEnabled = true; }],
    ["missing-stripe", (p) => { p.prints.options[0].stripePriceId = null; }],
    ["blank-stripe", (p) => { p.prints.options[0].stripePriceId = ""; }],
    ["zero-price", (p) => { p.prints.options[0].amountCents = 0; }],
    ["fractional-price", (p) => { p.prints.options[0].amountCents = 1.5; }],
    ["missing-label", (p) => { p.prints.options[0].label = ""; }],
    ["non-string-label", (p) => { p.prints.options[0].label = 123; }],
    ["non-string-stripe", (p) => { p.prints.options[0].stripePriceId = 123; }],
    ["non-boolean-active", (p) => { p.prints.options[0].active = 1; }],
    ["non-boolean-available", (p) => { p.prints.available = 1; }],
    ["invalid-currency", (p) => { p.prints.options[0].currency = "US"; }],
    ["inactive-default", (p) => { p.prints.options[0].active = false; }],
    ["missing-default", (p) => { p.prints.defaultOptionId = "missing"; }],
    ["no-active-options", (p) => { p.prints.options = []; }],
    ["missing-primary", (p) => { p.primaryImageId = "missing"; }],
    ["missing-images", (p) => { p.images = []; p.primaryImageId = null; }],
    ["bad-path", (p) => { p.images[0].storagePath = "private/image.webp"; }],
    ["bad-slug", (p) => { p.slug = "Bad Slug"; }],
    ["oversized-title", (p) => { p.title = "x".repeat(201); }],
    ["non-string-title", (p) => { p.title = ["Title"]; }],
    ["oversized-tag", (p) => { p.tags = ["x".repeat(101)]; }],
    ["non-string-tag", (p) => { p.tags = [123]; }],
    ["too-many-tags", (p) => { p.tags = Array(13).fill("tag"); }],
    ["mismatched-id", (p) => { p.id = "another-id"; }],
    ["extra-field", (p) => { p.unexpected = true; }],
    ["extra-print-field", (p) => { p.prints.options[0].unexpected = true; }],
    ["missing-title", (p) => { delete p.title; }],
    ["missing-archive", (p) => { delete p.archivedAt; }],
    ["missing-print-active", (p) => { delete p.prints.options[0].active; }],
    ["missing-created-at", (p) => { delete p.createdAt; }],
    ["null-updated-at", (p) => { p.updatedAt = null; }],
    ["client-timestamps", (p) => { p.createdAt = new Date(0); p.updatedAt = new Date(0); }],
  ];
  for (const [name, mutate] of cases) {
    await context.test(name, async () => {
      const id = `invalid-create-${name}`;
      const payload = newProductPayload(id, 1);
      mutate(payload);
      await assert.rejects(() => setDoc(doc(client, "shopProducts", id), payload), isPermissionDenied);
      assert.equal((await getDoc(doc(client, "shopProducts", id))).exists(), false);
    });
  }
});

test("orders and shopInventory stay closed for every browser role", async () => {
  for (const [name, token] of [["public-closed", null], ["customer-closed", { sub: "customer", admin: false }], ["admin-closed", { sub: "admin", admin: true }]]) {
    const client = createClient(name, token);
    for (const path of ["orders", "shopInventory"]) {
      const ref = doc(client, path, "closed-document");
      await assert.rejects(() => getDoc(ref), isPermissionDenied);
      await assert.rejects(() => setDoc(ref, { status: "available" }), isPermissionDenied);
      await assert.rejects(() => updateDoc(ref, { status: "sold" }), isPermissionDenied);
      await assert.rejects(() => deleteDoc(ref), isPermissionDenied);
    }
  }
});

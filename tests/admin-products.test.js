import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ORIGINAL_CHECKOUT_WARNING,
  archiveProductDraft,
  createUniquePrintOptionId,
  createBlankAdminProduct,
  deriveOriginalQuantity,
  formatProductMoney,
  normalizeCurrency,
  normalizeAdminProductForSave,
  restoreProductDraft,
  validateAdminProduct,
} from "../src/utils/adminProduct.js";

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../src/Components/AdminRoute.jsx", import.meta.url), "utf8");
const adminProducts = await readFile(new URL("../src/pages/AdminProducts.jsx", import.meta.url), "utf8");
const productStoragePreview = await readFile(new URL("../src/Components/ProductStoragePreview.jsx", import.meta.url), "utf8");
const adminData = await readFile(new URL("../src/services/adminProducts.js", import.meta.url), "utf8");
const storefront = await readFile(new URL("../src/Components/ShopGallery.jsx", import.meta.url), "utf8");
const checkout = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");

function validProduct() {
  const product = createBlankAdminProduct();
  product.id = "new-piece";
  product.slug = "new-piece";
  product.title = "New Piece";
  product.category = "Airbrush | Print";
  product.images = [
    {
      id: "image-1",
      storagePath: "airbrush/New Piece.webp",
      thumbnailPath: "airbrush/New Piece__thumb.webp",
      alt: "New Piece",
      sortOrder: 0,
    },
  ];
  product.primaryImageId = "image-1";
  return product;
}

test("admin products route is protected by the existing custom-claim route", () => {
  assert.match(app, /path="\/admin\/products"/);
  assert.match(app, /<AdminRoute>[\s\S]*<AdminProducts \/>[\s\S]*<\/AdminRoute>/);
  assert.match(adminRoute, /if \(!isAdmin\) return <Navigate to="\/" replace \/>/);
  assert.doesNotMatch(adminProducts, /ADMIN_EMAIL|ADMIN_UID|airbrushnink@gmail\.com/);
});

test("admin product UI copy uses encoding-safe ASCII punctuation", () => {
  const adminProductUi = `${adminProducts}\n${productStoragePreview}`;

  assert.doesNotMatch(adminProductUi, /[\u00e2\u00c2\u2026\u00b7]/);
  assert.match(adminProducts, /Loading product catalog\.\.\./);
  assert.match(adminProducts, /Search title, slug, category\.\.\./);
  assert.match(adminProducts, /Saving\.\.\./);
  assert.match(adminProducts, / \| /);
  assert.match(productStoragePreview, /Loading preview\.\.\./);
});

test("admin product toggles remain semantic and expose clear mobile states", () => {
  assert.match(adminProducts, /type="checkbox"/);
  assert.match(adminProducts, /className="peer sr-only"/);
  assert.match(adminProducts, /min-h-12/);
  assert.match(adminProducts, /h-6 w-6/);
  assert.match(adminProducts, /peer-focus-visible:ring/);
  assert.match(adminProducts, /checkedText = "On"/);
  assert.match(adminProducts, /uncheckedText = "Off"/);
  assert.match(adminProducts, /checkedText="Active" uncheckedText="Inactive"/);
  assert.match(adminProducts, /<StatusPill tone=\{option\.active \? "active" : "warning"\}>/);
});

test("original state derives one-of-one quantity and stays contact-only", () => {
  assert.equal(deriveOriginalQuantity("available"), 1);
  assert.equal(deriveOriginalQuantity("sold"), 0);
  assert.equal(deriveOriginalQuantity("not_for_sale"), 0);

  const available = validProduct();
  available.original.status = "available";
  available.original.quantity = 0;
  const normalized = normalizeAdminProductForSave(available);
  assert.equal(normalized.original.quantity, 1);
  assert.equal(normalized.original.checkoutEnabled, false);
  assert.match(ORIGINAL_CHECKOUT_WARNING, /contact-to-purchase/);
});

test("admin validation rejects original checkout and invalid active print products", () => {
  const checkoutEnabled = validProduct();
  checkoutEnabled.original.checkoutEnabled = true;
  assert.match(validateAdminProduct(checkoutEnabled).errors.join(" "), /online checkout.*disabled/i);

  const invalidPrints = validProduct();
  invalidPrints.prints.available = true;
  invalidPrints.prints.options = [
    {
      id: "16x20",
      label: "16x20",
      amountCents: 10000,
      currency: "usd",
      stripePriceId: "",
      active: true,
      sortOrder: 0,
    },
  ];
  invalidPrints.prints.defaultOptionId = "16x20";
  assert.match(validateAdminProduct(invalidPrints).errors.join(" "), /Stripe Price ID/);

  const inactiveDefault = validProduct();
  inactiveDefault.prints.available = true;
  inactiveDefault.prints.options = [
    {
      id: "small",
      label: "Small print",
      amountCents: 2500,
      currency: "usd",
      stripePriceId: null,
      active: false,
      sortOrder: 0,
    },
  ];
  inactiveDefault.prints.defaultOptionId = "small";
  assert.match(
    validateAdminProduct(inactiveDefault).errors.join(" "),
    /default print option "Small print" is inactive/i
  );
});

test("currency editing is null-safe and save normalization always produces a valid code", () => {
  assert.equal(normalizeCurrency(null), "usd");
  assert.equal(normalizeCurrency(undefined), "usd");
  assert.equal(normalizeCurrency({}), "usd");
  assert.equal(normalizeCurrency(" CAD "), "cad");
  assert.equal(normalizeCurrency("u"), "usd");
  assert.doesNotThrow(() => formatProductMoney(1250, null));
  assert.equal(formatProductMoney(1250, "u"), "$12.50");

  const product = validProduct();
  product.original.price.currency = null;
  product.prints.options = [
    {
      id: "small",
      label: "Small",
      amountCents: 2500,
      currency: undefined,
      stripePriceId: "price_small",
      active: true,
      sortOrder: 0,
    },
  ];
  product.prints.available = true;
  product.prints.defaultOptionId = "small";

  assert.doesNotThrow(() => validateAdminProduct(product));
  const normalized = normalizeAdminProductForSave(product);
  assert.equal(normalized.original.price.currency, "usd");
  assert.equal(normalized.prints.options[0].currency, "usd");
});

test("print option IDs remain unique when added, renamed, and normalized", () => {
  const existing = [{ id: "option-1" }, { id: "large-print" }];
  assert.equal(createUniquePrintOptionId("option-1", existing), "option-1-2");
  assert.equal(createUniquePrintOptionId("Large Print", existing), "large-print-2");
  assert.match(adminProducts, /createUniquePrintOptionId\(value, current\.prints\.options, index\)/);
  assert.match(adminProducts, /createUniquePrintOptionId\("", draft\.prints\.options\)/);

  const product = validProduct();
  product.prints.available = true;
  product.prints.defaultOptionId = "large print";
  product.prints.options = [
    { id: "large print", label: "Large", amountCents: 5000, currency: "usd", stripePriceId: "price_large", active: true, sortOrder: 0 },
    { id: "large-print", label: "Large alternate", amountCents: 5500, currency: "usd", stripePriceId: "price_large_alt", active: true, sortOrder: 1 },
  ];

  assert.match(validateAdminProduct(product).errors.join(" "), /unique.*normalization|normalize.*same/i);
});

test("client text and allowlist validation matches Firestore rule boundaries", () => {
  const product = validProduct();
  product.title = "x".repeat(201);
  product.shortDescription = "x".repeat(501);
  product.longDescription = "x".repeat(5001);
  product.category = "x".repeat(101);
  product.tags = ["x".repeat(101)];
  product.images[0].alt = "x".repeat(301);
  product.images[0].id = "x".repeat(101);
  product.primaryImageId = product.images[0].id;
  product.original.size = "x".repeat(201);
  product.original.medium = "x".repeat(301);
  product.relatedProductIds = ["x".repeat(101)];
  product.prints.options = [{
    id: "x".repeat(101),
    label: "x".repeat(101),
    amountCents: 2500,
    currency: "usd",
    stripePriceId: "x".repeat(151),
    active: true,
    sortOrder: 0,
  }];
  product.prints.available = true;
  product.prints.defaultOptionId = product.prints.options[0].id;
  product.seo.title = "x".repeat(201);
  product.seo.description = "x".repeat(501);
  product.unexpected = true;
  product.original.unexpected = true;

  const errors = validateAdminProduct(product).errors.join(" ");
  for (const field of ["Title", "Short description", "Long description", "Category", "Tag 1", "Image 1 ID", "Image 1 alt text", "Original size", "Original medium", "Related product 1", "Print option 1 ID", "Print option 1 label", "Print option 1 Stripe Price ID", "SEO title", "SEO description"]) {
    assert.match(errors, new RegExp(field, "i"));
  }
  assert.match(errors, /unsupported field/i);
  const normalized = normalizeAdminProductForSave(product);
  assert.equal(Object.hasOwn(normalized, "unexpected"), false);
  assert.equal(Object.hasOwn(normalized.original, "unexpected"), false);
});

test("save service validates normalized data and separates create from update writes", () => {
  assert.match(adminData, /normalizeAdminProductForSave\(product\)[\s\S]*validateAdminProduct\(normalized\)/);
  assert.ok(adminData.indexOf("validateAdminProduct(normalized)") < adminData.indexOf("setDoc("));
  assert.match(adminData, /if \(isNew\)[\s\S]*setDoc\([\s\S]*else[\s\S]*updateDoc\(/);
});

test("active shop products require a valid existing-media path", () => {
  const product = validProduct();
  product.active = true;
  product.channels.shop = true;
  assert.equal(validateAdminProduct(product).errors.length, 0);

  product.images[0].storagePath = "https://example.com/image.webp";
  assert.match(validateAdminProduct(product).errors.join(" "), /airbrush\/ or photoshop\//);
});

test("archive behavior disables active publishing without deleting the product", () => {
  const product = validProduct();
  product.active = true;
  product.channels.shop = true;
  const archivedAt = new Date("2026-09-08T00:00:00.000Z");
  const archived = archiveProductDraft(product, archivedAt);

  assert.equal(archived.active, false);
  assert.equal(archived.channels.shop, false);
  assert.equal(archived.archivedAt, archivedAt);

  const restored = restoreProductDraft(archived);
  assert.equal(restored.archivedAt, null);
  assert.equal(restored.active, false);
});

test("product manager uses explicit Firestore create and update operations without deletes", () => {
  assert.match(adminData, /collection\(db, SHOP_PRODUCTS_COLLECTION\)/);
  assert.match(adminData, /setDoc\(/);
  assert.match(adminData, /updateDoc\(/);
  assert.doesNotMatch(adminData, /deleteDoc|deleteField/);
});

test("storefront uses the selected display adapter while checkout retains its source catalog", () => {
  assert.match(storefront, /useStorefrontCatalog\("shop"\)/);
  assert.doesNotMatch(storefront, /getAllProducts|getDocs|onSnapshot/);
  assert.match(checkout, /require\("\.\/stripeCatalog"\)/);
  assert.doesNotMatch(checkout, /require\("\.\/shopProductRepository"\)/);
});

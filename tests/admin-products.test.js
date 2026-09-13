import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ORIGINAL_CHECKOUT_WARNING,
  addStandardPrintSet,
  archiveProductDraft,
  createUniquePrintOptionId,
  createBlankAdminProduct,
  deriveOriginalQuantity,
  formatProductMoney,
  formatAdminProductSaveError,
  hasMissingStandardPrintOptions,
  normalizeCurrency,
  normalizeAdminProductForCreate,
  normalizeAdminProductForSave,
  restoreProductDraft,
  validateAdminProduct,
} from "../src/utils/adminProduct.js";
import { createAdminStripePriceSyncClient } from "../src/utils/adminStripePriceSync.js";

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../src/Components/AdminRoute.jsx", import.meta.url), "utf8");
const adminProducts = await readFile(new URL("../src/pages/AdminProducts.jsx", import.meta.url), "utf8");
const productStoragePreview = await readFile(new URL("../src/Components/ProductStoragePreview.jsx", import.meta.url), "utf8");
const adminData = await readFile(new URL("../src/services/adminProducts.js", import.meta.url), "utf8");
const catalogOrderingPanel = await readFile(new URL("../src/Components/CatalogOrderingPanel.jsx", import.meta.url), "utf8");
const catalogOrderingService = await readFile(new URL("../src/services/catalogOrdering.js", import.meta.url), "utf8");
const adminStripeSyncService = await readFile(new URL("../src/services/adminStripePriceSync.js", import.meta.url), "utf8");
const adminStripeSyncClient = await readFile(new URL("../src/utils/adminStripePriceSync.js", import.meta.url), "utf8");
const adminStripeSyncDocs = await readFile(new URL("../docs/admin-stripe-price-sync.md", import.meta.url), "utf8");
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

test("admin product UI distinguishes product placement from image ordering", () => {
  assert.match(
    adminProducts,
    /<Field label="Legacy fallback order" hint="Used when a Shop or Portfolio ordering document does not list this product\.">/
  );
  assert.match(
    adminProducts,
    /<Field label="Image order" hint="Only affects the order of multiple images inside this product\. It does not control Shop or Portfolio placement\.">/
  );
});

test("admin has independent Shop and Portfolio ordering controls", () => {
  assert.match(adminProducts, /<CatalogOrderingPanel products=\{products\} \/>/);
  assert.match(catalogOrderingPanel, /Shop order/);
  assert.match(catalogOrderingPanel, /Portfolio order/);
  assert.match(catalogOrderingPanel, /Featured does not override this order\./);
  assert.match(catalogOrderingPanel, /moveCatalogOrderingId/);
  assert.match(catalogOrderingService, /CATALOG_ORDERING_COLLECTION/);
  assert.match(catalogOrderingService, /setDoc\(/);
  assert.doesNotMatch(catalogOrderingService, /shopProducts|updateDoc|deleteDoc/);
});

test("admin save normalization preserves product and image sort-order values", () => {
  const product = validProduct();
  product.sortOrder = 17;
  product.images[0].sortOrder = 4;

  const normalized = normalizeAdminProductForSave(product);

  assert.equal(normalized.sortOrder, 17);
  assert.equal(normalized.images[0].sortOrder, 4);
});

test("admin product previews keep the complete artwork visible and centered", () => {
  assert.match(productStoragePreview, /className="h-full w-full object-contain object-center"/);
  assert.doesNotMatch(productStoragePreview, /object-cover/);
  assert.match(adminProducts, /h-56 max-h-56[^"]*sm:h-64 sm:max-h-64[^"]*xl:h-32 xl:max-h-32/);
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
  assert.match(validateAdminProduct(invalidPrints).errors.join(" "), /deactivate.*option/i);

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

test("original-only new drafts validate without prices or print checkout", () => {
  const product = validProduct();
  product.original.status = "available";
  product.original.quantity = 1;
  product.active = true;
  product.channels.shop = true;
  assert.deepEqual(validateAdminProduct(product).errors, []);
  assert.deepEqual(normalizeAdminProductForSave(product).prints, {
    available: false, defaultOptionId: null, options: [],
  });
});

test("standard print helper adds a safe inactive set to a new product", () => {
  const product = addStandardPrintSet(validProduct());

  assert.equal(product.prints.available, false);
  assert.equal(product.prints.defaultOptionId, null);
  assert.deepEqual(product.prints.options, [
    { id: "16x20", label: "16x20", amountCents: 10000, currency: "usd", stripePriceId: null, active: false, sortOrder: 0 },
    { id: "18x24", label: "18x24", amountCents: 20000, currency: "usd", stripePriceId: null, active: false, sortOrder: 1 },
    { id: "24x36", label: "24x36", amountCents: 30000, currency: "usd", stripePriceId: null, active: false, sortOrder: 2 },
    { id: "30x40", label: "30x40", amountCents: 40000, currency: "usd", stripePriceId: null, active: false, sortOrder: 3 },
  ]);
  assert.equal(hasMissingStandardPrintOptions(product), false);
});

test("standard print helper preserves matching options and never duplicates their IDs", () => {
  const product = validProduct();
  const existing = {
    id: "16x20",
    label: "Custom 16 x 20",
    amountCents: 12500,
    currency: "usd",
    stripePriceId: "price_existing_16x20",
    active: true,
    sortOrder: 7,
  };
  product.prints = {
    available: true,
    defaultOptionId: "custom",
    options: [
      existing,
      { id: "custom", label: "Custom", amountCents: 5000, currency: "usd", stripePriceId: "price_custom", active: true, sortOrder: 2 },
    ],
  };

  const merged = addStandardPrintSet(product);
  const mergedAgain = addStandardPrintSet(merged);

  assert.deepEqual(merged.prints.options[0], existing);
  assert.deepEqual(merged.prints.options.map((option) => option.id), ["16x20", "custom", "18x24", "24x36", "30x40"]);
  assert.equal(merged.prints.options.filter((option) => option.id === "16x20").length, 1);
  assert.equal(merged.prints.defaultOptionId, "16x20");
  assert.deepEqual(mergedAgain, merged);
});

test("standard print helper does not make invalid print data checkout-ready", () => {
  const product = validProduct();
  product.prints = {
    available: true,
    defaultOptionId: "16x20",
    options: [
      { id: "16x20", label: "16x20", amountCents: 10000, currency: "usd", stripePriceId: null, active: true, sortOrder: 0 },
    ],
  };

  const merged = addStandardPrintSet(product);

  assert.equal(merged.prints.options[0].active, true);
  assert.equal(merged.prints.options[0].stripePriceId, null);
  assert.equal(merged.prints.available, false);
  assert.equal(merged.prints.defaultOptionId, null);
  assert.match(validateAdminProduct({ ...merged, prints: { ...merged.prints, available: true } }).errors.join(" "), /Stripe Price ID/i);
});

test("standard print helper remains available until every standard ID exists", () => {
  const product = validProduct();
  product.prints.options = [
    { id: "16x20" },
    { id: "18x24" },
    { id: "24x36" },
  ];

  assert.equal(hasMissingStandardPrintOptions(product), true);
  assert.equal(hasMissingStandardPrintOptions(addStandardPrintSet(product)), false);
});

test("admin Stripe sync client sends only server-safe identifiers", async () => {
  const requests = [];
  const client = createAdminStripePriceSyncClient(async (request) => {
    requests.push(request);
    return { operationId: "operation-1", status: "previewed" };
  });

  await client.preview("new-piece");
  await client.confirm("new-piece", "operation-1", { mode: "new" });
  await client.create("new-piece", "operation-1");

  assert.deepEqual(requests, [
    { action: "preview", productId: "new-piece" },
    {
      action: "confirm",
      productId: "new-piece",
      operationId: "operation-1",
      canonicalProductChoice: { mode: "new" },
    },
    { action: "create", productId: "new-piece", operationId: "operation-1" },
  ]);
});

test("admin Stripe sync frontend contains no Stripe secret or secret-key access", () => {
  const frontendSyncSource = `${adminStripeSyncService}\n${adminStripeSyncClient}\n${adminProducts}`;
  assert.doesNotMatch(frontendSyncSource, /STRIPE_SECRET_KEY|sk_(?:live|test)_|defineSecret|process\.env/);
  assert.match(adminStripeSyncService, /httpsCallable\(cloudFunctions, "adminStripePrintPriceSync"\)/);
});

test("admin Stripe sync explains multi-Product conflicts without offering an unsafe reset", () => {
  assert.match(
    adminProducts,
    /Use one Stripe Product per artwork, with one Price per print size\. These saved Price IDs belong to different Stripe Products\./
  );
  assert.match(adminProducts, /stripeProductName/);
  assert.match(adminProducts, /stripeProductId/);
  assert.match(adminProducts, /Keep Prints available off until the Stripe Product conflict is resolved\./);
  assert.doesNotMatch(adminProducts, /Reset Stripe (?:Product|Price|sync)/i);
  assert.match(adminStripeSyncDocs, /Manual cleanup for multiple Stripe Products/);
  assert.match(adminStripeSyncDocs, /Keep Prints available off/);
  assert.match(adminStripeSyncDocs, /Do not delete or automatically deactivate/);
});

test("starting Stripe creation clears the previous preview success message", () => {
  const createHandler = adminProducts.match(/const createStripePrices = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] || "";
  assert.match(createHandler, /setMessage\(""\)/);
});

test("admin Stripe sync requires confirmation and recommends a new canonical artwork Product", () => {
  assert.match(adminProducts, /Create a new canonical Stripe Product named after this artwork/);
  assert.match(adminProducts, /recommendNewCanonicalProduct \? " \(recommended\)"/);
  assert.match(adminProducts, /Confirm canonical Product/);
  assert.match(adminProducts, /stripeSync\?\.status === "confirmed"/);
  assert.match(adminProducts, /confirmAdminStripePriceSync/);
});

test("post-sync UI explains that trusted checkout authorization is still required", () => {
  assert.match(
    adminProducts,
    /Stripe prices are synced, but print checkout still requires the trusted server checkout catalog to support this product\./
  );
  assert.match(adminStripeSyncDocs, /functions\/stripeCatalog\.js remains authoritative/);
});

test("post-sync UI displays non-blocking canonical Product image warnings", () => {
  assert.match(adminProducts, /stripeSyncWarnings/);
  assert.match(adminProducts, /stripeSync\?\.warnings/);
  assert.match(adminProducts, /role="alert"/);
});

test("available prints require complete active options and an active default before saving", () => {
  const product = validProduct();
  product.prints = {
    available: true, defaultOptionId: "small",
    options: [{ id: "small", label: "Small", amountCents: 2500, currency: "usd", stripePriceId: "price_small", active: true, sortOrder: 0 }],
  };
  assert.deepEqual(validateAdminProduct(product).errors, []);
  for (const [field, value, expected] of [
    ["stripePriceId", null, /Stripe Price ID.*deactivate/i],
    ["stripePriceId", "   ", /Stripe Price ID.*deactivate/i],
    ["amountCents", 0, /positive whole-cent/],
    ["amountCents", 12.5, /positive whole-cent/],
    ["label", "", /label.*required/],
    ["currency", "dollars", /currency/],
    ["active", false, /inactive/],
  ]) {
    const invalid = structuredClone(product);
    invalid.prints.options[0][field] = value;
    assert.match(validateAdminProduct(invalid).errors.join(" "), expected);
  }
  product.prints.defaultOptionId = "missing";
  assert.match(validateAdminProduct(product).errors.join(" "), /Default print option must reference/);
});

test("create normalization places the active default first and preserves sort-order values", () => {
  const product = validProduct();
  product.prints = {
    available: true,
    defaultOptionId: "large",
    options: [
      { id: "small", label: "Small", amountCents: 2500, currency: "usd", stripePriceId: "price_small", active: true, sortOrder: 0 },
      { id: "large", label: "Large", amountCents: 5000, currency: "usd", stripePriceId: "price_large", active: true, sortOrder: 1 },
    ],
  };
  const normalized = normalizeAdminProductForCreate(product);
  assert.deepEqual(normalized.prints.options.map((option) => option.id), ["large", "small"]);
  assert.deepEqual(normalized.prints.options.map((option) => option.sortOrder), [1, 0]);
});

test("save errors preserve actionable validation and distinguish rules evaluation failure", () => {
  assert.match(formatAdminProductSaveError({ code: "invalid-product", message: "Print option 1 needs a Stripe Price ID." }), /Print option 1.*Stripe Price ID/);
  assert.match(formatAdminProductSaveError({ code: "permission-denied", message: "maximum of 1000 expressions to evaluate has been reached" }), /rules.*evaluation limit/i);
  assert.match(formatAdminProductSaveError({ code: "permission-denied" }), /passed client validation.*Firestore denied/i);
  assert.match(formatAdminProductSaveError({ code: "already-exists", message: 'A product with ID "new-piece" already exists.' }), /already exists/);
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
  assert.equal(archived.channels.portfolio, false);
  assert.equal(archived.archivedAt, archivedAt);

  const restored = restoreProductDraft(archived);
  assert.equal(restored.archivedAt, null);
  assert.equal(restored.active, false);
});

test("archive copy explains public visibility while archived products remain manageable", () => {
  assert.match(adminProducts, /hidden from both Shop and Portfolio/);
  assert.match(adminProducts, /Storage media will not be deleted/);
  assert.match(adminProducts, /statusFilter === "archived"/);
  assert.match(adminProducts, /Portfolio channel/);
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

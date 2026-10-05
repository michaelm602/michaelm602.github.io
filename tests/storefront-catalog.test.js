import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import {
  filterPublicCatalog,
  getCheckoutableProductSizeOptions,
  getOriginalPresentation,
  isProductSizeCheckoutSupported,
  loadSelectedStorefrontCatalog,
  mapFirestoreProductForStorefront,
  mapSourceProductForStorefront,
} from "../src/utils/storefrontProduct.js";
import { resolveStorefrontCatalogMode } from "../src/config/storefrontCatalog.js";
import { buildStripeCheckoutItems } from "../src/utils/stripeCheckout.js";
import { getCartItemPrice, getCartItemSizeOptions } from "../src/utils/cartProduct.js";
import OriginalAvailability from "../src/Components/OriginalAvailability.js";
import {
  getAllProducts,
  products as currentSourceProducts,
} from "../src/data/products.js";

const require = createRequire(import.meta.url);
const { mapSourceCatalog } = require("../functions/shopProductMapper");
const importedProducts = mapSourceCatalog(getAllProducts({ includeDrafts: true }));
const storefrontProductSource = await readFile(
  new URL("../src/utils/storefrontProduct.js", import.meta.url),
  "utf8"
);
const storefrontServiceSource = await readFile(
  new URL("../src/services/storefrontProducts.js", import.meta.url),
  "utf8"
);

const sourceProduct = {
  id: "sample-piece",
  slug: "sample-piece",
  title: "Source title",
  sizes: [
    { label: "16x20", price: 100, stripePriceId: "price_supported" },
    { label: "18x24", price: 200, stripePriceId: "price_second" },
  ],
};

function firestoreProduct(overrides = {}) {
  return {
    id: "sample-piece",
    slug: "sample-piece",
    title: "Firestore title",
    shortDescription: "Short description",
    longDescription: "Long description",
    category: "Airbrush | Print",
    tags: ["airbrush", "portrait"],
    images: [
      {
        id: "image-secondary",
        storagePath: "airbrush/secondary.webp",
        thumbnailPath: "airbrush/secondary__thumb.webp",
        alt: "Secondary image",
        sortOrder: 2,
      },
      {
        id: "image-primary",
        storagePath: "airbrush/primary.webp",
        thumbnailPath: "airbrush/primary__thumb.webp",
        alt: "Primary image",
        sortOrder: 1,
      },
    ],
    primaryImageId: "image-primary",
    original: {
      status: "available",
      size: "18x24",
      medium: "Airbrush and Acrylic",
      price: { amountCents: 25000, currency: "usd" },
      checkoutEnabled: false,
      quantity: 1,
    },
    prints: {
      available: true,
      defaultOptionId: "16x20",
      options: [
        {
          id: "unsupported",
          label: "20x30",
          amountCents: 17500,
          currency: "usd",
          stripePriceId: "price_unknown",
          active: true,
          sortOrder: 3,
        },
        {
          id: "16x20",
          label: "16x20",
          amountCents: 10000,
          currency: "usd",
          stripePriceId: "price_supported",
          active: true,
          sortOrder: 1,
        },
        {
          id: "inactive",
          label: "18x24",
          amountCents: 20000,
          currency: "usd",
          stripePriceId: "price_second",
          active: false,
          sortOrder: 2,
        },
      ],
    },
    channels: { shop: true, portfolio: true },
    active: true,
    featured: true,
    sortOrder: 4,
    relatedProductIds: [],
    seo: { title: "SEO title", description: "SEO description" },
    archivedAt: null,
    ...overrides,
  };
}

function echoesFirestoreProduct(overrides = {}) {
  return {
    id: "echoes-of-the-5th-sun",
    slug: "echoes-of-the-5th-sun",
    title: "Echoes of the 5th Sun",
    shortDescription: "",
    longDescription: "",
    category: "Airbrush and Acrylic",
    tags: [],
    images: [
      {
        id: "image-1",
        storagePath: "airbrush/Echoes of the 5th Sun.webp",
        thumbnailPath: null,
        alt: "",
        sortOrder: 0,
      },
    ],
    primaryImageId: "image-1",
    original: {
      status: "available",
      size: "30x40",
      medium: "Airbrush and Acrylic",
      price: { amountCents: 100000, currency: "usd" },
      checkoutEnabled: false,
      quantity: 1,
    },
    prints: {
      available: true,
      defaultOptionId: "16x20",
      options: [
        { id: "16x20", label: "16x20", amountCents: 10000, currency: "usd", stripePriceId: "price_1UEGj1JEVsglohuhyvEXeQBY", active: true, sortOrder: 0 },
        { id: "18x24", label: "18x24", amountCents: 20000, currency: "usd", stripePriceId: "price_1UEGj1JEVsglohuhnWpU3t8o", active: true, sortOrder: 1 },
        { id: "24x36", label: "24x36", amountCents: 30000, currency: "usd", stripePriceId: "price_1UEGj2JEVsglohuhKglFY2SV", active: true, sortOrder: 2 },
        { id: "30x40", label: "30x40", amountCents: 40000, currency: "usd", stripePriceId: "price_1UEGj3JEVsglohuhVlFYwsc8", active: true, sortOrder: 3 },
      ],
    },
    channels: { shop: true, portfolio: true },
    active: true,
    featured: true,
    sortOrder: 0,
    relatedProductIds: [],
    seo: { title: "", description: "" },
    archivedAt: null,
    ...overrides,
  };
}

function firestoreOnlyProduct(overrides = {}) {
  return firestoreProduct({
    id: "firestore-only-release",
    slug: "firestore-only-release",
    title: "Firestore Only Release",
    prints: {
      available: true,
      defaultOptionId: "12x18",
      options: [
        {
          id: "12x18",
          label: " 12x18 ",
          amountCents: 12500,
          currency: " USD ",
          stripePriceId: "price_firestore_only_not_for_browser",
          active: true,
          sortOrder: 0,
        },
      ],
    },
    ...overrides,
  });
}

test("catalog mode defaults production to Firestore and keeps an explicit source rollback", () => {
  assert.equal(resolveStorefrontCatalogMode({ isProduction: true }), "firestore");
  assert.equal(resolveStorefrontCatalogMode({ isProduction: false }), "source");
  assert.equal(
    resolveStorefrontCatalogMode({ configuredMode: " source ", isProduction: true }),
    "source"
  );
  assert.equal(
    resolveStorefrontCatalogMode({ configuredMode: "FIRESTORE", isProduction: false }),
    "firestore"
  );
  assert.throws(
    () => resolveStorefrontCatalogMode({ configuredMode: "mixed", isProduction: true }),
    /source.*firestore/i
  );
});

test("Firestore products map to the storefront shape without exposing Stripe Price IDs", () => {
  const mapped = mapFirestoreProductForStorefront(firestoreProduct());

  assert.equal(mapped.title, "Firestore title");
  assert.equal(mapped.description, "Long description");
  assert.equal(mapped.images[0].id, "image-primary");
  assert.deepEqual(mapped.images[0], {
    id: "image-primary",
    full: "airbrush/primary.webp",
    thumb: "airbrush/primary__thumb.webp",
    alt: "Primary image",
  });
  assert.deepEqual(
    mapped.sizes.map(({ label, price, checkoutSupported }) => ({ label, price, checkoutSupported })),
    [
      { label: "16x20", price: 100, checkoutSupported: true },
      { label: "20x30", price: 175, checkoutSupported: true },
    ]
  );
  assert.equal(mapped.defaultSize, "16x20");
  assert.equal(JSON.stringify(mapped).includes("stripePriceId"), false);
});

test("Echoes print options enable size selection and the quantity/add-to-cart flow", () => {
  const mapped = mapFirestoreProductForStorefront(echoesFirestoreProduct());
  const checkoutableOptions = getCheckoutableProductSizeOptions(mapped);

  assert.deepEqual(
    mapped.sizes.map(({ label, price, checkoutSupported }) => ({ label, price, checkoutSupported })),
    [
      { label: "16x20", price: 100, checkoutSupported: true },
      { label: "18x24", price: 200, checkoutSupported: true },
      { label: "24x36", price: 300, checkoutSupported: true },
      { label: "30x40", price: 400, checkoutSupported: true },
    ]
  );
  assert.deepEqual(checkoutableOptions, mapped.sizes);
  assert.equal(mapped.printsAvailable && checkoutableOptions.length > 0, true);
  for (const size of ["16x20", "18x24", "24x36", "30x40"]) {
    assert.equal(isProductSizeCheckoutSupported(mapped, size), true);
  }
  assert.equal(mapped.original.checkoutEnabled, false);
  assert.equal(JSON.stringify(mapped).includes("stripePriceId"), false);
});

test("Firestore storefront behavior does not depend on a source Price ID match", () => {
  const document = echoesFirestoreProduct();
  document.prints.options[0].stripePriceId = "price_mismatched";

  const mapped = mapFirestoreProductForStorefront(document);

  assert.equal(mapped.sizes[0].checkoutSupported, true);
  assert.equal(isProductSizeCheckoutSupported(mapped, "16x20"), true);
  assert.equal(JSON.stringify(mapped).includes("stripePriceId"), false);
});

test("Firestore storefront mapping has no hardcoded source-catalog parity dependency", () => {
  assert.doesNotMatch(storefrontProductSource, /findTrustedSourceOption|sourceProducts/);
  assert.doesNotMatch(storefrontServiceSource, /products\s+as\s+sourceProducts|sourceProducts/);
  assert.match(storefrontServiceSource, /loadSourceProducts:\s*async \(\) => getAllProducts\(\)/);
});

test("a Firestore-only product reaches the Shop model, cart snapshot, and exact checkout payload", async () => {
  const document = firestoreOnlyProduct();
  assert.equal(currentSourceProducts.some((product) => product.id === document.id), false);

  let sourceLoads = 0;
  const catalog = await loadSelectedStorefrontCatalog({
    mode: "firestore",
    channel: "shop",
    loadFirestoreDocuments: async () => [document],
    loadCatalogOrdering: async () => ({ productIds: [document.id] }),
    loadSourceProducts: async () => {
      sourceLoads += 1;
      throw new Error("Firestore mode must not load the source catalog");
    },
  });

  assert.equal(sourceLoads, 0);
  assert.deepEqual(catalog.map((product) => product.id), [document.id]);
  assert.deepEqual(catalog[0].sizes, [
    {
      id: "12x18",
      label: "12x18",
      price: 125,
      amountCents: 12500,
      currency: "usd",
      checkoutSupported: true,
    },
  ]);
  assert.equal(catalog[0].printsAvailable, true);

  const cartItem = {
    productId: catalog[0].id,
    title: catalog[0].title,
    size: catalog[0].sizes[0].label,
    price: catalog[0].sizes[0].price,
    quantity: 2,
    sizeOptions: catalog[0].sizes,
  };
  assert.deepEqual(getCartItemSizeOptions(cartItem, null), catalog[0].sizes);
  assert.equal(getCartItemPrice(cartItem, "12x18", null), 125);
  assert.deepEqual(buildStripeCheckoutItems([cartItem]), [
    { productId: "firestore-only-release", size: "12x18", quantity: 2 },
  ]);
});

test("The Jaguar’s Bloodline compatibility mirror preserves its media, contact-only original, and private print state", () => {
  const sourceJaguar = currentSourceProducts.find(
    (product) => product.id === "the-jaguars-bloodline"
  );

  assert.ok(sourceJaguar);
  assert.deepEqual(sourceJaguar.channels, { shop: false, portfolio: true });
  assert.equal(sourceJaguar.printsAvailable, false);
  assert.deepEqual(sourceJaguar.images, [
    {
      thumb: "airbrush/The Jaguars Bloodline 9.2026__thumb.webp",
      full: "airbrush/The Jaguars Bloodline 9.2026.webp",
      alt: "",
    },
  ]);
  assert.deepEqual(sourceJaguar.original, {
    status: "available",
    size: "24x36",
    medium: "Airbrush on canvas",
    price: { amountCents: 50000, currency: "usd" },
    checkoutEnabled: false,
    quantity: 1,
  });
  assert.deepEqual(
    sourceJaguar.sizes.map(({ label, price, stripePriceId }) => ({
      label,
      price,
      stripePriceId,
    })),
    [
      { label: "16x20", price: 100, stripePriceId: "price_1UN3vuJEVsglohuhrE9SbhCZ" },
      { label: "18x24", price: 200, stripePriceId: "price_1UN3vvJEVsglohuhhyCLPnlF" },
      { label: "24x36", price: 300, stripePriceId: "price_1UN3vvJEVsglohuhaWtA0Sra" },
      { label: "30x40", price: 400, stripePriceId: "price_1UN3vvJEVsglohuhVCdr55Rj" },
    ]
  );

  const mappedSource = mapSourceProductForStorefront(sourceJaguar);
  assert.equal(mappedSource.printsAvailable, false);
  assert.deepEqual(mappedSource.original, {
    status: "available",
    size: "24x36",
    medium: "Airbrush on canvas",
    price: { amountCents: 50000, currency: "usd" },
    checkoutEnabled: false,
    quantity: 1,
  });

  const importedJaguar = importedProducts.find(
    (product) => product.id === "the-jaguars-bloodline"
  );
  assert.ok(importedJaguar);
  const inactiveFirestoreDocument = {
    ...importedJaguar,
    channels: { shop: false, portfolio: true },
    prints: {
      available: false,
      defaultOptionId: null,
      options: importedJaguar.prints.options.map((option) => ({ ...option, active: false })),
    },
  };
  const mappedFirestore = mapFirestoreProductForStorefront(inactiveFirestoreDocument);

  assert.deepEqual(filterPublicCatalog([inactiveFirestoreDocument], "shop"), []);
  assert.equal(mappedFirestore.printsAvailable, false);
  assert.deepEqual(getCheckoutableProductSizeOptions(mappedFirestore), []);
  assert.equal(mappedFirestore.original.checkoutEnabled, false);

  const enabledFirestoreDocument = {
    ...importedJaguar,
    channels: { shop: true, portfolio: true },
    prints: {
      ...importedJaguar.prints,
      available: true,
      defaultOptionId: "16x20",
      options: importedJaguar.prints.options.map((option) => ({ ...option, active: true })),
    },
  };
  const enabledFirestore = mapFirestoreProductForStorefront(enabledFirestoreDocument);
  assert.deepEqual(
    getCheckoutableProductSizeOptions(enabledFirestore).map((option) => option.label),
    ["16x20", "18x24", "24x36", "30x40"]
  );
});

test("source rollback products also omit Stripe Price IDs from the storefront model", () => {
  const mapped = mapSourceProductForStorefront(sourceProduct);
  assert.equal(mapped.catalogSource, "source");
  assert.equal(mapped.sizes[0].checkoutSupported, true);
  assert.equal(JSON.stringify(mapped).includes("stripePriceId"), false);
  assert.equal(mapped.original.checkoutEnabled, false);
});

test("all public imported Shop products and print options remain structurally usable", () => {
  const publicDocuments = filterPublicCatalog(importedProducts, "shop");
  const mapped = publicDocuments.map(mapFirestoreProductForStorefront);
  const printOptions = mapped.flatMap((product) => product.sizes);

  assert.equal(mapped.length, publicDocuments.length);
  assert.equal(
    printOptions.length,
    publicDocuments.flatMap((product) => product.prints.options.filter((option) => option.active)).length
  );
  assert.equal(printOptions.every((option) => option.checkoutSupported), true);
  assert.equal(JSON.stringify(mapped).includes("stripePriceId"), false);
  assert.equal(mapped.every((product) => product.original.checkoutEnabled === false), true);
  assert.equal(mapped.find((product) => product.id === "overwhelmed").original.status, "sold");
});

test("Firestore storefront rejects structurally invalid print options", () => {
  const document = firestoreProduct({
    prints: {
      available: true,
      defaultOptionId: "valid",
      options: [
        { id: "valid", label: " 14x20 ", amountCents: 9900, currency: " USD ", active: true, sortOrder: 0 },
        { id: "blank", label: "   ", amountCents: 10000, currency: "usd", active: true, sortOrder: 1 },
        { id: "zero", label: "Zero", amountCents: 0, currency: "usd", active: true, sortOrder: 2 },
        { id: "fraction", label: "Fraction", amountCents: 100.5, currency: "usd", active: true, sortOrder: 3 },
        { id: "unsafe", label: "Unsafe", amountCents: Number.MAX_SAFE_INTEGER + 1, currency: "usd", active: true, sortOrder: 4 },
        { id: "cad", label: "CAD", amountCents: 10000, currency: "cad", active: true, sortOrder: 5 },
        { id: "inactive", label: "Inactive", amountCents: 10000, currency: "usd", active: false, sortOrder: 6 },
      ],
    },
  });

  const mapped = mapFirestoreProductForStorefront(document);
  assert.deepEqual(mapped.sizes.map((option) => option.label), ["14x20"]);
  assert.equal(mapped.sizes[0].currency, "usd");
  assert.equal(mapped.sizes[0].checkoutSupported, true);
  assert.equal(mapped.printsAvailable, true);

  const unavailable = mapFirestoreProductForStorefront(firestoreOnlyProduct({
    prints: { ...firestoreOnlyProduct().prints, available: false },
  }));
  assert.equal(unavailable.printsAvailable, false);
  assert.deepEqual(getCheckoutableProductSizeOptions(unavailable), []);
  assert.equal(isProductSizeCheckoutSupported(unavailable, "12x18"), false);

  const portfolioOnly = mapFirestoreProductForStorefront(firestoreOnlyProduct({
    channels: { shop: false, portfolio: true },
  }));
  assert.deepEqual(getCheckoutableProductSizeOptions(portfolioOnly), []);
  assert.equal(isProductSizeCheckoutSupported(portfolioOnly, "12x18"), false);
});

test("cart uses its sanitized Firestore option snapshot and retains legacy source carts", () => {
  const snapshotOptions = [
    { label: "16x20", price: 100, checkoutSupported: true },
    { label: "20x30", price: 175, checkoutSupported: false },
  ];
  const firestoreCartItem = { size: "16x20", sizeOptions: snapshotOptions };

  assert.deepEqual(getCartItemSizeOptions(firestoreCartItem, sourceProduct), [snapshotOptions[0]]);
  assert.equal(getCartItemPrice(firestoreCartItem, "16x20", sourceProduct), 100);
  assert.equal(getCartItemPrice(firestoreCartItem, "20x30", sourceProduct), null);

  const legacyCartItem = { size: "18x24" };
  assert.deepEqual(getCartItemSizeOptions(legacyCartItem, sourceProduct), sourceProduct.sizes);
  assert.equal(getCartItemPrice(legacyCartItem, "18x24", sourceProduct), 200);
});

test("public catalog filtering excludes inactive, archived, and non-shop products", () => {
  const documents = [
    firestoreProduct({ id: "visible", slug: "visible" }),
    firestoreProduct({ id: "inactive", slug: "inactive", active: false }),
    firestoreProduct({ id: "archived", slug: "archived", archivedAt: new Date() }),
    firestoreProduct({
      id: "portfolio-only",
      slug: "portfolio-only",
      channels: { shop: false, portfolio: true },
    }),
  ];

  assert.deepEqual(filterPublicCatalog(documents, "shop").map((product) => product.id), ["visible"]);
  assert.deepEqual(
    filterPublicCatalog(documents, "portfolio").map((product) => product.id),
    ["portfolio-only", "visible"]
  );
});

test("Shop applies its explicit ordering after visibility filtering", () => {
  const documents = [
    firestoreProduct({ id: "first-legacy", slug: "first-legacy", sortOrder: 0 }),
    firestoreProduct({ id: "first-explicit", slug: "first-explicit", sortOrder: 99 }),
    firestoreProduct({ id: "last-legacy", slug: "last-legacy", sortOrder: 5 }),
    firestoreProduct({ id: "inactive", slug: "inactive", active: false, sortOrder: 0 }),
    firestoreProduct({ id: "archived", slug: "archived", archivedAt: new Date(), sortOrder: 0 }),
    firestoreProduct({
      id: "portfolio-only",
      slug: "portfolio-only",
      sortOrder: 1,
      channels: { shop: false, portfolio: true },
    }),
  ];

  assert.deepEqual(
    filterPublicCatalog(documents, "shop", {
      productIds: ["inactive", "portfolio-only", "archived", "stale", "first-explicit"],
    }).map((product) => product.id),
    ["first-explicit", "first-legacy", "last-legacy"]
  );
});

test("Firestore catalog loading uses the channel ordering document and falls back on read failure", async () => {
  const documents = [
    firestoreProduct({ id: "legacy-first", slug: "legacy-first", sortOrder: 0 }),
    firestoreProduct({ id: "explicit-first", slug: "explicit-first", sortOrder: 9 }),
  ];
  const requestedChannels = [];

  const explicitlyOrdered = await loadSelectedStorefrontCatalog({
    mode: "firestore",
    channel: "shop",
    loadFirestoreDocuments: async () => documents,
    loadCatalogOrdering: async (channel) => {
      requestedChannels.push(channel);
      return { productIds: ["explicit-first"] };
    },
    loadSourceProducts: async () => [],
  });
  assert.deepEqual(requestedChannels, ["shop"]);
  assert.deepEqual(explicitlyOrdered.map((product) => product.id), ["explicit-first", "legacy-first"]);

  const fallback = await loadSelectedStorefrontCatalog({
    mode: "firestore",
    channel: "shop",
    loadFirestoreDocuments: async () => documents,
    loadCatalogOrdering: async () => { throw new Error("ordering unavailable"); },
    loadSourceProducts: async () => [],
  });
  assert.deepEqual(fallback.map((product) => product.id), ["legacy-first", "explicit-first"]);
});

test("whole-catalog loading selects exactly one source and never falls back after failure", async () => {
  let sourceLoads = 0;
  const loadSource = async () => {
    sourceLoads += 1;
    return [sourceProduct];
  };
  const firestoreError = new Error("Firestore unavailable");

  await assert.rejects(
    () =>
      loadSelectedStorefrontCatalog({
        mode: "firestore",
        loadFirestoreDocuments: async () => {
          throw firestoreError;
        },
        loadSourceProducts: loadSource,
      }),
    firestoreError
  );
  assert.equal(sourceLoads, 0);

  const sourceCatalog = await loadSelectedStorefrontCatalog({
    mode: "source",
    loadFirestoreDocuments: async () => [firestoreProduct()],
    loadSourceProducts: loadSource,
  });
  assert.equal(sourceLoads, 1);
  assert.equal(sourceCatalog[0].title, "Source title");
  assert.equal(JSON.stringify(sourceCatalog).includes("stripePriceId"), false);
});

test("available originals render contact-to-purchase details without checkout controls", () => {
  const product = mapFirestoreProductForStorefront(firestoreProduct());
  const presentation = getOriginalPresentation(product);
  assert.deepEqual(presentation, {
    visible: true,
    label: "Original available",
    details: ["18x24", "Airbrush and Acrylic", "$250"],
    contactPath: "/contact?intent=original&product=sample-piece&productName=Firestore%20title",
  });

  const markup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(OriginalAvailability, { product })
    )
  );
  assert.match(markup, /Original available/);
  assert.match(markup, /18x24/);
  assert.match(markup, /Airbrush and Acrylic/);
  assert.match(markup, /\$250/);
  assert.match(markup, /Contact to purchase/);
  assert.doesNotMatch(markup, /checkout|add original to cart/i);
});

test("sold originals render sold status and not-for-sale originals render nothing", () => {
  const sold = mapFirestoreProductForStorefront(
    firestoreProduct({
      original: {
        status: "sold",
        size: "16x20",
        medium: "Canvas",
        price: { amountCents: null, currency: "usd" },
        checkoutEnabled: false,
        quantity: 0,
      },
    })
  );
  const soldMarkup = renderToStaticMarkup(
    React.createElement(MemoryRouter, null, React.createElement(OriginalAvailability, { product: sold }))
  );
  assert.match(soldMarkup, /Original sold/);
  assert.doesNotMatch(soldMarkup, /Contact to purchase/);

  const notForSale = { ...sold, original: { ...sold.original, status: "not_for_sale" } };
  assert.equal(
    renderToStaticMarkup(
      React.createElement(MemoryRouter, null, React.createElement(OriginalAvailability, { product: notForSale }))
    ),
    ""
  );
});

test("Stripe checkout items contain product ID, size, and quantity only", () => {
  const items = buildStripeCheckoutItems([
    {
      productId: "echoes-of-the-5th-sun",
      title: "Echoes of the 5th Sun",
      size: "16x20",
      quantity: 2,
      price: 1,
      stripePriceId: "price_browser_must_not_send",
      original: true,
    },
  ]);

  assert.deepEqual(items, [{ productId: "echoes-of-the-5th-sun", size: "16x20", quantity: 2 }]);
  assert.deepEqual(Object.keys(items[0]), ["productId", "size", "quantity"]);
});

import test from "node:test";
import assert from "node:assert/strict";
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
import { products as currentSourceProducts } from "../src/data/products.js";

const importedProducts = JSON.parse(
  await readFile(new URL("../artifacts/shop-products-migration.json", import.meta.url), "utf8")
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
  const mapped = mapFirestoreProductForStorefront(firestoreProduct(), {
    sourceProducts: [sourceProduct],
  });

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
      { label: "20x30", price: 175, checkoutSupported: false },
    ]
  );
  assert.equal(mapped.defaultSize, "16x20");
  assert.equal(JSON.stringify(mapped).includes("stripePriceId"), false);
});

test("Echoes print options enable size selection and the quantity/add-to-cart flow", () => {
  const mapped = mapFirestoreProductForStorefront(echoesFirestoreProduct(), {
    sourceProducts: currentSourceProducts,
  });
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

test("Echoes remains unavailable when a Firestore Price ID differs from the source allowlist", () => {
  const document = echoesFirestoreProduct();
  document.prints.options[0].stripePriceId = "price_mismatched";

  const mapped = mapFirestoreProductForStorefront(document, {
    sourceProducts: currentSourceProducts,
  });

  assert.equal(mapped.sizes[0].checkoutSupported, false);
  assert.match(mapped.sizes[0].configurationIssue, /temporarily unavailable/i);
  assert.equal(isProductSizeCheckoutSupported(mapped, "16x20"), false);
  assert.deepEqual(
    getCheckoutableProductSizeOptions(mapped).map((option) => option.label),
    ["18x24", "24x36", "30x40"]
  );
});

test("source rollback products also omit Stripe Price IDs from the storefront model", () => {
  const mapped = mapSourceProductForStorefront(sourceProduct);
  assert.equal(mapped.catalogSource, "source");
  assert.equal(mapped.sizes[0].checkoutSupported, true);
  assert.equal(JSON.stringify(mapped).includes("stripePriceId"), false);
  assert.equal(mapped.original.checkoutEnabled, false);
});

test("all 15 imported products and 60 print options match trusted checkout configuration", () => {
  const mapped = importedProducts.map((product) =>
    mapFirestoreProductForStorefront(product, { sourceProducts: currentSourceProducts })
  );
  const printOptions = mapped.flatMap((product) => product.sizes);

  assert.equal(mapped.length, 15);
  assert.equal(printOptions.length, 60);
  assert.equal(printOptions.every((option) => option.checkoutSupported), true);
  assert.equal(JSON.stringify(mapped).includes("stripePriceId"), false);
  assert.equal(mapped.every((product) => product.original.checkoutEnabled === false), true);
  assert.equal(mapped.find((product) => product.id === "overwhelmed").original.status, "sold");
});

test("checkout compatibility fails closed for trusted catalog drift", () => {
  for (const changedOption of [
    { amountCents: 9900 },
    { currency: "cad" },
    { stripePriceId: "price_different" },
  ]) {
    const document = firestoreProduct({
      prints: {
        available: true,
        defaultOptionId: "16x20",
        options: [{ ...firestoreProduct().prints.options[1], ...changedOption }],
      },
    });
    const [option] = mapFirestoreProductForStorefront(document, {
      sourceProducts: [sourceProduct],
    }).sizes;
    assert.equal(option.checkoutSupported, false);
    assert.match(option.configurationIssue, /temporarily unavailable/i);
    assert.equal(isProductSizeCheckoutSupported({ sizes: [option] }, option.label), false);
    assert.deepEqual(getCheckoutableProductSizeOptions({ sizes: [option] }), []);
  }
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
        sourceProducts: [sourceProduct],
      }),
    firestoreError
  );
  assert.equal(sourceLoads, 0);

  const sourceCatalog = await loadSelectedStorefrontCatalog({
    mode: "source",
    loadFirestoreDocuments: async () => [firestoreProduct()],
    loadSourceProducts: loadSource,
    sourceProducts: [sourceProduct],
  });
  assert.equal(sourceLoads, 1);
  assert.equal(sourceCatalog[0].title, "Source title");
  assert.equal(JSON.stringify(sourceCatalog).includes("stripePriceId"), false);
});

test("available originals render contact-to-purchase details without checkout controls", () => {
  const product = mapFirestoreProductForStorefront(firestoreProduct(), {
    sourceProducts: [sourceProduct],
  });
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
    }),
    { sourceProducts: [sourceProduct] }
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

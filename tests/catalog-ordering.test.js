import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCatalogOrdering,
  compareLegacyPortfolioProducts,
  compareLegacyShopProducts,
  moveCatalogOrderingId,
  sanitizeCatalogOrdering,
} from "../src/utils/catalogOrdering.js";

const ids = (products) => products.map((product) => product.id);

test("catalog ordering sanitizes malformed, duplicate, and oversized product IDs", () => {
  assert.deepEqual(
    sanitizeCatalogOrdering({
      productIds: ["third", "", 7, "third", " second ", "x".repeat(101), "first"],
    }),
    ["third", "second", "first"]
  );
  assert.deepEqual(sanitizeCatalogOrdering(null), []);
  assert.deepEqual(sanitizeCatalogOrdering({ productIds: "first" }), []);
});

test("explicit ordering is authoritative and appends missing products by fallback", () => {
  const products = [
    { id: "legacy-first", sortOrder: 0 },
    { id: "explicit-first", sortOrder: 99 },
    { id: "legacy-second", sortOrder: 2 },
  ];

  assert.deepEqual(
    ids(applyCatalogOrdering(products, ["stale", "explicit-first"], compareLegacyShopProducts)),
    ["explicit-first", "legacy-first", "legacy-second"]
  );
});

test("Shop and Portfolio explicit orders can diverge independently", () => {
  const products = [
    { id: "alpha", sortOrder: 0, featured: true },
    { id: "beta", sortOrder: 1, featured: false },
    { id: "gamma", sortOrder: 2, featured: false },
  ];

  assert.deepEqual(
    ids(applyCatalogOrdering(products, ["gamma", "alpha", "beta"], compareLegacyShopProducts)),
    ["gamma", "alpha", "beta"]
  );
  assert.deepEqual(
    ids(applyCatalogOrdering(products, ["beta", "gamma", "alpha"], compareLegacyPortfolioProducts)),
    ["beta", "gamma", "alpha"]
  );
});

test("legacy Shop fallback reproduces sortOrder then stable product ID", () => {
  const products = [
    { id: "charlie", sortOrder: 2 },
    { id: "bravo", sortOrder: 0 },
    { id: "alpha" },
  ];

  assert.deepEqual(
    ids(applyCatalogOrdering(products, [], compareLegacyShopProducts)),
    ["alpha", "bravo", "charlie"]
  );
});

test("legacy Portfolio fallback reproduces Featured, order, timestamp, and ID", () => {
  const products = [
    { id: "regular", featured: false, sortOrder: 0, updatedAt: "2026-04-01T00:00:00Z" },
    { id: "featured-later", featured: true, sortOrder: 5, updatedAt: "2026-04-03T00:00:00Z" },
    { id: "featured-newer", featured: true, sortOrder: 1, updatedAt: "2026-04-03T00:00:00Z" },
    { id: "featured-older", featured: true, sortOrder: 1, createdAt: "2026-04-01T00:00:00Z" },
  ];

  assert.deepEqual(
    ids(applyCatalogOrdering(products, [], compareLegacyPortfolioProducts)),
    ["featured-newer", "featured-older", "featured-later", "regular"]
  );
});

test("Featured never overrides an explicit Portfolio position", () => {
  const products = [
    { id: "featured", featured: true, sortOrder: 0 },
    { id: "wall-first", featured: false, sortOrder: 99 },
  ];

  assert.deepEqual(
    ids(applyCatalogOrdering(products, ["wall-first", "featured"], compareLegacyPortfolioProducts)),
    ["wall-first", "featured"]
  );
});

test("catalog ordering moves one visible product without changing the others", () => {
  assert.deepEqual(moveCatalogOrderingId(["one", "two", "three"], "two", -1), [
    "two", "one", "three",
  ]);
  assert.deepEqual(moveCatalogOrderingId(["one", "two", "three"], "two", 1), [
    "one", "three", "two",
  ]);
  assert.deepEqual(moveCatalogOrderingId(["one", "two", "three"], "one", -1), [
    "one", "two", "three",
  ]);
});

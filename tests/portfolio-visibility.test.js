import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getPortfolioCategory,
  getPortfolioCategoryDestination,
  getVisiblePortfolioCategories,
} from "../src/config/portfolioCategories.js";
import * as storefrontProduct from "../src/utils/storefrontProduct.js";

const gallerySource = await readFile(new URL("../src/Components/Gallery.jsx", import.meta.url), "utf8");

function storageItem(fullPath) {
  return { fullPath, name: fullPath.split("/").at(-1) };
}

function portfolioMedia(fullPath, timeCreated = null) {
  return { fullPath, timeCreated };
}

function visiblePortfolioProduct({
  id,
  storagePath,
  featured = false,
  sortOrder = 0,
  updatedAt = null,
  createdAt = null,
}) {
  return {
    id,
    active: true,
    archivedAt: null,
    channels: { portfolio: true },
    featured,
    sortOrder,
    updatedAt,
    createdAt,
    images: [{ storagePath, thumbnailPath: null }],
  };
}

test("public portfolio categories exclude hidden tattoo work", () => {
  assert.deepEqual(
    getVisiblePortfolioCategories().map(({ slug }) => slug),
    ["airbrush", "photoshop"]
  );
});

test("tattoo configuration is retained but routes visitors back to the portfolio", () => {
  const tattoos = getPortfolioCategory("tattoos");

  assert.equal(tattoos?.visible, false);
  assert.equal(tattoos?.folder, "tattoos");
  assert.equal(getPortfolioCategoryDestination("tattoos"), "/portfolio");
});

test("visible categories retain their public destinations", () => {
  assert.equal(getPortfolioCategoryDestination("airbrush"), "/portfolio/airbrush");
  assert.equal(getPortfolioCategoryDestination("photoshop"), "/portfolio/photoshop");
});

test("unknown portfolio categories fail closed", () => {
  assert.equal(getPortfolioCategoryDestination("unknown"), "/portfolio");
});

test("portfolio Storage filtering hides every variant linked to an archived product path", () => {
  assert.equal(typeof storefrontProduct.filterPortfolioStorageItems, "function");
  const items = [
    storageItem("airbrush/Out For Fame.jpg"),
    storageItem("airbrush/Out For Fame.webp"),
    storageItem("airbrush/Out For Fame__thumb.webp"),
    storageItem("airbrush/Alter Ego.webp"),
    storageItem("airbrush/Family.webp"),
  ];
  const managedProducts = [
    { id: "out-for-fame", images: [{ full: "airbrush/Out For Fame.webp", thumb: "airbrush/Out For Fame__thumb.webp" }] },
    { id: "alter-ego", images: [{ full: "airbrush/Alter Ego.webp", thumb: "airbrush/Alter Ego__thumb.webp" }] },
  ];
  const visibleProductDocuments = [{
    id: "alter-ego",
    active: true,
    archivedAt: null,
    channels: { portfolio: true },
    images: [{ storagePath: "airbrush/Alter Ego.webp", thumbnailPath: "airbrush/Alter Ego__thumb.webp" }],
  }];

  assert.deepEqual(
    storefrontProduct.filterPortfolioStorageItems(items, { managedProducts, visibleProductDocuments })
      .map((item) => item.fullPath),
    ["airbrush/Alter Ego.webp", "airbrush/Family.webp"]
  );
});

test("portfolio ordering places featured managed media before non-featured media", () => {
  const ordered = storefrontProduct.sortPortfolioMedia([
    portfolioMedia("airbrush/Regular.webp", "2026-09-10T00:00:00.000Z"),
    portfolioMedia("airbrush/Featured.webp", "2026-09-01T00:00:00.000Z"),
  ], {
    visibleProductDocuments: [
      visiblePortfolioProduct({ id: "regular", storagePath: "airbrush/Regular.webp", sortOrder: 0 }),
      visiblePortfolioProduct({ id: "featured", storagePath: "airbrush/Featured.webp", featured: true, sortOrder: 99 }),
    ],
  });

  assert.deepEqual(ordered.map((item) => item.fullPath), [
    "airbrush/Featured.webp",
    "airbrush/Regular.webp",
  ]);
});

test("portfolio ordering uses lower managed product sortOrder before product timestamps", () => {
  const ordered = storefrontProduct.sortPortfolioMedia([
    portfolioMedia("airbrush/Later.webp", "2026-09-10T00:00:00.000Z"),
    portfolioMedia("airbrush/Earlier.webp", "2026-09-01T00:00:00.000Z"),
  ], {
    visibleProductDocuments: [
      visiblePortfolioProduct({
        id: "later",
        storagePath: "airbrush/Later.webp",
        sortOrder: 8,
        updatedAt: "2026-09-10T00:00:00.000Z",
      }),
      visiblePortfolioProduct({
        id: "earlier",
        storagePath: "airbrush/Earlier.webp",
        sortOrder: 1,
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    ],
  });

  assert.deepEqual(ordered.map((item) => item.fullPath), [
    "airbrush/Earlier.webp",
    "airbrush/Later.webp",
  ]);
});

test("portfolio ordering uses updatedAt then createdAt for equally ordered managed media", () => {
  const ordered = storefrontProduct.sortPortfolioMedia([
    portfolioMedia("airbrush/Created.webp"),
    portfolioMedia("airbrush/Updated.webp"),
  ], {
    visibleProductDocuments: [
      visiblePortfolioProduct({
        id: "created",
        storagePath: "airbrush/Created.webp",
        sortOrder: 2,
        createdAt: "2026-09-09T00:00:00.000Z",
      }),
      visiblePortfolioProduct({
        id: "updated",
        storagePath: "airbrush/Updated.webp",
        sortOrder: 2,
        updatedAt: "2026-09-10T00:00:00.000Z",
        createdAt: "2026-09-01T00:00:00.000Z",
      }),
    ],
  });

  assert.deepEqual(ordered.map((item) => item.fullPath), [
    "airbrush/Updated.webp",
    "airbrush/Created.webp",
  ]);
});

test("portfolio ordering puts newer unmanaged Storage media first", () => {
  const ordered = storefrontProduct.sortPortfolioMedia([
    portfolioMedia("airbrush/Older.webp", "2026-09-01T00:00:00.000Z"),
    portfolioMedia("airbrush/Newer.webp", "2026-09-10T00:00:00.000Z"),
  ]);

  assert.deepEqual(ordered.map((item) => item.fullPath), [
    "airbrush/Newer.webp",
    "airbrush/Older.webp",
  ]);
});

test("portfolio ordering falls back to normalized filename order when metadata is missing", () => {
  const ordered = storefrontProduct.sortPortfolioMedia([
    portfolioMedia("airbrush/Zebra.webp"),
    portfolioMedia("airbrush/alpha.webp"),
  ]);

  assert.deepEqual(ordered.map((item) => item.fullPath), [
    "airbrush/alpha.webp",
    "airbrush/Zebra.webp",
  ]);
});

test("portfolio gallery reconciles product paths while retaining independent Storage media", () => {
  assert.match(gallerySource, /loadPublicFirestoreDocuments\("shop"\)/);
  assert.match(gallerySource, /filterPortfolioStorageItems/);
});

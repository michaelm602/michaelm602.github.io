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

test("portfolio gallery reconciles product paths while retaining independent Storage media", () => {
  assert.match(gallerySource, /loadPublicFirestoreDocuments\("shop"\)/);
  assert.match(gallerySource, /filterPortfolioStorageItems/);
});

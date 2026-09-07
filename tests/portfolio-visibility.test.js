import test from "node:test";
import assert from "node:assert/strict";
import {
  getPortfolioCategory,
  getPortfolioCategoryDestination,
  getVisiblePortfolioCategories,
} from "../src/config/portfolioCategories.js";

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

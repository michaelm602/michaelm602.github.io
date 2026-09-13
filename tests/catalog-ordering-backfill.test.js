import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCatalogOrderingBackfillPlan,
  parseCatalogOrderingBackfillArguments,
} from "../scripts/backfill-catalog-ordering.mjs";

function product(id, overrides = {}) {
  return {
    id,
    active: true,
    archivedAt: null,
    channels: { shop: true, portfolio: true },
    featured: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("backfill is dry-run by default and requires an explicit project", () => {
  assert.deepEqual(parseCatalogOrderingBackfillArguments(["--project", "demo-project"]), {
    projectId: "demo-project",
    write: false,
    output: null,
  });
  assert.throws(() => parseCatalogOrderingBackfillArguments([]), /--project/);
});

test("backfill derives exact current Shop and Portfolio product order independently", () => {
  const products = [
    product("featured-late", { featured: true, sortOrder: 9 }),
    product("plain-first", { sortOrder: 1 }),
    product("plain-newer", { sortOrder: 5, updatedAt: "2026-03-01T00:00:00.000Z" }),
    product("plain-older", { sortOrder: 5, updatedAt: "2026-02-01T00:00:00.000Z" }),
    product("shop-only", { sortOrder: 2, channels: { shop: true, portfolio: false } }),
    product("portfolio-only", { sortOrder: 2, channels: { shop: false, portfolio: true } }),
    product("inactive", { active: false, sortOrder: 0 }),
    product("archived", { active: false, archivedAt: "2026-04-01", sortOrder: 0 }),
  ];

  const plan = buildCatalogOrderingBackfillPlan(products, {});

  assert.deepEqual(plan.documents.shop.productIds, [
    "plain-first", "shop-only", "plain-newer", "plain-older", "featured-late",
  ]);
  assert.deepEqual(plan.documents.portfolio.productIds, [
    "featured-late", "plain-first", "portfolio-only", "plain-newer", "plain-older",
  ]);
  assert.deepEqual(plan.create.map((item) => item.channel), ["shop", "portfolio"]);
  assert.deepEqual(plan.excluded.inactive, ["inactive"]);
  assert.deepEqual(plan.excluded.archived, ["archived"]);
});

test("backfill is idempotent and never overwrites an existing ordering document", () => {
  const products = [product("one"), product("two", { sortOrder: 1 })];
  const existing = {
    shop: { productIds: ["two", "one"] },
    portfolio: { productIds: ["one", "two"] },
  };

  const plan = buildCatalogOrderingBackfillPlan(products, existing);

  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.preserve.map((item) => item.channel), ["shop", "portfolio"]);
  assert.deepEqual(plan.existing, existing);
});

test("backfill source cannot modify product, checkout, or Stripe data", async () => {
  const source = await readFile(
    new URL("../scripts/backfill-catalog-ordering.mjs", import.meta.url),
    "utf8"
  );

  assert.match(source, /collection\("shopProducts"\)\.get\(\)/);
  assert.match(source, /collection\("catalogOrdering"\)/);
  assert.match(source, /batch\.create\(/);
  assert.doesNotMatch(source, /batch\.(?:set|update|delete)\(/);
  assert.doesNotMatch(source, /stripe|priceId|printOptions|images/i);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  parseImportArguments,
  planShopProductChanges,
} from "../scripts/shop-product-import-plan.mjs";

test("Firestore import arguments default to dry-run and require an explicit project ID", () => {
  assert.deepEqual(parseImportArguments(["--project-id", "example-project"]), {
    projectId: "example-project",
    write: false,
  });
  assert.deepEqual(
    parseImportArguments(["--write", "--project-id", "example-project"]),
    { projectId: "example-project", write: true }
  );
  assert.throws(() => parseImportArguments([]), /--project-id/);
  assert.throws(() => parseImportArguments(["--write"]), /--project-id/);
});

test("import planning reports creates, updates, unchanged docs, and changed paths", () => {
  const desired = [
    { id: "create", title: "Create", active: true, createdAt: null, updatedAt: null },
    { id: "update", title: "New title", active: true, createdAt: null, updatedAt: null },
    { id: "same", title: "Same", active: true, createdAt: null, updatedAt: null },
    { id: "missing-created", title: "Needs timestamp", active: true, createdAt: null, updatedAt: null },
  ];
  const existing = new Map([
    ["update", { id: "update", title: "Old title", active: true, createdAt: "old", updatedAt: "old" }],
    ["same", { id: "same", title: "Same", active: true, createdAt: "old", updatedAt: "old" }],
    ["missing-created", { id: "missing-created", title: "Needs timestamp", active: true, updatedAt: "old" }],
    ["untouched", { id: "untouched", title: "Keep me" }],
  ]);

  const plan = planShopProductChanges(desired, existing);
  assert.deepEqual(plan.summary, { create: 1, update: 2, unchanged: 1, untouched: 1 });
  assert.deepEqual(plan.create.map((change) => change.id), ["create"]);
  assert.deepEqual(plan.update.map((change) => change.id), ["update", "missing-created"]);
  assert.deepEqual(plan.update[0].changedPaths, ["title"]);
  assert.deepEqual(plan.update[1].changedPaths, ["createdAt"]);
  assert.deepEqual(plan.unchanged, ["same"]);
  assert.deepEqual(plan.untouched, ["untouched"]);
});

test("import planning never overwrites Admin-managed prints on existing products", () => {
  const adminPrints = {
    available: true,
    defaultOptionId: "16x20",
    options: [{
      id: "16x20",
      label: "16x20",
      amountCents: 12500,
      currency: "usd",
      stripePriceId: "price_admin_managed",
      active: true,
      sortOrder: 0,
    }],
  };
  const sourcePrints = {
    available: true,
    defaultOptionId: "16x20",
    options: [{
      id: "16x20",
      label: "16x20",
      amountCents: 10000,
      currency: "usd",
      stripePriceId: "price_stale_source",
      active: true,
      sortOrder: 0,
    }],
  };
  const desired = [{
    id: "art",
    title: "Updated title",
    prints: sourcePrints,
    createdAt: null,
    updatedAt: null,
  }];
  const existing = new Map([["art", {
    id: "art",
    title: "Old title",
    prints: adminPrints,
    createdAt: "old",
    updatedAt: "old",
  }]]);

  const plan = planShopProductChanges(desired, existing);

  assert.deepEqual(plan.update[0].changedPaths, ["title"]);
  assert.equal(Object.hasOwn(plan.update[0].document, "prints"), false);
  assert.deepEqual(plan.protected, [{ id: "art", changedPaths: ["prints"] }]);
});

test("source-only print drift is reported but produces no existing-document write", () => {
  const desired = [{
    id: "art",
    title: "Art",
    prints: { available: true, options: [{ amountCents: 10000 }] },
    createdAt: null,
    updatedAt: null,
  }];
  const existing = new Map([["art", {
    id: "art",
    title: "Art",
    prints: { available: true, options: [{ amountCents: 12500 }] },
    createdAt: "old",
    updatedAt: "old",
  }]]);

  const plan = planShopProductChanges(desired, existing);

  assert.deepEqual(plan.update, []);
  assert.deepEqual(plan.unchanged, ["art"]);
  assert.deepEqual(plan.protected, [{ id: "art", changedPaths: ["prints"] }]);
});

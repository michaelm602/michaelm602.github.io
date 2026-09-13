# Catalog Ordering Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent exact Shop and Portfolio ordering through dedicated Firestore display-metadata documents.

**Architecture:** A pure ordering utility sanitizes `productIds` and overlays explicit order on the existing channel-specific fallback comparators. Public and admin services read/write `catalogOrdering/{shop|portfolio}`; products retain their existing schema. A dry-run-first migration script derives the two initial arrays from the current effective orders.

**Tech Stack:** React, Firebase Web SDK, Firebase Admin SDK, Firestore Rules v2, Node test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-09-12-catalog-ordering-documents-design.md`

## Global Constraints

- Do not modify the `shopProducts` schema or weaken its rules.
- Do not change checkout, Stripe, prices, print options, PayPal, or original checkout.
- Do not deploy, commit, push, or write live Firestore data in this implementation session.
- All production changes follow a failing-test-first cycle.

---

### Task 1: Pure channel ordering

**Files:**
- Create: `src/utils/catalogOrdering.js`
- Create: `tests/catalog-ordering.test.js`

**Interfaces:**
- Produces: `sanitizeCatalogOrdering(value)`, `applyCatalogOrdering(products, productIds, fallbackComparator)`, `compareLegacyShopProducts(left, right)`, and `compareLegacyPortfolioProducts(left, right)`.

- [ ] Write tests with literal expected IDs for explicit divergence, stale/duplicate/malformed IDs, incomplete arrays, missing documents, current Shop order, and current Portfolio preservation order.
- [ ] Run `node --test tests/catalog-ordering.test.js` and confirm missing-module failure.
- [ ] Implement only the pure ordering behavior.
- [ ] Rerun the focused test and confirm it passes.

### Task 2: Public Shop and Portfolio integration

**Files:**
- Modify: `src/services/storefrontProducts.js`
- Modify: `src/utils/storefrontProduct.js`
- Modify: `src/Components/Gallery.jsx`
- Modify: `tests/storefront-catalog.test.js`
- Modify: `tests/portfolio-visibility.test.js`

**Interfaces:**
- Consumes: Task 1 ordering utilities.
- Produces: `loadPublicCatalogOrdering(channel)` and ordered public products/media with legacy fallback.

- [ ] Add failing tests proving Shop and Portfolio load separate documents, explicit order is authoritative, visibility is unchanged, missing documents fall back, and unmanaged media stays last.
- [ ] Run the focused tests and confirm the new assertions fail.
- [ ] Implement safe ordering-document reads and apply the arrays only after channel visibility filtering.
- [ ] Rerun the focused tests and confirm they pass.

### Task 3: Admin ordering panel

**Files:**
- Create: `src/Components/CatalogOrderingPanel.jsx`
- Create: `src/services/catalogOrdering.js`
- Modify: `src/pages/AdminProducts.jsx`
- Modify: `tests/admin-products.test.js`

**Interfaces:**
- Produces: admin read/save functions for the two fixed documents and a move-control panel that saves complete visible product arrays.

- [ ] Add failing tests for separate labels, helpers, move behavior, independent saves, and the legacy fallback label.
- [ ] Run the focused tests and confirm failure.
- [ ] Implement the service and panel without changing product save payloads.
- [ ] Rerun the focused tests and confirm pass.

### Task 4: Narrow Firestore rules

**Files:**
- Modify: `firestore.rules`
- Modify: `tests/firestore-shop-products.rules.mjs`
- Modify: `tests/security-rules.test.js`
- Create: `docs/catalog-ordering.md`

**Interfaces:**
- Produces: public read/admin-only validated writes for only `catalogOrdering/shop` and `/portfolio`.

- [ ] Add emulator tests for public reads, admin create/update, non-admin denial, unknown document denial, malformed/extra/oversized data denial, and delete denial.
- [ ] Run the focused emulator suite and confirm rules deny the new valid operations.
- [ ] Add the narrow match block without modifying the `shopProducts` block.
- [ ] Rerun the emulator suite and confirm pass.
- [ ] Document the model and devil's-advocate outcomes in `docs/catalog-ordering.md`.

### Task 5: Dry-run-first migration

**Files:**
- Create: `scripts/backfill-catalog-ordering.mjs`
- Create: `tests/catalog-ordering-backfill.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildCatalogOrderingBackfillPlan(products, existingOrdering)` and CLI flags `--project`, `--output`, and `--write`.

- [ ] Add failing pure tests proving exact preservation arrays, all visibility states, idempotent existing-document behavior, and no product mutation.
- [ ] Run the focused test and confirm missing-module failure.
- [ ] Implement the pure planner and CLI; default to dry-run, write the local report first, and create only missing ordering documents under `--write`.
- [ ] Rerun the focused tests and confirm pass.

### Task 6: Full verification

**Files:**
- Verify all modified files.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:firestore-rules`.
- [ ] Run scoped ESLint over changed JavaScript/JSX/MJS files.
- [ ] Run `git diff --check`.
- [ ] Inspect `git diff` to confirm `shopProducts`, checkout, Stripe catalog/sync, PayPal, and original checkout behavior were not modified.

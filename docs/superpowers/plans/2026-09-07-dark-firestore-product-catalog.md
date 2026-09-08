# Dark Firestore Product Catalog Implementation Plan

> **For agentic workers:** Implement this plan inline with test-first changes. Do not commit because the user explicitly prohibited commits for Phase 2A.

**Goal:** Add a validated, migration-ready `shopProducts` catalog without changing the live storefront or checkout source.

**Architecture:** Keep `src/data/products.js` and `functions/stripeCatalog.js` unchanged as the active sources. Add shared server-side schema, mapping, parity, repository, and import-planning modules; expose safe Node CLIs for local dry runs and explicit Firestore upserts.

**Tech Stack:** Node.js 20, CommonJS server modules, ESM CLI scripts, Firebase Admin SDK, Node test runner.

**Spec:** User-provided Phase 2A request dated 2026-09-07.

## Global Constraints

- Do not change customer storefront, cart, Stripe checkout, PayPal state, Firebase rules, admin auth, Storage rules, tattoo visibility, product IDs, slugs, prices, or Stripe Price IDs.
- `products.js` and the static server Stripe catalog remain active.
- No commit, push, deploy, or live Firebase data write.
- Firestore import uses the existing `(default)` database, never deletes, and requires both an explicit project ID and `--write` before upserting.

### Task 1: Schema, mapping, and parity

**Files:**
- Create: `functions/shopProductSchema.js`
- Create: `functions/shopProductMapper.js`
- Test: `functions/shopProductCatalog.test.js`

**Interfaces:**
- `validateShopProductDocument(document)` returns validation issues.
- `assertValidShopProductDocument(document)` throws on invalid documents.
- `mapSourceProduct(product, sortOrder)` and `mapSourceCatalog(products)` create deterministic schema documents.
- `buildCatalogParityReport(products, documents)` reports counts and preservation errors.

- [ ] Write tests covering all 15 products, 60 options and Stripe IDs, prices, images, featured/active state, Overwhelmed, invalid documents, and public filtering.
- [ ] Run the focused test and confirm it fails because the modules do not exist.
- [ ] Implement the schema, mapper, and parity report.
- [ ] Run the focused test and confirm it passes.

### Task 2: Dark server repository

**Files:**
- Create: `functions/shopProductRepository.js`
- Test: `functions/shopProductCatalog.test.js`

**Interfaces:**
- `resolveProductCatalogMode(env)` defaults to `source` and accepts only whole-catalog `source` or `firestore` modes.
- `createShopProductRepository(options).loadCheckoutCatalog()` loads exactly one catalog source without per-product fallback.

- [ ] Write failing tests for the source default, Firestore filtering, invalid documents, and no source fallback.
- [ ] Implement the repository without importing it from `functions/index.js`.
- [ ] Confirm existing trusted Stripe checkout tests still pass.

### Task 3: Safe migration and import CLIs

**Files:**
- Create: `scripts/migrate-shop-products.mjs`
- Create: `scripts/import-shop-products.mjs`
- Create: `scripts/shop-product-import-plan.mjs`
- Modify: `package.json`
- Test: `tests/shop-product-import.test.js`

**Interfaces:**
- `npm run catalog:dry-run` validates and prints source-to-schema parity without writing.
- `npm run catalog:import -- --project-id <id>` reads the remote collection and prints creates, updates, unchanged documents, and changed paths.
- Adding `--write` exports a local JSON backup and upserts only creates/updates with server timestamps.

- [ ] Write failing tests for write gating and deterministic change planning.
- [ ] Implement argument parsing, diff planning, JSON-safe backup creation, and merge-only batch upserts.
- [ ] Run the dry-run and capture its count summary.

### Task 4: Documentation and verification

**Files:**
- Create: `docs/shop-product-catalog.md`

- [ ] Document schema state combinations, commands, default source mode, backup behavior, and Phase 2B boundary.
- [ ] Run `npm test`, `npm run build`, task-scoped ESLint, `node --check`, and `git diff --check`.
- [ ] Confirm protected files and current customer behavior have no diff.

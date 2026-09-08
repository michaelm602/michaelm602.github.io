# Firestore Storefront Implementation Plan

> **For agentic workers:** Execute inline in the authorized workspace. Do not commit, push, deploy, or write live Firestore product data during this implementation.

**Goal:** Display the public shop catalog from Firestore while retaining the source catalog as an explicit rollback and the server Stripe catalog as the only checkout authority.

**Architecture:** A whole-catalog loader selects either Firestore or `products.js` once per page. A pure adapter maps safe public Firestore documents into the existing storefront shape, removes Stripe Price IDs, and marks print options checkout-compatible only when they match the retained source catalog. Public rules require active, unarchived, channel-visible documents and continue denying all public writes.

**Tech Stack:** React 19, Firebase Web SDK, Firestore Security Rules, Node test runner, Firebase Emulator Suite, Vite.

**Spec:** Conversation-approved Phase 2C requirements dated 2026-09-08.

## Global Constraints

- `functions/stripeCatalog.js` remains the trusted checkout catalog.
- Stripe requests contain only `productId`, `size`, and `quantity` per item.
- `products.js` remains the explicit whole-catalog rollback source.
- Never enable PayPal or original checkout.
- Never use automatic or per-product fallback.
- Do not expose Stripe Price IDs through the mapped storefront product model.
- Do not commit, push, deploy, or write live product data.

---

### Task 1: Catalog mode and pure storefront adapter

**Files:**
- Create: `src/config/storefrontCatalog.js`
- Create: `src/utils/storefrontProduct.js`
- Create: `tests/storefront-catalog.test.js`

**Interfaces:**
- Produces: `resolveStorefrontCatalogMode`, `mapFirestoreProductForStorefront`, `filterPublicCatalog`, and checkout-compatibility helpers.

- [ ] Write behavior tests for mode selection, full document mapping, safe filtering, removal of Stripe IDs, and unsupported print options.
- [ ] Run `node --test tests/storefront-catalog.test.js` and confirm the missing-module failure.
- [ ] Implement the pure mode and adapter functions.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Whole-catalog Firestore loader

**Files:**
- Create: `src/services/storefrontProducts.js`
- Create: `src/hooks/useStorefrontCatalog.js`
- Modify: `tests/storefront-catalog.test.js`

**Interfaces:**
- Consumes: Task 1 mode and mapping functions.
- Produces: `loadStorefrontCatalog` and `useStorefrontCatalog`, including loading, retry, and error states.

- [ ] Add a failing test proving the loader uses one selected source and never mixes fallback products.
- [ ] Implement the constrained Firestore query and source-mode branch.
- [ ] Implement the hook with explicit retry and no automatic fallback.
- [ ] Run the focused test and confirm it passes.

### Task 3: Shop, product, original, and cart presentation

**Files:**
- Create: `src/Components/OriginalAvailability.js`
- Modify: `src/Components/ShopGallery.jsx`
- Modify: `src/pages/ProductDetailPage.jsx`
- Modify: `src/Components/CartContext.jsx`
- Modify: `src/Components/CartDrawer.jsx`
- Modify: `src/utils/contactIntent.js`
- Modify: `tests/storefront-catalog.test.js`
- Modify: `tests/contact-intent.test.js`
- Modify: `tests/checkout-payment-methods.test.js`

**Interfaces:**
- Consumes: mapped storefront products and sanitized size options.
- Produces: public original-status presentation, disabled unsupported options, and cart snapshots containing no Stripe identifiers.

- [ ] Add failing tests for available/sold originals, no original checkout action, inactive option blocking, contact intent, cart options, and the exact Stripe item payload.
- [ ] Update the shop and product detail pages to consume the whole-catalog hook.
- [ ] Add the original availability component and dedicated inquiry link.
- [ ] Preserve active supported options in cart items while supporting legacy stored carts.
- [ ] Run focused tests and confirm they pass.

### Task 4: Public Firestore read rules

**Files:**
- Modify: `firestore.rules`
- Modify: `tests/firestore-shop-products.rules.mjs`
- Modify: `tests/security-rules.test.js`

**Interfaces:**
- Produces: public `get` and constrained `list` access only for active, unarchived, public-channel products.

- [ ] Add emulator tests for allowed constrained reads and denied hidden reads, unconstrained queries, writes, and deletes.
- [ ] Run the emulator suite and confirm the new public-read tests fail under current rules.
- [ ] Add the minimal public visibility predicate while retaining admin access and all write validators.
- [ ] Run the emulator suite and confirm all allow/deny cases pass.

### Task 5: Full verification and audit

**Files:**
- Review every changed file and protected-area diff.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run task-scoped ESLint.
- [ ] Run `node --check` for new JavaScript modules where applicable.
- [ ] Run the Firestore rules dry-run compile.
- [ ] Run `npm run test:firestore-rules`.
- [ ] Run `git diff --check` and confirm checkout Functions, Stripe catalog, PayPal state, and product identifiers have no protected changes.

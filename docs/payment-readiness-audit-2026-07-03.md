# Likwit Blvd payment readiness audit

Date: 2026-07-03
Scope: Stripe checkout, Firestore order lifecycle, Stripe webhook, EmailJS confirmation, cart UX, security, and production readiness.

## Executive result

**Overall: NOT READY for confident live sales yet.**

The honest-customer Stripe path is substantially wired correctly: the cart builds Stripe Price line items, the server creates a pending order before redirect, Stripe secrets are bound through Firebase Secret Manager, the webhook verifies Stripe signatures, and a completed session updates the order before sending email.

However, critical server-side validation and fulfillment controls are missing. A caller can submit arbitrary Stripe Price IDs and arbitrary order/cart totals, physical orders do not collect a shipping address, and `checkout.session.completed` is treated as paid without checking `payment_status`. The visible PayPal path is also incompatible with current Firestore protections and can capture money before failing to record the order.

No code or configuration fixes were applied in this audit.

## Critical blockers

1. **The checkout server trusts browser-supplied catalog and order data.** `createStripeCheckoutSession` accepts `lineItems`, `cartItems`, quantity, and `orderTotal` from the request. Stripe protects the amount attached to a selected Price ID, but a caller can substitute another active Price ID from the Stripe account while recording a different artwork and total in Firestore. The server must derive the Stripe Price ID, product details, and total from a server-owned catalog.

2. **Physical-order shipping information is not collected.** The Stripe Session does not configure `shipping_address_collection`, and the pending order starts with an empty `buyerInfo`. The webhook records name/email only. There is no shipping address in the order record for fulfillment.

3. **A completed Checkout Session is marked paid without validating `session.payment_status`.** This is unsafe if delayed payment methods are enabled. The webhook should only fulfill an immediately paid session, and handle `checkout.session.async_payment_succeeded` / `checkout.session.async_payment_failed` when applicable.

4. **Stripe live/test alignment has not been proven.** The deployed Stripe and webhook secrets exist, but their mode cannot be inferred safely from the public endpoint. The 60 checked-in Price IDs are structurally valid, but they have not been verified against the deployed secret's account/mode. A controlled Stripe test/live smoke test is required before accepting buyers.

5. **The visible PayPal flow can capture payment and then fail to record the order.** It captures in the browser, then attempts a client Firestore write with `status: "paid"`. Current deployed Firestore behavior denies anonymous reads and is expected to deny this write; the code then reports a generic PayPal error after capture. PayPal should be disabled until it has a server-verified capture/order webhook path, or separately repaired and tested.

## Area-by-area result

### 1. Checkout entry flow — PASS with cautions

- Shop cards require a size before adding and use catalog pricing.
- Product detail requires a valid size and opens the drawer after adding.
- The cart drawer opens through the navbar event, and the cart icon opens it directly.
- Checkout is disabled when the cart is empty; PayPal is hidden for an empty cart.
- Cancel return preserves the local cart.
- Mobile structure is reasonable (`fixed`, full-height, 320px drawer, overlay), but no real-device/browser smoke test was performed.
- There is no checkout-in-progress lock, so a double click can create multiple pending orders/Sessions.
- `src/Components/ProductCard.jsx` contains a nonfunctional Add to Cart button, but the component is currently unused.

Result by item:

- Product → size → cart: **PASS (static/code verified)**
- Drawer opens: **PASS (static/code verified)**
- Checkout enable/empty state: **PASS**
- Mobile drawer: **PARTIAL / manual test required**

### 2. Order creation — FAIL

- A pending Firestore order is created before `stripe.checkout.sessions.create`: **PASS**
- Core fields are written (`cartItems`, `buyerInfo`, status, provider, total, currency, timestamps): **PASS structurally**
- Required data validation: **FAIL**. A direct caller can provide empty/arbitrary `cartItems`, invalid quantities, and a fake `orderTotal`.
- Shipping data: **FAIL**
- Safe total calculation: **FAIL**. The stored/email total comes from the browser rather than Stripe's `amount_total`.
- Stripe paid status is not set by the browser: **PASS**
- Invalid Stripe input can leave an orphan pending order because the order is created before Stripe validates the Session: **FAIL**

### 3. Stripe Session creation — FAIL

- Firebase Secret Manager `STRIPE_SECRET_KEY`: **PASS**
- The deployed endpoint proved the secret is present because it reached request validation.
- Honest-client Price IDs are present for all 15 products / 60 size variants with no duplicates: **PASS**
- Server ownership/validation of Price IDs and quantities: **FAIL**
- Test/live behavior: **UNVERIFIED**
- Success/cancel URLs include `orderId`: **PASS for the current client**, because both base URLs already contain a query string.
- No `{CHECKOUT_SESSION_ID}` is returned in the success URL: **PARTIAL**
- URLs are caller-controlled and not allowlisted; the endpoint also permits no-origin requests: **FAIL / abuse risk**
- Friendly browser error: **PASS**
- Bad-order prevention: **FAIL**

### 4. Webhook confirmation — FAIL

- Stripe signature verification using `req.rawBody`: **PASS**
- The live webhook rejected a missing signature with HTTP 400: **PASS**
- Order lookup by Stripe metadata/client reference and paid update: **PASS**
- Confirmation that money is actually paid: **FAIL**
- Expired Sessions become expired/cancelled: **PASS**
- Customer cancel remains pending until Session expiration: **SAFE but operationally noisy**
- Async payment success/failure events: **FAIL / not handled**
- Existing paid status is not protected against later state changes: **PARTIAL**
- Duplicate email protection uses a Firestore transaction and sent flag: **PASS with an at-least-once edge case**
- Duplicate completed events rewrite `paidAt`; event processing itself is not fully idempotent: **PARTIAL**
- Error logs omit secrets and include Stripe error type/code: **PASS**
- Logs lack routine `eventId`, `orderId`, Session, and transition correlation: **IMPROVEMENT NEEDED**

### 5. EmailJS confirmation — PARTIAL

- Email is called only from the Stripe webhook path: **PASS structurally**
- Because completed Sessions are not checked for `payment_status === "paid"`, “only after confirmed payment” is **FAIL**.
- The customer send has a transactional claim and `customerEmailSent` guard: **PASS with crash-window caveat**
- Owner confirmation is assumed to be CC'd by the single EmailJS template; the external template configuration could not be inspected: **UNVERIFIED**
- Owner flag is written only after the customer-template request succeeds: **PASS**
- Email failure is recorded and does not roll back the paid order: **PASS**
- Email failure returns a webhook error so Stripe can retry: **PASS**, although EmailJS cannot provide strict exactly-once delivery across a send/record crash.

### 6. Security — PARTIAL / repository config must be corrected

- Stripe orders cannot be marked paid by normal frontend Firestore code: **PASS**
- No tracked `sk_live_`, `sk_test_`, `whsec_`, `EMAILJS_PRIVATE_KEY`, or `privateKey` values were found: **PASS**
- `.env.local` is ignored, is untracked, and contains no scanned sensitive pattern or `VITE_*` secret-like variable: **PASS**
- Firebase browser config, PayPal client ID, EmailJS service/template IDs, and EmailJS public user ID are public identifiers, not private server secrets.
- Local `firestore.rules` says all documents are publicly readable and all writes are denied: **FAIL if deployed**
- `firebase.json` targets the named `uploadedimages` database, while `getFirestore(app)` and `admin.firestore()` use the `(default)` database: **FAIL / configuration drift**
- Masked/no-data production REST probes received `PERMISSION_DENIED` from both `(default)` and `uploadedimages`, so anonymous order reads are not currently exposed: **CURRENT PRODUCTION PASS**
- That deployed denial also means the Success page's client `onSnapshot` cannot confirm paid status: **LIVE UX FAIL**
- The checkout endpoint is unauthenticated and no-origin callers are explicitly allowed. CORS is not an authorization boundary: **ABUSE/RATE-LIMIT RISK**

### 7. Live readiness — PARTIAL

- Local `main` equals `origin/main` at `72315d38ac7caa8cc25d5d93528f24c9c102fd01`: **PASS**
- The live frontend bundle equals the local production build after normalizing Windows escaped line endings: **PASS**
- The live Stripe endpoint has correct production CORS for `https://www.likwitblvd.com`: **PASS**
- Root URL returns 200 and the bare domain redirects to `www`: **PASS**
- `/shop`, `/success`, and `/cancel` return HTTP 404, then the deployed `404.html` performs a browser-side SPA redirect. This normally works with JavaScript, but the deployment does not return a clean 200 for Stripe return URLs: **PARTIAL**
- `scripts/copy-routes.mjs` omits `success` and `cancel`: **FAIL / safe improvement**
- `npm run build`: **PASS**
- `node --check functions/index.js`: **PASS**
- `npm run lint`: **FAIL (21 errors)**, primarily missing CommonJS globals in ESLint config plus two unused imports; no build/runtime failure resulted.
- Live function logs could not be read because the signed-in Firebase account lacks `serviceusage.services.use` / log-view permissions: **UNVERIFIED**
- A real card payment, Firestore transition, and EmailJS send were not executed during this non-mutating audit: **UNVERIFIED**

## Verification evidence

- `npm run build`: passed; only bundle-size and stale Browserslist-data warnings.
- `node --check functions/index.js`: passed.
- Product catalog validation: 15 products, 60 unique size/Price mappings, zero structural issues.
- Secret scan of tracked files: no private Stripe/webhook/EmailJS private-key patterns.
- Live checkout OPTIONS: 204 with the expected `Access-Control-Allow-Origin`.
- Live checkout empty POST: 400 `Missing lineItems array.` and no order creation.
- Live webhook unsigned POST: 400 `Missing Stripe signature.`
- Live frontend/local build normalized comparison: equal.
- Firebase log request: blocked by IAM; no production logs reviewed.

## Recommended plan

### Phase 1 — block unsafe sales paths

1. Decide whether Stripe is currently test or live and verify the 60 Price IDs belong to that same account/mode.
2. Temporarily hide/disable PayPal until it has a server-verified order path.
3. Add shipping address collection for physical goods.
4. Make the server accept product ID/size/quantity only, validate them against a server-owned catalog, and derive Stripe line items and totals.
5. Validate quantity bounds, cart size, active products, URL origins, and payment mode before creating the pending order.

### Phase 2 — make confirmation reliable

1. Gate fulfillment/email on `payment_status === "paid"`.
2. Handle async payment success/failure or explicitly restrict Checkout to immediate methods.
3. Record Stripe `amount_total` and `currency` from the signed webhook as the authoritative paid total.
4. Add an event ledger or transaction guard so repeated events do not rewrite paid timestamps or regress state.
5. Keep the email claim guard, add event/order correlation logs, and verify the EmailJS template CC in its dashboard.

### Phase 3 — align Firestore and return UX

1. Explicitly target the same Firestore database in app code, Admin code, rules config, and deploy commands.
2. Do not deploy the current global `allow read: if true` rule. Give the Success page only the minimum order-status access required, without exposing buyer/payment fields or list access.
3. Add `success` and `cancel` to generated static routes (or configure the actual host with an SPA rewrite) so Stripe returns receive HTTP 200.
4. Add checkout loading/duplicate-click protection.

### Phase 4 — controlled smoke test

Run one controlled order in the confirmed Stripe mode:

1. Add one product/size to cart.
2. Confirm the displayed total and Stripe Checkout line item match.
3. Complete payment with the appropriate Stripe test card only in test mode.
4. Confirm Firestore moves from pending to paid once.
5. Confirm the recorded Stripe total/currency and buyer/shipping fields.
6. Confirm Success loads, paid state appears, and the cart clears.
7. Confirm customer and CC email flags are set once.
8. Replay the same webhook and confirm no duplicate email/state changes.
9. Cancel a second Checkout and confirm the cart remains and the pending order later expires safely.

## Exact files involved

- `src/Components/ShopGallery.jsx`
- `src/pages/ProductDetailPage.jsx`
- `src/Components/CartContext.jsx`
- `src/Components/CartDrawer.jsx`
- `src/Components/Navbar.jsx`
- `src/pages/Success.jsx`
- `src/pages/Cancel.jsx`
- `src/utils/orderUtils.js`
- `src/data/products.js`
- `src/firebase.js`
- `functions/index.js`
- `firestore.rules`
- `firebase.json`
- `scripts/copy-routes.mjs`
- `public/404.html`
- `index.html`
- `package.json`
- `functions/package.json`

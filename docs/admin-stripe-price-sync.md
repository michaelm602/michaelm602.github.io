# Admin Stripe print-price sync operations

The admin flow has three server-enforced stages:

1. **Preview** reads Firestore and Stripe, records the server-derived plan, and
   performs no Stripe writes or product-document writes.
2. **Confirm canonical Product** records either a verified existing Product or
   the choice to create/recover a new Product named after the artwork. It
   performs no Stripe writes or product-document writes.
3. **Create/reuse Prices** accepts only a confirmed operation. It creates or
   recovers one canonical Product, resolves every standard one-time Price, and
   updates all Firestore Price references in one transaction only after every
   Stripe Price succeeds.

The browser sends only `action`, `productId`, `operationId`, and the confirmed
Product identifier choice. Product titles, amounts, currencies, labels, and
Stripe credentials always come from trusted server state.

The callable function stores preview and execution history in
`adminStripePriceSyncOperations`. These records support safe retries and audit
which admin requested each Stripe change. Browser access remains denied by the
Firestore rules catch-all; only trusted Admin SDK code reads or writes them.

## Retention plan

Keep completed, conflicted, stale, and partially failed operation records for
90 days so delayed retries and release investigations retain enough context.
Before enabling automatic cleanup, add an `expiresAt` Firestore timestamp when
an operation reaches a terminal state, then configure a Firestore TTL policy on
the collection group using that field. Do not expire `running` operations or
the canonical mappings in `adminStripePrintProductMappings`.

TTL configuration is an explicit infrastructure release step. It is not part
of this local implementation and no live Firebase configuration was changed.

## Canonical Stripe Product mapping

`adminStripePrintProductMappings/{productId}` stores the one Stripe Product ID
owned by a Firestore product. A short transactionally acquired creation claim
prevents two operations from creating Products concurrently. The function also
searches Stripe metadata before creation so a Product created before a failed
mapping write can be recovered. Mapping records are durable and must not use
the operation-record TTL policy.

## Canonical Product image

During the Create stage, the function resolves the saved Firestore primary
image through Firebase Admin Storage. For public `airbrush/` and `photoshop/`
objects, it builds the Firebase media URL and sets the canonical Stripe
Product's `images` field to that one URL. This applies to newly created,
selected, mapped, and recovered canonical Products. Matching image state is
left unchanged, and the update uses a stable idempotency key.

A missing primary image, missing Storage object, Storage lookup failure, or
Stripe image update failure does not block Product/Price recovery or the atomic
Firestore Price reference update. The callable returns a warning that the admin
UI displays so the image path can be corrected and the sync retried. Preview
and Confirm still perform no Stripe or product-document writes.

## Manual cleanup for multiple Stripe Products

Use one Stripe Product per artwork, with one one-time Price per print size. If a
preview reports that saved Price IDs belong to different Stripe Products, stop
before creation. Keep Prints available off while resolving the conflict. The recommended confirmation
choice creates or recovers a new canonical Stripe Product named after the
artwork. An admin may explicitly choose one of the verified existing Products,
but the UI does not select a mistaken size-specific Product by default.

After explicit confirmation, Create makes one active one-time USD Price per
standard print size under the chosen Product. When every Price is ready, the
function replaces only the Firestore `stripePriceId` references atomically. Old
Stripe Products and Prices stay unchanged: the function does not move, delete,
update, or automatically deactivate them. A partial Stripe failure leaves the
product document unchanged, and a retry recovers Prices through deterministic
lookup keys and Stripe idempotency keys.

Do not delete or automatically deactivate the old Stripe objects during this workflow.

There is no reset action for products that already contain Stripe Price IDs. A
reset is safe only for a new, unsynced product whose Price ID fields are all
blank; the standard print-set helper already supplies that blank, inactive
starting state.

## Checkout authorization

Price sync does not authorize checkout. functions/stripeCatalog.js remains authoritative
for the server-side checkout catalog, and the customer request remains
`{ productId, size, quantity }`. After a successful sync, the admin UI says:
"Stripe prices are synced, but print checkout still requires the trusted server
checkout catalog to support this product." PayPal and original checkout remain
disabled.

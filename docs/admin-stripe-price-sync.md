# Admin Stripe print-price sync operations

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

## Manual cleanup for multiple Stripe Products

Use one Stripe Product per artwork, with one one-time Price per print size. If a
preview reports that saved Price IDs belong to different Stripe Products, do
not run Create missing Stripe prices. Keep Prints available off while resolving
the conflict.

1. In Stripe, choose the single Product that should represent the artwork.
2. Under that Product, create or identify one active one-time USD Price for each
   supported print size at the canonical amount.
3. In Admin Products, replace each saved Stripe Price ID with the matching Price
   from that one Product, then save the product.
4. Run Preview Stripe sync again. Continue only when every Price resolves to the
   same Product and the preview reports no conflicts.
5. Keep the unused Stripe Products and Prices unchanged until checkout and order
   history have been reviewed. Do not delete or automatically deactivate them.

There is no reset action for products that already contain Stripe Price IDs. A
reset is safe only for a new, unsynced product whose Price ID fields are all
blank; the standard print-set helper already supplies that blank, inactive
starting state.

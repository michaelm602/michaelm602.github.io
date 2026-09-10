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

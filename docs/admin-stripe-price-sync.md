# Admin print-price editing V2

`adminStripePrintPriceSync` owns commercial print publication. The browser can
propose labels, stable option IDs, whole-cent USD amounts, active/order state,
print availability, and the default option. It cannot propose Stripe Product
IDs, Stripe Price IDs, livemode, resolved terms, or canonical mappings.

## Admin workflow

1. Edit print fields locally in Admin Products.
2. **Preview print changes** validates the complete proposal, reads the current
   Firestore product and canonical mapping, verifies Stripe, and stores a
   private operation. Preview never mutates Stripe or the product document.
3. Review the per-option classifications:
   `REUSE_EXISTING_PRICE`, `ATTACH_EXISTING_PRICE`, `CREATE_NEW_PRICE`,
   `DISABLE`, `REMOVE`, `NO_CHANGE`, or `CONFLICT_BLOCKED`.
4. **Apply print changes** resolves every required immutable Stripe Price,
   verifies it again, then publishes the entire `prints` map and completes the
   operation in one Firestore transaction.
5. Admin Products reloads the exact published Firestore state.

Ordinary **Save product** writes non-print fields only. If the print draft is
dirty, the currently published `prints` map is preserved and the local print
draft remains unapplied. Published option IDs are immutable in the routine UI;
changing identity is modeled as removing the old option and adding a new one.
Stripe Price IDs are server-owned and appear only as read-only diagnostics.

## Immutable Stripe identity

The server canonicalizes this exact commercial tuple and SHA-256 hashes its
JSON representation:

```json
{
  "schemaVersion": 2,
  "livemode": true,
  "productId": "firestore-product-id",
  "optionId": "stable-option-id",
  "amountCents": 12500,
  "currency": "usd",
  "stripeProductId": "prod_..."
}
```

The label is intentionally excluded. The full hash is used in the Stripe Price
creation idempotency key; its first 24 hexadecimal characters are used in the
versioned lookup key. Amount, currency, Product, option, product, or livemode
changes therefore produce a different identity, while a label-only edit does
not.

Resolution order is:

1. Reuse the currently published Price when it exactly matches.
2. Search the canonical Product for active exact matches.
3. Attach exactly one match.
4. Block multiple matches or an inactive exact match.
5. Otherwise create a new active, one-time USD Price with the deterministic
   lookup and idempotency identities.
6. Retrieve and verify the resolved Price again before publication.

Old Prices are never edited, deleted, or deactivated. Reverting an amount can
reattach a prior active exact match, preserving historical orders and Checkout
Sessions.

Apply also preserves the existing best-effort canonical Stripe Product image
sync from the saved primary Firebase Storage image. Image lookup/update failure
returns a warning but never weakens Price verification or partially publishes
the Firestore print tuple.

## Canonical Product mapping and retries

`adminStripePrintProductMappings/{productId}` stores `schemaVersion`,
`productId`, `stripeProductId`, `livemode`, and timestamps. Existing mappings
are verified and upgraded lazily. A new mapping uses a short transactionally
owned claim, Stripe metadata recovery, and a deterministic Product-creation
idempotency key. V2 operations live privately in
`adminStripePriceSyncOperations` and expire after 30 minutes.

An interrupted `applying` operation may resume. Product and Price creation use
stable idempotency identities, and a concurrent completion returns the stored
completed response rather than rewriting or downgrading it. Obsolete V1
operations fail with a safe "Preview again" response.

## Atomic publication and stale-state protection

Stripe calls occur outside Firestore transactions. After all Prices resolve,
one transaction rereads the product, canonical mapping, and private operation;
checks ownership, status, expiry, complete fingerprints, livemode, and Price
coverage; writes the entire server-constructed `prints` map; updates
`updatedAt`; and marks the operation completed. Any product, option, order,
default, active, amount, currency, current Price ID, or mapping change blocks
publication. Stripe objects created before a stale-state failure remain
unattached and recoverable on the next preview.

## Browser write boundary

The prepared Firestore rule prevents browser clients, including claimed admin
clients, from changing a published `prints` map. Browser-created products must
start with `{ available: false, defaultOptionId: null, options: [] }`.
Unrelated Admin product fields remain writable when `prints` is unchanged.
The Admin Function publishes verified print tuples through Admin SDK.

This rule must not be deployed before the compatible Function and frontend.
Release order is:

1. deploy only `functions:adminStripePrintPriceSync`;
2. deploy the updated frontend;
3. deploy the reviewed Firestore rules.

## Checkout and storefront compatibility

Firestore remains the storefront and checkout authority. Price sync does not
change the customer request shape, which remains exactly
`{ productId, size, quantity }`. A newly synced option becomes purchasable only
under the existing product/channel/print availability checks. PayPal remains
disabled and originals remain contact-only with online checkout disabled.

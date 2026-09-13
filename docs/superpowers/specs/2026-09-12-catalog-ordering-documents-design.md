# Catalog Ordering Documents Design

## Goal

Separate Shop and Portfolio display ordering without adding fields to `shopProducts` or changing checkout data.

## Data model

Firestore contains two public display-metadata documents:

- `catalogOrdering/shop`: `{ productIds: string[] }`
- `catalogOrdering/portfolio`: `{ productIds: string[] }`

The array order is authoritative for currently visible managed products. Unknown, duplicate, malformed, inactive, archived, or wrong-channel IDs do not make a product visible and are ignored by the public ordering utility.

## Runtime behavior

Shop and Portfolio load their existing constrained `shopProducts` query and their own ordering document. A missing or unreadable ordering document becomes an empty array, retaining the existing order.

For Shop, listed visible products appear in array order. Missing visible products append by the existing `sortOrder` then product-ID fallback. Featured does not change Shop ordering.

For Portfolio, listed managed artwork appears in array order and Featured does not override it. Missing managed artwork appends with the current preservation comparator: Featured, `sortOrder`, `updatedAt`/`createdAt` newest first, then product ID/path. Unmanaged Storage-only media remains after managed media and retains `timeCreated` newest-first plus normalized-path fallback.

## Admin

Admin Products gains a compact ordering panel with separate Shop and Portfolio lists. Move-up and move-down controls reorder complete product ID arrays and save only the selected `catalogOrdering` document. This array-based boundary can later be driven by drag-and-drop without a schema change. The existing product `sortOrder` remains a legacy fallback and is relabeled accordingly; image and print-option ordering remain independent.

## Migration

A dedicated script reads `shopProducts` and the two ordering documents. It computes Shop from the existing visible Shop comparator and Portfolio from the existing effective managed Portfolio comparator. It writes a timestamped local report before any optional write. Dry-run is the default. `--write` creates only missing ordering documents, never updates existing ordering documents, and never writes `shopProducts`, Storage, or Stripe.

## Security

Existing `shopProducts` rules remain byte-for-byte unchanged. `catalogOrdering/{channel}` allows public reads only for `shop` and `portfolio`, allows validated create/update only to custom-claim admins, denies deletion, requires exactly `productIds`, requires a list, and caps it at 100 entries. Public consumers additionally accept only unique, non-empty string IDs of bounded length.

## Rollout safety

Rules and compatibility frontend can deploy before documents exist. Missing documents preserve existing ordering. Initial dry-run is reviewed before explicit write approval. Stale IDs are harmless because visibility filtering happens before ordering.

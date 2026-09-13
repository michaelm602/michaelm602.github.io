# Independent Shop and Portfolio ordering

## Firestore model

Display order lives outside product documents:

```text
catalogOrdering/shop       { productIds: ["product-a", "product-b"] }
catalogOrdering/portfolio  { productIds: ["product-b", "product-a"] }
```

Each document contains exactly one `productIds` list, capped at 100 entries by Firestore Rules. Public clients may read only these two fixed documents. Only users with the existing `admin == true` custom claim may create or replace them; deletion is denied.

Product visibility is still decided exclusively by the constrained `shopProducts` query. An ordering entry cannot publish an inactive, archived, or wrong-channel product. Stale IDs are ignored. Duplicate, blank, non-string, and excessively long IDs are removed by the client reader.

## Runtime behavior

Shop applies `catalogOrdering/shop` after Shop visibility filtering. Listed products appear first in exact array order. Missing products append using the existing `sortOrder`, then product-ID order. Featured does not influence Shop.

Portfolio applies `catalogOrdering/portfolio` after Portfolio visibility filtering and Storage-path matching. Listed managed artwork appears first in exact array order, regardless of Featured. Missing managed artwork appends using the preservation comparator: Featured, `sortOrder`, newest `updatedAt`/`createdAt`, then product ID/path. Unmanaged Storage-only artwork remains after managed artwork and uses Storage `timeCreated` newest-first, then normalized path.

A missing or unreadable ordering document behaves as an empty list, preserving the legacy channel order. This permits rules and frontend deployment before the documents are created.

## Admin workflow

Admin Products includes a separate Channel ordering panel. Shop and Portfolio each have independent Up/Down controls and Save order buttons. Saving one channel writes only its `catalogOrdering` document. The product-level `sortOrder` remains available as Legacy fallback order. Image order continues to affect only media within one product.

The stored array is deliberately compatible with future drag-and-drop controls: drag-and-drop would only reorder the same `productIds` value.

## Preservation backfill

Preview with:

```powershell
npm run catalog-ordering:backfill -- --project airbrushnink-9f735
```

The command reads existing `shopProducts` and checks the two target documents. It is dry-run-only unless `--write` is explicitly supplied. Every run writes a timestamped local backup/report under `backups/` before any possible Firestore change and prints the exact documents it would create.

Shop IDs are derived from the current visible Shop order (`sortOrder`, product ID). Portfolio IDs are derived from the current effective visible managed-artwork order (Featured, `sortOrder`, newest timestamp, product ID). Inactive, archived, and no-channel records are reported but omitted from public order arrays.

With `--write`, the script uses create-only operations for missing documents. It never overwrites an existing ordering document, never writes `shopProducts`, and never deletes anything. A rerun therefore makes no changes after successful creation. Live write mode requires separate approval.

## Security review notes

- An unauthenticated visitor can read only the two non-sensitive display arrays; the catch-all rule denies other catalog-ordering IDs.
- A public or authenticated non-admin client cannot create or update an ordering document.
- An admin cannot add fields, change the list into another type, exceed 100 entries, or delete an ordering document.
- Ordering IDs are display references only. They cannot override product visibility or authorize checkout.
- Per-entry string validation stays in the client boundary to avoid an expensive Firestore Rules expression path. Invalid entries are ignored, while the document shape and size fail closed in Rules.
- The existing `shopProducts`, orders, inventory, checkout, and Storage rule paths are unchanged.

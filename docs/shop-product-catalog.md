# Shop product catalog foundation

Phase 2A defined the `shopProducts` collection. Phase 2C adds an optional whole-catalog Firestore display adapter while trusted Stripe checkout continues to read `functions/stripeCatalog.js`.

## Document schema

Each document ID equals its `id` field and contains:

- Identity and copy: `id`, `slug`, `title`, `shortDescription`, `longDescription`, `category`, and `tags`.
- Images: ordered `images` entries with `id`, `storagePath`, `thumbnailPath`, `alt`, and `sortOrder`, plus `primaryImageId`.
- Original: `status` (`available`, `sold`, or `not_for_sale`), optional `size` and `medium`, `price.amountCents`, `price.currency`, `checkoutEnabled`, and one-of-one `quantity`.
- Prints: `available`, `defaultOptionId`, and ordered options containing `id`, `label`, `amountCents`, `currency`, `stripePriceId`, `active`, and `sortOrder`.
- Publishing: `channels.shop`, `channels.portfolio`, `active`, `featured`, `sortOrder`, and `archivedAt`.
- Relationships and search copy: `relatedProductIds`, `seo.title`, and `seo.description`.
- Audit timestamps: `createdAt` and `updatedAt`.

The shape supports print-only work, an available original with contact-only purchasing, a sold original with prints, an original that is not for sale, portfolio-only work, inactive work, and archived work. Original checkout defaults to `false`; Phase 2A does not enable original online sales.

## Local parity migration

Run:

```powershell
npm run catalog:dry-run
```

This command reads the current source catalog, maps and validates every document, and reports product, slug, print-option, Stripe Price ID, and image-path counts. It also reports duplicate IDs/slugs/Stripe IDs, missing Stripe IDs, invalid prices, missing image paths, and field parity errors. It does not write a file or contact Firebase.

To create a reviewable local JSON artifact, explicitly add `--write`:

```powershell
npm run catalog:dry-run -- --write --output artifacts/shop-products-migration.json
```

This only writes a local JSON file. It never writes Firebase data.

## Firestore import

Read-only planning requires an explicit Firebase project ID:

```powershell
npm run catalog:import -- --project-id your-project-id
```

The import CLI uses Application Default Credentials and explicitly targets the `(default)` database. It reads the existing `shopProducts` collection and prints every document it would create or update, the changed field paths, unchanged source documents, and existing documents that will be left untouched.

Actual upserts additionally require `--write`:

```powershell
npm run catalog:import -- --project-id your-project-id --write
```

Before an actual batch write, the CLI saves the existing collection to a timestamped JSON file under `backups/`. It uses merge upserts keyed by product ID, preserves an existing `createdAt`, adds `createdAt` for new documents, updates `updatedAt`, and never deletes documents.

## Server catalog mode

`functions/shopProductRepository.js` supports a whole-catalog `PRODUCT_CATALOG_MODE` of `source` or `firestore`. Missing configuration defaults to `source`. Firestore mode validates the entire fetched collection and does not fill missing products from the source catalog. The live checkout function does not use this repository in Phase 2A.

## Storefront display mode

Set `VITE_STOREFRONT_CATALOG_MODE` to `source` or `firestore`. Development defaults to `source`; production defaults to `firestore`. Each shop page loads one complete catalog and never fills failed or missing Firestore products from the source catalog. A Firestore load failure is shown to the customer with a retry action. Set production to `source` for an explicit rollback.

The Firestore storefront query requires `active == true`, `archivedAt == null`, and `channels.shop == true`. Public Firestore reads are limited to active, unarchived shop products. Portfolio-only documents, including any tattoo category, remain inaccessible to public Firestore clients until a separately reviewed portfolio adapter and visibility rule are introduced. Public writes and deletes remain denied.

Both display adapters remove Stripe Price IDs from their browser-facing product models. A Firestore print option becomes addable only when its label, price, currency, and Stripe Price ID exactly match the retained source product catalog. The checkout request still sends only `productId`, `size`, and `quantity`; `functions/stripeCatalog.js` remains the trusted checkout catalog.

Deploy the reviewed Firestore rules before releasing a production frontend that defaults to Firestore. Original artwork stays contact-to-purchase and PayPal stays disabled.

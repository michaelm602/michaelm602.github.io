# Admin product create denial

The new-product defaults were already safe: prints unavailable, no print options,
and original checkout disabled. The client also already rejected active print
options without Stripe Price IDs. The reproduced denial was a rule evaluation
failure, not an invalid field or an admin-claim failure.

With the original rules, an authenticated admin's normalized original-only create
failed with `permission-denied` and this emulator diagnostic:

> Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached.

Existing saves use `updateDoc` and validate changed sections. New products use
`setDoc` and validate the entire document, which exceeded the rule evaluation
budget even with an empty print-option list.

The create serializer now places the selected active default print option first
while preserving every option's explicit `sortOrder`. The create rule can verify
that default in constant time. The rule validators use bounded staged list checks,
compact boolean aggregation, and exact fast paths for safe blank defaults. This
keeps products with up to eight valid print options inside the rules-engine budget.

## Captured reproduction payload

The emulator test uses `createBlankAdminProduct`, the production normalizer, and
the same `serverTimestamp()` transforms as the save service. Its diagnostics
print each complete normalized payload. Below, `SERVER_TIMESTAMP` represents
the SDK transform, not a string written to Firestore.

```json
{
  "id": "new-product-0",
  "slug": "new-product-0",
  "title": "New original",
  "shortDescription": "",
  "longDescription": "",
  "category": "Airbrush",
  "tags": [],
  "images": [{
    "id": "image-1",
    "storagePath": "airbrush/New.webp",
    "thumbnailPath": null,
    "alt": "New original",
    "sortOrder": 0
  }],
  "primaryImageId": "image-1",
  "original": {
    "status": "available",
    "size": null,
    "medium": null,
    "price": { "amountCents": null, "currency": "usd" },
    "checkoutEnabled": false,
    "quantity": 1
  },
  "prints": { "available": false, "defaultOptionId": null, "options": [] },
  "channels": { "shop": true, "portfolio": false },
  "active": true,
  "featured": false,
  "sortOrder": 0,
  "relatedProductIds": [],
  "seo": { "title": "", "description": "" },
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP",
  "archivedAt": null
}
```

## Client feedback and checkout

Validation errors now appear directly in the save error area. Missing Stripe IDs
identify the option and explain how to deactivate it. The editor explains the
original-only workflow. Explicit rule-evaluation-limit errors are distinguished
from unspecified Firestore denials; the UI does not invent a failing field when
Firestore supplies none.

Print options entered in Firestore do not authorize payments. Checkout continues
to resolve products and prices through `functions/stripeCatalog.js`. Original
checkout and PayPal remain disabled. No live products were written during this
investigation.

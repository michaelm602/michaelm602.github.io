# Product Detail Page — Design Spec
**Date:** 2026-03-22
**Route:** `/shop/:slug`
**Component:** `ProductDetailPage`

---

## Overview

A dedicated product detail page template for all artwork prints sold on likwitblvd.com. The page is the primary purchase path for individual products — optimized for dark premium aesthetics, high-quality artwork presentation, and a clear conversion flow.

The first instance uses "Alter Ego" (`/shop/alter-ego`). Every future product page uses the same component and data shape.

---

## Routes

- Add `/shop/:slug` to `src/App.jsx` pointing to `ProductDetailPage`
- The route must be placed **before** the catch-all `<Route path="*" ...>` entry
- `useParams()` reads `slug`
- Lookup product from `src/data/products.js` by matching `slug` field
- If not found: render a minimal styled 404 fallback inline (dark, on-brand) — not a redirect
- Existing `/shop` route (ShopGallery) is untouched

---

## Data Layer

### New file: `src/data/products.js`

Single source of truth for all product metadata. Each entry:

```js
{
  title: "Alter Ego",          // must exactly match key in stripeLinks.js
  slug: "alter-ego",           // kebab-case, used in URL
  category: "Airbrush · Original Print",
  description: "Two versions of the same person, neither one wrong — just one you show and one you carry.",
  tagline: "A piece people stop and stare at. Then ask about.",
  firebasePath: "airbrush/Alter Ego.webp",
  sizes: ["16x20", "18x24", "24x36", "30x40"],  // display hint only; pricing from sizePriceMap
}
```

All 14 existing products from `stripeLinks.js` are represented. The `title` field must exactly match the key in `stripeLinks` so checkout works without changes.

The "From $X" price label is derived dynamically: `Math.min(...Object.values(sizePriceMap))` — not hardcoded. This keeps it consistent with `sizePriceMap` without per-product overrides.

`sizePriceMap` and `stripeLinks` are not modified.

---

## Component: `ProductDetailPage`

**File:** `src/pages/ProductDetailPage.jsx`

### Firebase Import

Use the named export from the existing Firebase config for **all** Firebase Storage calls in this component — both the main image fetch and the related products `listAll`:

```js
import { storage } from "../firebase";
import { ref, getDownloadURL, listAll } from "firebase/storage";
```

Do not call `getStorage()` directly. ShopGallery uses `getStorage()` — this component uses the named `storage` export. Both work; this component standardizes on the cleaner pattern.

### Layout

Split panel — full viewport height minus navbar:

- **Left (flex 6):** Image panel — dark `#090909`, `border-right: 1px solid #141414`
- **Right (flex 4):** Purchase stack — dark `#0a0a0a`, scrollable if overflow

Panel height: `calc(85vh - 4rem)` (accounts for ~64px navbar), `min-height: 360px`, `max-height: 700px`

### Image Panel

- Single `getDownloadURL(ref(storage, product.firebasePath))` fetch on `useEffect` on mount
- Loading state: image container reserves space (aspect-ratio placeholder) — no layout shift
- Error state: if fetch fails, show a dark placeholder box with centered text "Image unavailable" (`color: #333`)
- `<img>` with `height: 100%`, `max-height: 100%`, `aspect-ratio: 4/5`, `object-fit: contain`
- Centered within panel via flexbox
- Radial gradient ambient glow behind artwork (rgba warm gray, ~9% opacity)
- "⊕ Click to zoom" hint at bottom-right of image area (very low opacity, `#2c2c2c`)

### Purchase Stack (right panel, top to bottom)

1. **Category label** — `Airbrush · Original Print` — `text-zinc-700`, 7px, spaced caps
2. **Title** — 22px, bold, `text-[#f0f0f0]`
3. **Description** — 11px, `text-zinc-600`, line-height 1.8
4. **Tagline** — 10px, italic, `text-zinc-700` — separated by `border-bottom: 1px solid #161616`
5. **Price** — "From" label + minimum size price at 18px bold (derived from `sizePriceMap`); scarcity line below: "Limited run — once it's gone, it's gone." (`text-zinc-500`, 9px, no bold)
6. **Size selector** — dropdown, `sizePriceMap` keys; shows "Select size" default
7. **Quantity selector** — dropdown, options `1` through `5`, default `1`
8. **CTA button** — "Own This Piece" — `linear-gradient(to right, #151515, #2c2c2c)`, `border: 1px solid #3c3c3c`, bold, spaced caps; calls `addToCart()` then dispatches cart-open event (see Cart Integration)
9. **Trust strip** — single inline row, `border-top: 1px solid #161616`:
   > Hand-finished, made to order · Stripe & PayPal · Ships in 7–10 days
   - `color: #4a4a4a`, 9px, dot separators `color: #2a2a2a`

### Cart Integration

- `addToCart({ title, size, quantity, price, image })` from `CartContext` — no changes to cart or checkout
- `size` must be selected before add; if not: show inline message "Please select a size" in `text-zinc-500` below the size selector
- `price` = `sizePriceMap[selectedSize]`
- `image` = the fetched Firebase URL
- After calling `addToCart`, dispatch the cart-open event — consistent with ShopGallery behavior:
  ```js
  window.dispatchEvent(new Event("open-cart"));
  ```
  Do **not** call `setIsCartOpen` from `CartContext` — the `open-cart` event is the established mechanism and is sufficient.

---

## Related Products Section

**Below the split panel.** Background `#070707`, `border-top: 1px solid #111`.

### Data

- Load from Firebase Storage (`listAll` on `airbrush/` prefix) — same pattern as ShopGallery
- After fetching, strip `.webp` from each filename to get the title string (e.g. `"Alter Ego.webp"` → `"Alter Ego"`)
- Look up each title in `products.js` using `products.find(p => p.title === derivedTitle)`
- **Skip any file with no matching entry** — silently ignore unmatched filenames (legacy files, thumbs, etc.)
- Exclude the current product (match by `product.title`)
- Show first 3 valid matches
- Each card: image (lazy loaded), title, "From $X" (derived from `sizePriceMap`), "View Piece →"
- Card link: `/shop/${matchedProduct.slug}` (from `products.js`, not derived from filename)

### Interaction

- Full card is clickable (`<Link>` to product page)
- Hover: card lifts slightly (`translateY(-2px)`), image scales `scale(1.02)`, smooth `transition: 0.25s ease`
- Images: `loading="lazy"`

---

## Commission CTA Section

**Below related products.** Background `#0b0b0b`, `border-top: 1px solid #111`, centered.

- Eyebrow: "Commission Original Work" — spaced caps, `text-zinc-700`
- Heading: "Tell me what you carry." — 17px bold, `#d8d8d8`
- Body: "Every custom piece starts with a conversation. Bring the concept — I'll bring it to life."
- Button: "Start a Commission" — `border: 1px solid #333`, ghost style, links to `/contact`

---

## 404 Fallback

Rendered when `slug` has no match in `products.js`. Rendered inline in `ProductDetailPage` (not a separate route):

- Dark full-height centered layout
- "This piece isn't here." in `text-zinc-500`
- "Browse the collection →" as a `<Link>` to `/shop`
- No redirect, no crash
- Note: `/shop/` (trailing slash, no slug segment) does not match `/shop/:slug` and falls through to the App.jsx catch-all redirect to `/`. This is acceptable — there is no `/shop/` index page needed.

---

## Performance

- Image container holds aspect-ratio space before image loads (no layout shift)
- Related product images: `loading="lazy"`
- No new dependencies

---

## Files Changed / Created

| File | Action |
|------|--------|
| `src/data/products.js` | Create — product registry (14 products) |
| `src/pages/ProductDetailPage.jsx` | Create — page template |
| `src/App.jsx` | Edit — add `/shop/:slug` route before catch-all |
| `src/utils/sizePricing.js` | No change |
| `src/utils/stripeLinks.js` | No change |
| `src/Components/CartContext.jsx` | No change |
| `src/Components/ShopGallery.jsx` | No change |

---

## Out of Scope

- Image zoom modal (noted in mockup as "⊕ Click to zoom" — UI only for now, no interaction)
- Dynamic related products ordering (show first 3 non-current)
- Per-product pricing overrides (all products use the same `sizePriceMap`)
- SEO meta tags / OG image

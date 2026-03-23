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
- `useParams()` reads `slug`
- Lookup product from `src/data/products.js` by matching `slug` field
- If not found: render a minimal styled 404 fallback (dark, on-brand)
- Existing `/shop` route (ShopGallery) is untouched

---

## Data Layer

### New file: `src/data/products.js`

Single source of truth for all product metadata. Each entry:

```js
{
  title: "Alter Ego",
  slug: "alter-ego",
  category: "Airbrush · Original Print",
  description: "Two versions of the same person, neither one wrong — just one you show and one you carry.",
  tagline: "A piece people stop and stare at. Then ask about.",
  firebasePath: "airbrush/Alter Ego.webp",
  priceLabel: "From $100",
  sizes: ["16x20", "18x24", "24x36", "30x40"],  // display hint only; pricing from sizePriceMap
}
```

All 14 existing products from `stripeLinks.js` are represented. The `title` field must exactly match the key in `stripeLinks` so checkout works without changes.

`sizePriceMap` and `stripeLinks` are not modified.

---

## Component: `ProductDetailPage`

**File:** `src/pages/ProductDetailPage.jsx`

### Layout

Split panel — full viewport height minus navbar:

- **Left (flex 6):** Image panel — dark `#090909`, `border-right: 1px solid #141414`
- **Right (flex 4):** Purchase stack — dark `#0a0a0a`, scrollable if overflow

Panel height: `calc(85vh - 4rem)` (accounts for ~64px navbar), `min-height: 360px`, `max-height: 700px`

### Image Panel

- Single `getDownloadURL(ref(storage, product.firebasePath))` fetch on mount
- `<img>` with `height: 100%`, `max-height: 100%`, `aspect-ratio: 4/5`, `object-fit: contain`
- Centered within panel via flexbox
- Radial gradient ambient glow behind artwork (rgba warm gray, ~9% opacity)
- "⊕ Click to zoom" hint at bottom-right of image area (very low opacity, `#2c2c2c`)
- No layout shift: image container reserves aspect-ratio space while loading

### Purchase Stack (right panel, top to bottom)

1. **Category label** — `Airbrush · Original Print` — `text-zinc-700`, 7px, spaced caps
2. **Title** — 22px, bold, `text-[#f0f0f0]`
3. **Description** — 11px, `text-zinc-600`, line-height 1.8
4. **Tagline** — 10px, italic, `text-zinc-700` — separated by `border-bottom: 1px solid #161616`
5. **Price** — "From" label + `$100` at 18px bold; scarcity line below: "Limited run — once it's gone, it's gone." (`text-zinc-500`, 9px, no bold)
6. **Size selector** — dropdown, `sizePriceMap` keys; shows "Select size" default
7. **Quantity selector** — dropdown, default `1`
8. **CTA button** — "Own This Piece" — `linear-gradient(to right, #151515, #2c2c2c)`, `border: 1px solid #3c3c3c`, bold, spaced caps; calls `addToCart()` from `CartContext`
9. **Trust strip** — single inline row, `border-top: 1px solid #161616`:
   > Hand-finished, made to order · Stripe & PayPal · Ships in 7–10 days
   - `color: #4a4a4a`, 9px, dot separators `color: #2a2a2a`

### Cart Integration

- `addToCart({ title, size, quantity, price, image })` from `CartContext` — no changes to cart or checkout
- `size` must be selected before add; validation: if no size selected, show inline error or disabled state
- `price` = `sizePriceMap[selectedSize]`
- `image` = the fetched Firebase URL

---

## Related Products Section

**Below the split panel.** Background `#070707`, `border-top: 1px solid #111`.

### Data

- Load from Firebase Storage (`listAll` on `airbrush/` prefix) — same pattern as ShopGallery
- Exclude the current product by title match
- Show 3 products (random or first-3 that aren't current)
- Each card: image, title, "From $100", "View Piece →" link to `/shop/${slug}`

### Interaction

- Full card is clickable (`<Link>` to product page)
- Hover: card lifts slightly (`translateY(-2px)`), image scales `scale(1.02)`, smooth `transition: 0.25s ease`
- Images: lazy loaded (`loading="lazy"`)

---

## Commission CTA Section

**Below related products.** Background `#0b0b0b`, `border-top: 1px solid #111`, centered.

- Eyebrow: "Commission Original Work" — spaced caps, `text-zinc-700`
- Heading: "Tell me what you carry." — 17px bold, `#d8d8d8`
- Body: "Every custom piece starts with a conversation. Bring the concept — I'll bring it to life."
- Button: "Start a Commission" — `border: 1px solid #333`, ghost style, links to `/contact`

---

## 404 Fallback

Rendered when `slug` has no match in `products.js`:

- Dark page, centered
- Text: "This piece isn't here." + "Browse the collection →" link to `/shop`
- No redirect, no crash

---

## Performance

- Image container holds aspect-ratio space before image loads (no layout shift)
- Related product images: `loading="lazy"`
- No new dependencies

---

## Files Changed / Created

| File | Action |
|------|--------|
| `src/data/products.js` | Create — product registry |
| `src/pages/ProductDetailPage.jsx` | Create — page template |
| `src/App.jsx` | Edit — add `/shop/:slug` route |
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

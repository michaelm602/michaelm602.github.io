# Likwit Blvd Ecommerce Audit - 2026-05-01

## Main Answer

The homepage hero appears late because the first render has no hero image URLs. `src/content/homeContent.js` defines `heroImages: []`, and `src/pages/Home.jsx` only renders `<Hero />` after Firestore returns `siteContent/home`. Only then does the browser discover and download the Firebase Storage image URLs.

The live hero image files are already small WebP assets, so the primary issue is discovery timing, not image weight. The first live hero is about 90 KB and the second is about 7 KB. Firebase Storage is also returning `Cache-Control: private, max-age=0` for those token URLs, so repeat visits do not get strong cache reuse.

## Critical Issues

- `src/pages/Home.jsx` + `src/content/homeContent.js`: The hero depends entirely on Firestore for first paint. Slow Firestore or network latency creates a blank/late hero.
- `src/Components/Hero.jsx`: Every slide was marked `loading="eager"`, so non-visible slides could compete with the first visible image.
- Firebase Storage hero URLs: Current live headers show `Cache-Control: private, max-age=0`, which is poor for repeat performance.
- `src/Components/CartDrawer.jsx`: PayPal SDK loading is triggered when the drawer component mounts, even before the buyer opens the cart. This adds third-party checkout script cost to normal page browsing.
- `src/utils/orderUtils.js` + `firestore.rules`: PayPal orders are written from the client, but checked-in Firestore rules deny writes. If those rules are deployed as written, PayPal order saving will fail after payment.

## High-Impact Improvements

- Keep local, optimized hero fallbacks in `public/hero-images/` so the hero renders immediately, then replace with Firestore-managed images after the first remote hero is ready.
- Preload the first local hero in `index.html` and give the first rendered hero image `fetchPriority="high"`.
- Upload home hero images with long-lived cache metadata, or move curated hero images into the deployed static build when they are not expected to change often.
- Defer PayPal SDK loading until the cart opens.
- Code-split admin/product/lightbox/checkout-heavy code. The production JS bundle is about 897 KB minified, which is high for the homepage.
- Replace image-token duplication with centralized content/image utilities if the home editor grows.

## Nice-To-Have Polish

- Homepage flow is clear enough, but "Made to Order. Built to Hit." could be supported by a stronger immediate product cue above the fold, such as "hand-finished airbrush prints" near the CTA.
- Add route-level metadata for `/shop` and collection pages. Product detail metadata exists, but the base SPA metadata is doing most of the generic work.
- Add `twitter:image` and a canonical link in `index.html`.
- Add width/height or aspect-ratio wrappers consistently for product/shop images to reduce any perceived layout shift.
- Review checked-in Firestore and Storage rules against the real deployed rules; they currently conflict with the admin upload/editor behavior.

## Files Involved

- `src/pages/Home.jsx`: Firestore home content loading, hero fallback/preload behavior, service rendering.
- `src/Components/Hero.jsx`: Hero image priority, eager/lazy behavior, visible slide rendering.
- `src/Components/ServiceCard.jsx`: Service image fallback state and image decoding.
- `src/content/homeContent.js`: Empty fallback hero images caused the blank initial hero.
- `index.html`: App metadata and early resource hints.
- `public/hero-images/`: Static optimized first-paint hero assets.
- `src/Components/CartDrawer.jsx`: Checkout drawer, PayPal SDK, Stripe checkout call.
- `src/Components/ShopGallery.jsx`: Product card image loading and add-to-cart flow.
- `src/pages/ProductDetailPage.jsx`: Product page image fetching, metadata, sticky mobile CTA.
- `src/utils/productImageUrls.js`: Firebase Storage product image URL resolution.
- `firestore.rules` / `storage.rules`: Rules should be verified before assuming admin uploads and client PayPal order writes are safe.

## Recommended Implementation Order

1. Fix hero first paint with local static hero fallbacks and first-image priority.
2. Improve Firebase Storage cache metadata for uploaded home hero images.
3. Defer PayPal SDK loading until the cart is opened.
4. Add shop/cart trust microcopy and clearer checkout error detail, without changing Stripe session logic.
5. Code-split large routes and admin-only code.
6. Add SEO/social polish: canonical, Twitter image, route metadata for `/shop`.
7. Audit deployed Firebase rules against admin uploads and PayPal order creation.

## Implemented In This Pass

- Added local critical hero assets in `public/hero-images/`.
- Added first hero preload and Firebase preconnect hints in `index.html`.
- Updated `Home.jsx` so the hero renders immediately with local fallbacks and waits for the first Firestore hero image before swapping content.
- Updated `Hero.jsx` so only the first hero image is eager/high priority; later slides are lazy/low priority.
- Added a defensive empty-image state in `ServiceCard.jsx`.


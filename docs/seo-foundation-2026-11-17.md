# Likwit Blvd SEO foundation — November 17, 2026

## Release status

This change is prepared for review. It has not been merged into the production branch or deployed during this audit. The owner's Codex handoff reports a successful desktop home/shop/image/cart check. Mobile review, rendered metadata-navigation checks, hosting redirects, and production verification remain release work.

Baseline source: `416bbe3081e0a929470a740b0cc7891fb014d178` on `main`.
Canonical public origin: <https://www.likwitblvd.com>.

## What the live audit established

Direct HTTP requests and the public catalog were inspected on November 17. The search retrieval service could not open the site, but direct HTTP worked; that retrieval failure is not evidence of an outage or deindexing. Search Console performance and URL Inspection were unavailable because the connected GSC Wizard subscription had expired. No traffic, ranking, index-coverage, or Core Web Vitals score is asserted.

| Finding | Observed evidence | Response in this change |
| --- | --- | --- |
| Shared initial page HTML | All 22 current sitemap URLs returned the same shell, generic title, and empty React root. No initial canonical or structured data was present. | Build route-specific metadata and visible initial HTML for the seven core pages and the current public artworks. |
| Metadata could persist across navigation | Product detail updated the head, but its cleanup did not restore every description, social, and image field. | A shared metadata manager owns the complete set on both static output and client navigation. |
| Sitemap differed from the public shop | 15 product URLs in the live sitemap versus 16 current public shop products. | Build artwork paths and sitemap from one current public catalog snapshot. |
| Missing artwork URLs | `echoes-of-the-5th-sun` and `the-jaguars-bloodline` were public shop products but absent from the sitemap. | Include both when published by the authoritative public catalog. |
| Stale artwork URL | `out-for-fame` was in the sitemap but absent from the current public shop. | Do not create a product snapshot or sitemap entry for it. No assumption is made about why it was unpublished. |
| Utility pages could be indexed | Login/order result routes initially used the same generic indexable shell. | Add initial `noindex, follow` to eight known utility routes and keep them out of the sitemap. |
| Unknown paths silently became the homepage | The server returned 200 and React redirected the wildcard to `/`. | Add a recognizable not-found view and runtime noindex; provide a static noindex `404.html`. HTTP status remains a hosting concern. |
| Artist and location context was thin | The fixed homepage introduction did not name the artist or Portland. Portfolio main heading used H2. | Add Michael Maldonado and Portland, Oregon to shared public copy; improve short page introductions and use an H1 for the portfolio. |
| Bare-domain deep links failed | `https://likwitblvd.com/shop`, `/portfolio`, and `/contact` returned 404 while www equivalents worked. | Requires host/domain redirect configuration; not fixed by this source change. |

The www host already has working [robots.txt](https://www.likwitblvd.com/robots.txt), [sitemap.xml](https://www.likwitblvd.com/sitemap.xml), HTTPS, an Open Graph image, and public page routes. The robots and sitemap files are not missing sitewide. Their bare-domain counterparts returned 404.

## Implementation

### Shared identity, copy, and metadata

`src/content/pageCopy.js` supplies the visible headings and introductions consumed by React and the static generator. The homepage keeps “Made to Order. Built to Hit.” and “The Work Speaks First.”

`src/utils/seo.js` supplies titles, descriptions, canonical URLs, robots directives, social fields, escaping, and structured data. `RouteSeo` applies them on ordinary navigation. Product detail applies the current public product data after its existing catalog load succeeds. A transient catalog failure is not treated as evidence that a product was removed.

The metadata manager explicitly resets the image, Open Graph type, description, canonical, robots, and JSON-LD when moving between product, public, and utility pages. Resolved product images are tied to their slug so one artwork cannot acquire another artwork’s image in search/social metadata during navigation.

Structured data describes the artist, website, page, and verified artwork identity. It does not invent offers, prices, availability, reviews, ratings, or fulfillment promises.

### Visible initial HTML

The existing React/Vite application remains in place. `scripts/seo-build.mjs` adds a visible, styled initial page inside the application root, served identically to all visitors. React replaces that content when it starts.

Each non-root route is emitted as both a directory index and an identical companion HTML file, for example `dist/shop/index.html` and `dist/shop.html`. This supports Vite preview's distinct resolution of `/shop/` and `/shop`. Public links, canonicals, and sitemap entries continue to use the clean URL `/shop`; the companion files are delivery artifacts, not additional sitemap entries.

This is a static HTML fallback, not full React server rendering or hydration. It provides real headings, shared editorial copy, navigation, current artwork names/descriptions/images, and artwork links before JavaScript runs. Category/gallery fallbacks provide the shared introduction and navigation; they do not pretend to reproduce the entire Storage-backed gallery.

Prices, stock, payment controls, and carts are not baked into the fallback. The existing runtime catalog and checkout remain authoritative. The initial fallback can transition through the app’s existing loading state, so its visual transition must be reviewed on desktop and mobile before release.

### Public catalog and build behavior

Every `npm run build` now performs the SEO generation through the existing postbuild script. It reads the same public Firestore conditions as the storefront:

```text
active == true
archivedAt IS_NULL
channels.shop == true
```

No authenticated account, service account, admin SDK, private collection, or backend write is used. Optional catalog ordering follows the existing runtime fallback behavior. Images are resolved from the configured public Firebase bucket, with same-artwork thumbnail-to-full-image fallback.

The production build uses `VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_STORAGE_BUCKET` from the existing Vite build configuration. The existing explicit `VITE_STOREFRONT_CATALOG_MODE=source` rollback is respected; a failed Firestore request does not silently switch to it.

Missing configuration, failed public catalog requests, an empty catalog, duplicate/unsafe slugs, and image permission/network failures stop the build. Missing image objects can be omitted without inventing replacements. HTML and JSON-LD are escaped, including literal JavaScript replacement tokens in artwork copy.

The build writes `dist/sitemap.xml` from the same successful snapshot as the artwork HTML. Product modification dates use actual public document timestamps; static pages omit unknown dates. No date is replaced with the build date merely to imply freshness. `npm run sitemap` remains available as an explicit standalone source-file refresh.

**Publishing dependency:** changing a product in the admin updates the running React catalog, but the initial HTML and sitemap refresh on the next build/deployment. Rebuild after publishing, renaming, unpublishing, or materially editing an artwork. This change does not add a scheduler or deployment webhook.

## Follow-up: clean paths and hosting access

The initial output wrote only directory-index files. A raw-HTTP check against installed Vite preview reproduced the owner's observation: `/shop`, `/shop/blind-faith`, and `/login` received the homepage shell, while their trailing-slash forms received the intended documents. This also meant the clean login path missed its initial noindex. Vite checks `<path>.html` for clean paths and `<path>/index.html` for paths ending in a slash. The companion output above addresses that defect. A real HTTP preview regression now exercises clean paths, slash paths, and query strings instead of relying only on generated-file inspection.

This confirms preview behavior, not DigitalOcean's production resolution rules. The current production release uses identical shells at those routes; its responses cannot establish which generated snapshot a future release will serve. Check the deployed route-specific title, canonical, robots directive, and visible content on both path forms after deployment.

A follow-up direct HTTP probe distinguished methods on the bare domain:

| Request | Observed response |
| --- | --- |
| `GET https://likwitblvd.com/` | 301 to `https://www.likwitblvd.com` |
| `HEAD https://likwitblvd.com/` | 405 |
| `GET https://likwitblvd.com/shop` | 404 |
| `HEAD https://likwitblvd.com/shop` | 405 |

The redirect defect is therefore bare-domain deep-link handling; a HEAD-only 405 does not establish that the homepage GET fails to redirect. Validate the permanent redirect using GET with redirect following disabled first, then follow it and check path/query preservation and the final response.

The owner's Codex handoff reports an unauthenticated `doctl`. This audit's separate cloud browser could open a tab, but the DigitalOcean Apps dashboard showed “Site Unavailable,” including after one reload. Neither environment inspected or changed the app configuration. DigitalOcean's control panel supports app-level redirects and deployments without local CLI authentication; the repository documents a manual production deployment workflow, so automatic deployment must not be assumed. Do not use this repository's GitHub Pages `npm run deploy` command for DigitalOcean.

## Verification completed

| Check | Result |
| --- | --- |
| Production build with the current public Firestore catalog | Passed |
| Generated public pages | 23: seven core pages plus 16 artworks |
| Generated utility pages | Eight with initial noindex |
| Current artwork images resolved | 16 of 16 |
| Public HTML inspection | One title, H1, canonical, and valid JSON-LD per generated public route |
| Sitemap versus generated artwork routes | Exact match; no stale Out for Fame route |
| Focused automated tests | 74 passed, zero failures |
| Actual Vite preview HTTP regression | 12 clean, slash, and query-string URLs delivered the expected initial metadata and content |
| DOM metadata transitions | Passed product → home, login → contact, and missing-product → shop; no duplicate managed tags |
| Whitespace/diff validation | Passed |
| Rendered browser/navigation review | Owner's Codex reports desktop home/shop/images/local cart passed; mobile and metadata navigation remain incomplete |
| Production deployment/verification of this patch | Not performed |

The focused suite covers the new metadata/build behavior and existing portfolio visibility, public catalog, contact-intent, print-policy, and payment-method boundaries:

```bash
npm run build
node --test tests/seo.test.js tests/seo-build.test.js tests/spa-routing.test.js tests/portfolio-visibility.test.js tests/storefront-catalog.test.js tests/contact-intent.test.js tests/print-checkout-policy.test.js tests/checkout-payment-methods.test.js
git diff --check
```

The existing large-bundle and stale Browserslist warnings remain. Neither is represented as a measured Core Web Vitals failure. Dependencies were not upgraded as part of this SEO change.

## Remaining release actions

1. Complete the remaining rendered review: mobile home/portfolio/shop/artwork/contact, initial fallback transition, and product → home metadata reset. Check an unknown artwork's not-found view and noindex. The owner's Codex reports adding a Jaguar print to the local preview cart; remove that test item in the same local browser profile. Do not place a test order or submit a contact form merely for this review.
2. Configure a permanent bare-domain-to-www redirect that preserves path and query. For example, `https://likwitblvd.com/contact?intent=custom-art` must land on `https://www.likwitblvd.com/contact?intent=custom-art`. Verify the actual hosting/domain setup before changing it.
3. Merge and deploy the reviewed branch through the normal pipeline. Confirm the configured source branch and whether deployment is manual or automatic in the hosting dashboard. Verify raw deployed HTML on clean and trailing-slash routes, utility noindex, and the 23 current sitemap URLs after the deployment completes.
4. Review hosting error behavior. The current index.html catchall can still serve HTTP 200 for unknown paths; runtime noindex is implemented here. Switching to a server 404 document requires confirming how newly published Firestore routes reach the app between builds.
5. Submit/check the sitemap and inspect representative URLs in the owner’s Google Search Console. The paid integration is not required to use Search Console directly. Establish traffic and indexing baselines there; this audit cannot establish them.

## Next content work

The live Jaguar’s Bloodline entry has blank short/long descriptions and SEO fields. Echoes of the 5th Sun has descriptive copy but blank SEO fields. The patch supplies honest metadata fallbacks, but neither artwork’s catalog record was edited. Descriptive catalog updates should use the artist’s actual subject, medium, and intent rather than invented symbolism or print specifications.

Homepage service-card content is administered through Firestore; editing only the source fallback would not update those live cards. This change therefore focuses the identity improvements on fixed page sections shared with the build.

## Primary references

- [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) — Google can render JavaScript; meaningful initial HTML, unique metadata, and sensible error handling remain useful.
- [Google: canonical URL consolidation](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) — consistent canonical links and permanent redirects help consolidate URL signals.
- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) — sitemap discovery and truthful modification dates; submission does not guarantee indexing.
- [DigitalOcean: rewrite or redirect URL paths](https://docs.digitalocean.com/products/app-platform/how-to/url-rewrites/) — permanent app-level domain redirects through the Networking settings.
- [DigitalOcean: manage static sites](https://docs.digitalocean.com/products/app-platform/how-to/manage-static-sites/) — source/deployment settings and catchall/error documents.


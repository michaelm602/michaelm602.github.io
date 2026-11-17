import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preview } from "vite";
import {
  buildSeoSite,
  createSitemap,
  loadBuildCatalog,
  renderRouteDocument,
  renderStaticFallback,
  resolvePublicProductImage,
  validateBuildProducts,
} from "../scripts/seo-build.mjs";
import { STATIC_PUBLIC_ROUTES, UTILITY_ROUTES } from "../src/utils/seo.js";

const env = { VITE_FIREBASE_PROJECT_ID: "demo-art-catalog", VITE_FIREBASE_STORAGE_BUCKET: "demo-art-catalog.firebasestorage.app" };
const shell = '<!doctype html><html><head><meta name="viewport" content="width=device-width" /><!-- SEO:START --><title>Old shared title</title><!-- SEO:END --><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>';
const product = { id: "test-art", slug: "test-art", title: "Test Artwork", description: "An artist-supplied description.", images: [], seo: {} };

function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  return { mapValue: { fields: firestoreFields(value) } };
}

function firestoreFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, firestoreValue(field)]));
}

function publicRow(overrides = {}) {
  return { document: {
    name: `projects/demo-art-catalog/databases/(default)/documents/shopProducts/${overrides.id || product.id}`,
    fields: firestoreFields({
      ...product,
      longDescription: product.description,
      active: true,
      archivedAt: null,
      channels: { shop: true, portfolio: true },
      ...overrides,
    }),
    updateTime: "2026-09-09T12:00:00Z",
  } };
}

function jsonResponse(value, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => value };
}

function publicFetch(rows = [publicRow()], observe = () => {}) {
  return async (url, options) => {
    observe(url, options);
    if (url.endsWith(":runQuery")) return jsonResponse(rows);
    if (url.endsWith("/catalogOrdering/shop")) return jsonResponse({ fields: firestoreFields({ productIds: [product.id] }) });
    throw new Error(`Unexpected network request: ${url}`);
  };
}

test("build reads the same constrained public Firestore catalog and retains real update timestamps", async () => {
  let capturedQuery;
  const catalog = await loadBuildCatalog({ env, fetchImpl: publicFetch([publicRow()], (url, options) => {
    if (url.endsWith(":runQuery")) capturedQuery = JSON.parse(options.body).structuredQuery;
    assert.equal(options.headers?.Authorization, undefined);
  }) });
  assert.deepEqual(capturedQuery.from, [{ collectionId: "shopProducts" }]);
  assert.deepEqual(capturedQuery.where.compositeFilter.filters, [
    { fieldFilter: { field: { fieldPath: "active" }, op: "EQUAL", value: { booleanValue: true } } },
    { unaryFilter: { field: { fieldPath: "archivedAt" }, op: "IS_NULL" } },
    { fieldFilter: { field: { fieldPath: "channels.shop" }, op: "EQUAL", value: { booleanValue: true } } },
  ]);
  assert.deepEqual(catalog.products.map((entry) => entry.slug), [product.slug]);
  assert.equal(catalog.products[0].description, product.description);
  assert.equal(catalog.updatedAtBySlug[product.slug], "2026-09-09T12:00:00Z");
});

test("catalog failures and empty results cannot silently publish the legacy catalog", async () => {
  await assert.rejects(loadBuildCatalog({ env, fetchImpl: async () => jsonResponse({}, 403) }), /403/);
  await assert.rejects(loadBuildCatalog({ env, fetchImpl: publicFetch([]) }), /nonempty public shop catalog/);
  await assert.rejects(loadBuildCatalog({ env: {}, fetchImpl: publicFetch() }), /VITE_FIREBASE_PROJECT_ID/);
});

test("nonpublic, duplicate, and unsafe products are rejected before output", async () => {
  for (const overrides of [{ active: false }, { archivedAt: "2026-09-01" }, { channels: { shop: false } }]) {
    await assert.rejects(loadBuildCatalog({ env, fetchImpl: publicFetch([publicRow(overrides)]) }), /outside the public shop query/);
  }
  assert.throws(() => validateBuildProducts([product, { ...product, id: "different-id" }]), /duplicate/);
  assert.throws(() => validateBuildProducts([{ ...product, slug: "../../admin" }]), /unsafe/);
  assert.throws(() => validateBuildProducts([{ ...product, title: " " }]), /identity/);
});

test("missing thumbnails fall back only to the same artwork's full public image", async () => {
  const requests = [];
  const imageProduct = { ...product, images: [{ thumb: "airbrush/Test__thumb.webp", full: "airbrush/Test.webp" }] };
  const result = await resolvePublicProductImage(imageProduct, { bucket: env.VITE_FIREBASE_STORAGE_BUCKET, fetchImpl: async (url) => {
    requests.push(url);
    if (url.includes("__thumb")) return jsonResponse({}, 404);
    return jsonResponse({ name: "airbrush/Test.webp", bucket: env.VITE_FIREBASE_STORAGE_BUCKET, downloadTokens: "public-token" });
  } });
  assert.equal(requests.length, 2);
  assert.match(result, /airbrush%2FTest\.webp\?alt=media&token=public-token$/);
  const missing = await resolvePublicProductImage(imageProduct, { bucket: env.VITE_FIREBASE_STORAGE_BUCKET, fetchImpl: async () => jsonResponse({}, 404) });
  assert.equal(missing, null);
});

test("artwork resolver rejects external destinations, mismatched objects, and failed reads", async () => {
  const imageProduct = { ...product, images: [{ full: "https://example.com/private-image" }] };
  await assert.rejects(resolvePublicProductImage(imageProduct, { bucket: env.VITE_FIREBASE_STORAGE_BUCKET }), /configured public Firebase bucket/);
  imageProduct.images[0].full = "airbrush/Test.webp";
  await assert.rejects(resolvePublicProductImage(imageProduct, { bucket: env.VITE_FIREBASE_STORAGE_BUCKET, fetchImpl: async () => jsonResponse({}, 503) }), /503/);
  await assert.rejects(resolvePublicProductImage(imageProduct, { bucket: env.VITE_FIREBASE_STORAGE_BUCKET, fetchImpl: async () => jsonResponse({ name: "other.webp", bucket: env.VITE_FIREBASE_STORAGE_BUCKET }) }), /did not match/);
});

test("raw public pages contain unique metadata and visible shared content without JavaScript", () => {
  const home = renderRouteDocument(shell, "/");
  const shop = renderRouteDocument(shell, "/shop", { products: [product] });
  const artwork = renderRouteDocument(shell, `/shop/${product.slug}`, { product });
  assert.match(home, /Portland Airbrush Art, Prints &amp; Commissions/);
  assert.match(home, /<h1>Made to Order\. Built to Hit\.<\/h1>/);
  assert.match(shop, /<h1>Airbrush Art Prints<\/h1>/);
  assert.match(shop, /href="\/shop\/test-art"/);
  assert.match(artwork, /<h1>Test Artwork<\/h1>/);
  assert.match(artwork, /An artist-supplied description/);
  assert.match(artwork, /rel="canonical" href="https:\/\/www\.likwitblvd\.com\/shop\/test-art"/);
  assert.match(artwork, /src="\/assets\/app\.js"/);
  assert.doesNotMatch(artwork, /Old shared title/);
  assert.equal((artwork.match(/<title>/g) || []).length, 1);
});

test("public text is escaped in HTML and structured data and never becomes executable markup", () => {
  const malicious = { ...product, title: 'Art </script><script>alert("x")</script>', description: '<img src=x onerror="alert(1)">' };
  const html = renderRouteDocument(shell, `/shop/${product.slug}`, { product: malicious });
  assert.doesNotMatch(html, /<script>alert|<img src=x/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /\\u003c\/script>/);
});

test("fallback artwork never bakes checkout prices, availability, or payment data", () => {
  const value = { ...product, sizes: [{ price: 999999, stripePriceId: "price_do_not_publish" }], original: { status: "available", price: { amountCents: 1999900 } } };
  const html = renderStaticFallback("/shop", { products: [value] }) + renderStaticFallback(`/shop/${product.slug}`, { product: value });
  assert.doesNotMatch(html, /999999|1999900|price_do_not_publish|Add.*Cart|Original available/);
});

test("literal replacement tokens in public artwork copy cannot corrupt the HTML shell", () => {
  const tokens = ["$&", "$'", "$" + String.fromCharCode(96), "$$"].join(" ");
  const entry = { ...product, title: tokens, description: tokens };
  const html = renderRouteDocument(shell, `/shop/${product.slug}`, { product: entry });
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/<div id="root">/g) || []).length, 1);
  assert.ok(html.includes("<h1>$&amp; $&#39; $" + String.fromCharCode(96) + " $$</h1>"));
  assert.doesNotMatch(html, /Old shared title/);
});

test("utility routes receive raw noindex without a public canonical or artwork schema", () => {
  for (const path of UTILITY_ROUTES) {
    const html = renderRouteDocument(shell, path);
    assert.match(html, /name="robots" content="noindex, follow"/);
    assert.doesNotMatch(html, /rel="canonical"|application\/ld\+json|id="seo-fallback"/);
  }
});

test("sitemap uses the supplied current products and only truthful available lastmod values", () => {
  const xml = createSitemap({ products: [product, { ...product, id: "second", slug: "second-art" }], updatedAtBySlug: { [product.slug]: "2026-09-09T12:00:00Z" } });
  assert.equal((xml.match(/<loc>/g) || []).length, STATIC_PUBLIC_ROUTES.length + 2);
  assert.equal((xml.match(/<lastmod>/g) || []).length, 1);
  assert.match(xml, /2026-09-09T12:00:00\.000Z/);
  assert.match(xml, /https:\/\/www\.likwitblvd\.com\/shop\/test-art/);
  assert.doesNotMatch(xml, /\/admin|\/login|\/success|\/cancel|\/upload|\/portfolio\/tattoos|\/shop\/out-for-fame/);
});

test("build emits matching direct-entry pages and sitemap from one public catalog snapshot", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "likwit-seo-build-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist/index.html"), shell);
  let queries = 0;
  const result = await buildSeoSite({ root, env, fetchImpl: publicFetch([publicRow()], (url) => { if (url.endsWith(":runQuery")) queries += 1; }) });
  assert.equal(queries, 1);
  assert.equal(result.publicPages, STATIC_PUBLIC_ROUTES.length + 1);
  const xml = await readFile(join(root, "dist/sitemap.xml"), "utf8");
  assert.match(xml, /\/shop\/test-art/);
  for (const path of [...STATIC_PUBLIC_ROUTES, ...UTILITY_ROUTES, `/shop/${product.slug}`]) {
    const html = await readFile(join(root, "dist", `.${path}`, "index.html"), "utf8");
    assert.match(html, /\/assets\/app\.js/);
    if (path !== "/") {
      assert.equal(await readFile(join(root, "dist", `.${path}.html`), "utf8"), html);
    }
  }
});

test("Vite preview serves route-specific initial HTML for clean, slash, and query-string URLs", { timeout: 15000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), "likwit-seo-preview-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist/index.html"), shell);
  await buildSeoSite({ root, env, fetchImpl: publicFetch() });
  const server = await preview({
    configFile: false,
    root,
    build: { outDir: "dist" },
    preview: { host: "127.0.0.1", port: 0, strictPort: true, open: false },
    logLevel: "silent",
  });
  try {
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const cases = [
      {
        paths: ["/shop", "/shop/", "/shop?utm_source=seo-check", "/shop/?utm_source=seo-check"],
        title: "Airbrush Art Prints | Likwit Blvd",
        canonical: "https://www.likwitblvd.com/shop",
        h1: "Airbrush Art Prints",
      },
      {
        paths: ["/shop/test-art", "/shop/test-art/", "/shop/test-art?utm_source=seo-check"],
        title: "Test Artwork | Likwit Blvd Artwork",
        canonical: "https://www.likwitblvd.com/shop/test-art",
        h1: "Test Artwork",
      },
      {
        paths: ["/login", "/login/", "/login?redirect=%2Fshop"],
        title: "Account &amp; Order Pages | Likwit Blvd",
        robots: "noindex, follow",
      },
      {
        paths: ["/contact?intent=custom-art", "/contact/?intent=custom-art"],
        title: "Art Commissions &amp; Questions | Contact Likwit Blvd",
        canonical: "https://www.likwitblvd.com/contact",
        h1: "Contact the Artist",
      },
    ];
    for (const expected of cases) {
      for (const path of expected.paths) {
        const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(3000) });
        assert.equal(response.status, 200, path);
        const html = await response.text();
        assert.equal(html.match(/<title>(.*?)<\/title>/)?.[1], expected.title, `${path} title`);
        assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], expected.canonical, `${path} canonical`);
        assert.equal(html.match(/<meta name="robots" content="([^"]+)"/)?.[1], expected.robots || "index, follow, max-image-preview:large", `${path} robots`);
        assert.equal(html.match(/<h1>(.*?)<\/h1>/)?.[1], expected.h1, `${path} H1`);
      }
    }
  } finally {
    await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("failed catalog fetch leaves existing SEO outputs untouched", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "likwit-seo-failure-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist/index.html"), shell);
  await writeFile(join(root, "dist/sitemap.xml"), "previous successful sitemap");
  await assert.rejects(buildSeoSite({ root, env, fetchImpl: async () => jsonResponse({}, 503) }), /503/);
  assert.equal(await readFile(join(root, "dist/index.html"), "utf8"), shell);
  assert.equal(await readFile(join(root, "dist/sitemap.xml"), "utf8"), "previous successful sitemap");
});

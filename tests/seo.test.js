import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SOCIAL_IMAGE,
  SITE_URL,
  STATIC_PUBLIC_ROUTES,
  UTILITY_ROUTES,
  escapeHtml,
  getPageSeo,
  isProductPath,
  normalizeSeoPath,
  serializeJsonLd,
} from "../src/utils/seo.js";

test("each public page has distinct, indexable metadata on the canonical host", () => {
  const pages = STATIC_PUBLIC_ROUTES.map((path) => getPageSeo(path));
  assert.equal(new Set(pages.map((page) => page.title)).size, pages.length);
  assert.equal(new Set(pages.map((page) => page.description)).size, pages.length);
  for (const [index, page] of pages.entries()) {
    assert.equal(page.canonical, `${SITE_URL}${STATIC_PUBLIC_ROUTES[index]}`);
    assert.doesNotMatch(page.robots, /noindex/);
    assert.equal(page.type, "website");
    assert.equal(page.image, DEFAULT_SOCIAL_IMAGE);
    assert.ok(page.structuredData["@graph"].some((entity) => entity["@type"] === "Person"));
  }
});

test("contact intent, tracking queries, fragments, and trailing slash share one canonical", () => {
  assert.equal(getPageSeo("/contact/?intent=original&product=blind-faith#form").canonical, `${SITE_URL}/contact`);
  assert.equal(normalizeSeoPath("/shop/?utm_source=instagram"), "/shop");
  assert.equal(normalizeSeoPath("//another.example/path"), "/not-found");
});

test("utility, hidden, and unknown pages do not inherit public metadata", () => {
  for (const path of [...UTILITY_ROUTES, "/admin/unknown", "/portfolio/tattoos", "/not-a-page"]) {
    const metadata = getPageSeo(path);
    assert.match(metadata.robots, /noindex/);
    assert.equal(metadata.structuredData, null);
    assert.equal(metadata.canonical, null);
  }
});

test("product identity uses public copy without claiming prices or stock", () => {
  const product = {
    slug: "sample-art", title: "Sample Art", description: "An artist-provided description.",
    seo: { title: "Sample Art by the Artist", description: "A supplied search description." },
    original: { medium: "Airbrush and acrylic", price: { amountCents: 120000 } },
    sizes: [{ label: "16x20", price: 100 }],
    privateNotes: "must not be included",
  };
  const metadata = getPageSeo("/shop/sample-art", { product, imageUrl: "https://example.com/art.webp" });
  assert.equal(metadata.title, product.seo.title);
  assert.equal(metadata.description, product.seo.description);
  assert.equal(metadata.canonical, `${SITE_URL}/shop/sample-art`);
  assert.equal(metadata.type, "product");
  const art = metadata.structuredData["@graph"].find((entity) => entity["@type"] === "VisualArtwork");
  assert.equal(art.name, product.title);
  assert.equal(art.artMedium, product.original.medium);
  assert.doesNotMatch(JSON.stringify(metadata.structuredData), /offers|availability|price|privateNotes|must not be included/);
});

test("catalog loading stays indexable; a confirmed missing product does not", () => {
  assert.doesNotMatch(getPageSeo("/shop/new-art").robots, /noindex/);
  const missing = getPageSeo("/shop/new-art", { missing: true });
  assert.match(missing.robots, /noindex/);
  assert.equal(missing.canonical, null);
  assert.equal(missing.structuredData, null);
  assert.equal(isProductPath("/shop/../../admin"), false);
  assert.equal(isProductPath("/shop/safe-slug"), true);
});

test("metadata cannot use another product's identity or unsafe image URL", () => {
  const metadata = getPageSeo("/shop/new-art", {
    product: { slug: "old-art", title: "Old art" },
    imageUrl: "javascript:alert(1)",
  });
  assert.doesNotMatch(metadata.title, /Old art/);
  assert.equal(metadata.image, DEFAULT_SOCIAL_IMAGE);
});

test("public strings cannot break out of HTML attributes or a JSON-LD script", () => {
  const hostile = '</script><img src=x onerror="alert(1)"> & \'quoted\'';
  assert.doesNotMatch(escapeHtml(hostile), /<|>|"|'/);
  const serialized = serializeJsonLd({ name: hostile });
  assert.doesNotMatch(serialized, /<\/script>/);
  assert.equal(JSON.parse(serialized).name, hostile);
});

// Public HTML previews only. The app remains the authority for current prices,
// availability, cart state, and checkout; this script never writes backend data.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getAllProducts } from "../src/data/products.js";
import { resolveStorefrontCatalogMode } from "../src/config/storefrontCatalog.js";
import { filterPublicCatalog, mapFirestoreProductForStorefront, mapSourceProductForStorefront } from "../src/utils/storefrontProduct.js";
import { sanitizeCatalogOrdering } from "../src/utils/catalogOrdering.js";
import { PAGE_COPY } from "../src/content/pageCopy.js";
import { SITE_URL, STATIC_PUBLIC_ROUTES, UTILITY_ROUTES, getPageSeo, escapeHtml, serializeJsonLd } from "../src/utils/seo.js";

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function decodeFirestoreValue(value = {}) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields);
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}

export function validateBuildProducts(products) {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("SEO build needs a nonempty public shop catalog; no legacy fallback was used.");
  }
  const slugs = new Set();
  const ids = new Set();
  for (const product of products) {
    if (!SAFE_SLUG.test(product?.slug || "") || product.slug.length > 120) {
      throw new Error("SEO build rejected an unsafe or missing public product slug.");
    }
    if (slugs.has(product.slug) || ids.has(product.id)) {
      throw new Error(`SEO build found a duplicate public product: ${product.slug}`);
    }
    if (typeof product.id !== "string" || !product.id || typeof product.title !== "string" || !product.title.trim()) {
      throw new Error(`SEO build found incomplete public product identity: ${product.slug}`);
    }
    slugs.add(product.slug);
    ids.add(product.id);
  }
  return products;
}

async function fetchJson(url, options, fetchImpl) {
  const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Public SEO data request failed (${response.status}).`);
  return response.json();
}

export async function loadBuildEnvironment(root = PROJECT_ROOT, mode = "production") {
  const { loadEnv } = await import("vite");
  return { ...loadEnv(mode, root, "VITE_"), ...process.env };
}

export async function loadBuildCatalog({ env = {}, fetchImpl = globalThis.fetch } = {}) {
  const mode = resolveStorefrontCatalogMode({ configuredMode: env.VITE_STOREFRONT_CATALOG_MODE, isProduction: true });
  if (mode === "source") {
    return { products: validateBuildProducts(getAllProducts().map(mapSourceProductForStorefront)), updatedAtBySlug: {} };
  }
  const project = env.VITE_FIREBASE_PROJECT_ID;
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project || "")) {
    throw new Error("SEO build requires VITE_FIREBASE_PROJECT_ID for the public Firestore catalog.");
  }
  const documentsUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const response = await fetchJson(`${documentsUrl}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "shopProducts" }],
      where: { compositeFilter: { op: "AND", filters: [
        { fieldFilter: { field: { fieldPath: "active" }, op: "EQUAL", value: { booleanValue: true } } },
        { unaryFilter: { field: { fieldPath: "archivedAt" }, op: "IS_NULL" } },
        { fieldFilter: { field: { fieldPath: "channels.shop" }, op: "EQUAL", value: { booleanValue: true } } },
      ] } },
    } }),
  }, fetchImpl);
  if (!Array.isArray(response) || response.some((row) => row.error)) {
    throw new Error("SEO build received an invalid or incomplete public catalog response.");
  }
  const documents = response.filter((row) => row.document).map(({ document }) => ({
    ...decodeFields(document.fields),
    id: document.name?.split("/").at(-1),
    publicUpdateTime: document.updateTime,
  }));
  if (documents.some((product) => product.active !== true || product.archivedAt !== null || product.channels?.shop !== true)) {
    throw new Error("SEO build refused a product outside the public shop query.");
  }
  validateBuildProducts(documents);
  // Match the storefront's optional ordering behavior; missing ordering is safe.
  let productIds = [];
  try {
    const ordering = await fetchJson(`${documentsUrl}/catalogOrdering/shop`, {}, fetchImpl);
    productIds = sanitizeCatalogOrdering(decodeFields(ordering.fields));
  } catch {
    // Runtime also uses product sortOrder when the optional ordering read fails.
  }
  const products = filterPublicCatalog(documents, "shop", { productIds }).map(mapFirestoreProductForStorefront);
  return {
    products: validateBuildProducts(products),
    updatedAtBySlug: Object.fromEntries(documents.map((product) => [product.slug, product.updatedAt || product.publicUpdateTime])),
  };
}

function storageObjectPath(value, bucket) {
  if (typeof value !== "string" || !value.trim()) return null;
  let path = value.trim();
  if (path.startsWith("gs://")) {
    const prefix = `gs://${bucket}/`;
    if (!path.startsWith(prefix)) throw new Error("SEO image points to a different storage bucket.");
    path = path.slice(prefix.length);
  } else if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    const prefix = `/v0/b/${bucket}/o/`;
    if (url.protocol !== "https:" || url.hostname !== "firebasestorage.googleapis.com" || !url.pathname.startsWith(prefix)) {
      throw new Error("SEO image URL must point to the configured public Firebase bucket.");
    }
    path = decodeURIComponent(url.pathname.slice(prefix.length));
  }
  if (!path || /[\u0000-\u001f]/.test(path)) throw new Error("SEO image has an invalid storage path.");
  return path.replace(/^\/+/, "");
}

export async function resolvePublicProductImage(product, { bucket, fetchImpl = globalThis.fetch } = {}) {
  const image = product.images?.[0];
  if (!image || (!image.full && !image.thumb)) return null;
  if (!/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(bucket || "")) {
    throw new Error("SEO build requires VITE_FIREBASE_STORAGE_BUCKET to resolve public artwork images.");
  }
  for (const sourcePath of [...new Set([image.thumb, image.full].filter(Boolean))]) {
    const objectPath = storageObjectPath(sourcePath, bucket);
    const metadataUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}`;
    const response = await fetchImpl(metadataUrl, { signal: AbortSignal.timeout(20000) });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Public artwork image request failed (${response.status}).`);
    const metadata = await response.json();
    if (metadata.name !== objectPath || metadata.bucket !== bucket) {
      throw new Error("SEO image metadata did not match the requested public artwork.");
    }
    const token = typeof metadata.downloadTokens === "string" ? metadata.downloadTokens.split(",")[0].trim() : "";
    return `${metadataUrl}?alt=media${token ? `&token=${encodeURIComponent(token)}` : ""}`;
  }
  return null;
}

export async function resolveCatalogImages(products, options) {
  const result = {};
  // Bound simultaneous public metadata reads on large catalogs.
  for (let index = 0; index < products.length; index += 4) {
    const entries = await Promise.all(products.slice(index, index + 4).map(async (product) => [
      product.slug, await resolvePublicProductImage(product, options),
    ]));
    Object.assign(result, Object.fromEntries(entries));
  }
  return result;
}

function actualLastmod(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function createSitemap({ products, updatedAtBySlug = {} }) {
  validateBuildProducts(products);
  const entries = [
    ...STATIC_PUBLIC_ROUTES.map((path) => ({ path })),
    ...products.map((product) => ({ path: `/shop/${product.slug}`, lastmod: actualLastmod(updatedAtBySlug[product.slug]) })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({ path, lastmod }) =>
    `  <url>\n    <loc>${escapeHtml(`${SITE_URL}${path}`)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n  </url>`
  ).join("\n")}\n</urlset>\n`;
}

const FALLBACK_STYLE = `<style>
#seo-fallback{min-height:100vh;background:#090909;color:#f4f4f5;font:16px/1.7 system-ui,sans-serif;padding:0 24px 64px}#seo-fallback *{box-sizing:border-box}#seo-fallback a{color:inherit;text-underline-offset:4px}#seo-fallback header{max-width:1120px;margin:auto;padding:22px 0;display:flex;gap:24px;align-items:center;justify-content:space-between;border-bottom:1px solid #333}#seo-fallback nav{display:flex;gap:18px;flex-wrap:wrap}#seo-fallback .brand{font-size:23px;font-weight:700;text-decoration:none}#seo-fallback main{max-width:1040px;margin:56px auto 0}#seo-fallback h1{font-size:clamp(30px,5vw,52px);line-height:1.12;margin:0 0 24px}#seo-fallback h2{font-size:25px;line-height:1.3;margin:36px 0 12px}#seo-fallback p{max-width:760px;color:#ccc;white-space:pre-line}#seo-fallback .actions{display:flex;flex-wrap:wrap;gap:18px;margin:28px 0}#seo-fallback .actions a{border:1px solid #666;padding:10px 18px;text-decoration:none}#seo-fallback .art-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:28px;margin-top:36px}#seo-fallback figure{margin:0;background:#171717;padding:16px}#seo-fallback figure img{width:100%;height:260px;object-fit:contain}#seo-fallback figcaption{padding-top:12px;font-size:18px;font-weight:600}#seo-fallback .art-image{display:block;max-width:100%;max-height:600px;height:auto;object-fit:contain;margin:28px 0}#seo-fallback .hero-image{width:100%;max-height:440px;object-fit:cover;display:block;margin:28px 0}#seo-fallback footer{max-width:1040px;margin:56px auto 0;padding-top:24px;border-top:1px solid #333;color:#aaa;font-size:14px}@media(max-width:600px){#seo-fallback{padding-left:18px;padding-right:18px}#seo-fallback header{align-items:flex-start;flex-direction:column;gap:12px}#seo-fallback nav{gap:14px}#seo-fallback main{margin-top:36px}}
</style>`;

function anchor(path, label) {
  return `<a href="${escapeHtml(path)}">${escapeHtml(label)}</a>`;
}

function paragraph(value) {
  return value ? `<p>${escapeHtml(value)}</p>` : "";
}

export function renderStaticFallback(path, { products = [], product, imageUrls = {} } = {}) {
  const copy = PAGE_COPY[path];
  if (!copy && !product) return "";
  let content = `<h1>${escapeHtml(product ? product.title : copy.heading)}</h1>`;
  if (product) {
    const image = imageUrls[product.slug];
    if (image) content += `<img class="art-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.images?.[0]?.alt || product.title)}" />`;
    content += paragraph(product.description || product.shortDescription);
    content += `<div class="actions">${anchor("/shop", "Browse prints")}${anchor(`/contact?intent=product&product=${encodeURIComponent(product.slug)}`, "Ask about this artwork")}</div>`;
  } else {
    content += paragraph(copy.intro);
    if (path === "/") {
      content += `<img class="hero-image" src="/hero-images/iwata.webp" alt="Airbrush equipment at Likwit Blvd" />`;
      content += `<div class="actions">${anchor("/shop", "Shop prints")}${anchor("/contact?intent=custom-art", "Request custom artwork")}</div>`;
      content += `<h2>${escapeHtml(copy.artistHeading)}</h2>${paragraph(copy.artistIntro)}`;
    }
    if (["/", "/portfolio", "/gallery"].includes(path)) {
      content += `<h2>Explore the work</h2><div class="actions">${anchor("/portfolio/airbrush", "Airbrush art")}${anchor("/portfolio/photoshop", "Photoshop & digital art")}</div>`;
    }
    if (path.startsWith("/portfolio/")) {
      content += `<div class="actions">${anchor("/shop", "Browse prints")}${anchor("/contact?intent=custom-art", "Request custom artwork")}</div>`;
    }
    if (path === "/shop") {
      content += paragraph("Prints are produced after purchase through a professional print partner. Production and shipping times may vary.");
      content += `<div class="art-grid">${products.map((entry) => {
        const image = imageUrls[entry.slug];
        return `<figure><a href="/shop/${escapeHtml(entry.slug)}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(entry.images?.[0]?.alt || entry.title)}" loading="lazy" />` : ""}<figcaption>${escapeHtml(entry.title)}</figcaption></a>${paragraph(entry.shortDescription || entry.description)}</figure>`;
      }).join("")}</div>`;
    }
    if (path === "/contact") {
      content += paragraph("For custom artwork, print questions, or an existing order, email the artist.");
      content += `<div class="actions">${anchor("mailto:airbrushnink@gmail.com", "airbrushnink@gmail.com")}${anchor("/portfolio", "View the portfolio")}</div>`;
    }
  }
  return `<div id="seo-fallback">${FALLBACK_STYLE}<header>${anchor("/", "Likwit Blvd").replace("<a ", '<a class="brand" ')}<nav aria-label="Main navigation">${anchor("/portfolio", "Portfolio")}${anchor("/shop", "Shop")}${anchor("/contact", "Contact")}</nav></header><main>${content}</main><footer>Likwit Blvd · Michael Maldonado · Portland, Oregon</footer></div>`;
}

export function renderSeoHead(seo) {
  const meta = (key, value, attribute = "name") => `<meta ${attribute}="${key}" content="${escapeHtml(value || "")}" />`;
  return [
    `<title>${escapeHtml(seo.title)}</title>`,
    meta("description", seo.description), meta("robots", seo.robots),
    seo.canonical ? `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />` : "",
    meta("og:title", seo.title, "property"), meta("og:description", seo.description, "property"),
    meta("og:url", seo.canonical || "", "property"), meta("og:type", seo.type || "website", "property"),
    meta("og:site_name", "Likwit Blvd", "property"), meta("og:image", seo.image, "property"),
    meta("twitter:card", "summary_large_image"), meta("twitter:title", seo.title),
    meta("twitter:description", seo.description), meta("twitter:image", seo.image),
    seo.structuredData ? `<script id="page-structured-data" type="application/ld+json">${serializeJsonLd(seo.structuredData)}</script>` : "",
  ].filter(Boolean).join("\n  ");
}

const SPA_FALLBACK_HEAD = [
  "<title>Likwit Blvd</title>",
  '<meta name="description" content="Loading Likwit Blvd." />',
  '<meta name="robots" content="index, follow, max-image-preview:large" />',
].join("\n  ");

const SPA_FALLBACK_CONTENT = `<div id="spa-fallback" role="status"><nav aria-label="Main navigation">${anchor("/", "Likwit Blvd")}${anchor("/portfolio", "Portfolio")}${anchor("/shop", "Shop")}${anchor("/contact", "Contact")}</nav><main><h1>Likwit Blvd</h1><p>Loading page...</p></main></div>`;

function replaceApplicationRoot(shell, content) {
  const root = /<div\b[^>]*\bid=["']root["'][^>]*>/i.exec(shell);
  if (!root) throw new Error("SEO build expected the application root in the Vite output.");
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = root.index;
  let depth = 0;
  let tag;
  while ((tag = tags.exec(shell))) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return `${shell.slice(0, root.index)}<div id="root">${content}</div>${shell.slice(tags.lastIndex)}`;
  }
  throw new Error("SEO build found an unclosed application root in the Vite output.");
}

// This is the hosting catchall document, not a route snapshot. It deliberately
// starts neutral and indexable so a new public Firestore artwork can still be
// discovered before the next static catalog export. React replaces this shell
// and ProductDetailPage applies noindex only after a catalog lookup confirms a
// requested artwork is absent.
export function createSpaFallbackDocument(shell) {
  if (!shell.includes("<!-- SEO:START -->") || !shell.includes("<!-- SEO:END -->")) {
    throw new Error("SEO build cannot find the managed metadata block in dist/index.html.");
  }
  return replaceApplicationRoot(shell
    .replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/, () => `<!-- SEO:START -->\n  ${SPA_FALLBACK_HEAD}\n  <!-- SEO:END -->`)
    .replace(/\s*<!-- Critical homepage image hints -->/, "")
    .replace(/\s*<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bhref=["'][^"']*\/hero-images\/iwata\.webp["'])[^>]*\/?>(?:\s*)/i, ""), SPA_FALLBACK_CONTENT);
}

export function renderRouteDocument(shell, path, options = {}) {
  if (!shell.includes("<!-- SEO:START -->") || !shell.includes("<!-- SEO:END -->")) {
    throw new Error("SEO build cannot find the managed metadata block in dist/index.html.");
  }
  if (!/<div\s+id=["']root["']\s*>\s*<\/div>/.test(shell)) {
    throw new Error("SEO build expected the empty application root in the Vite output.");
  }
  const seo = getPageSeo(path, { product: options.product, imageUrl: options.imageUrls?.[options.product?.slug] });
  return shell
    .replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/, () => `<!-- SEO:START -->\n  ${renderSeoHead(seo)}\n  <!-- SEO:END -->`)
    .replace(/<div\s+id=["']root["']\s*>\s*<\/div>/, () => `<div id="root">${renderStaticFallback(path, options)}</div>`);
}

export async function buildSeoSite({ root = PROJECT_ROOT, env, fetchImpl = globalThis.fetch } = {}) {
  const buildEnv = env || await loadBuildEnvironment(root);
  const catalog = await loadBuildCatalog({ env: buildEnv, fetchImpl });
  const imageUrls = await resolveCatalogImages(catalog.products, { bucket: buildEnv.VITE_FIREBASE_STORAGE_BUCKET, fetchImpl });
  const dist = resolve(root, "dist");
  const shell = await readFile(resolve(dist, "index.html"), "utf8");
  const productByPath = new Map(catalog.products.map((product) => [`/shop/${product.slug}`, product]));
  const routes = [...new Set([...STATIC_PUBLIC_ROUTES, ...productByPath.keys(), ...UTILITY_ROUTES])];
  // Render before writing, so invalid data cannot leave half an SEO export.
  const documents = routes.map((path) => ({
    path,
    html: renderRouteDocument(shell, path, { products: catalog.products, product: productByPath.get(path), imageUrls }),
  }));
  const spaFallback = createSpaFallbackDocument(shell);
  const sitemap = createSitemap(catalog);
  for (const document of documents) {
    const target = resolve(dist, `.${document.path}`, "index.html");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, document.html, "utf8");
    // Vite preview resolves clean URLs through .html and slash URLs through index.html.
    if (document.path !== "/") {
      await writeFile(resolve(dist, `.${document.path}.html`), document.html, "utf8");
    }
  }
  await writeFile(resolve(dist, "spa-fallback.html"), spaFallback, "utf8");
  await writeFile(resolve(dist, "sitemap.xml"), sitemap, "utf8");
  return { publicPages: STATIC_PUBLIC_ROUTES.length + catalog.products.length, utilityPages: UTILITY_ROUTES.length, products: catalog.products.length };
}

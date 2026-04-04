// scripts/generate-sitemap.mjs
// Regenerates public/sitemap.xml from src/data/products.js.
// Run directly:  node scripts/generate-sitemap.mjs
// Runs automatically before deploy via the "predeploy" npm script.

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getAllProducts } from "../src/data/products.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL  = "https://www.likwitblvd.com";
const today     = new Date().toISOString().split("T")[0];

const staticRoutes = [
  { path: "/",          changefreq: "weekly",  priority: "1.0" },
  { path: "/portfolio", changefreq: "weekly",  priority: "0.8" },
  { path: "/contact",   changefreq: "weekly",  priority: "0.8" },
  { path: "/shop",      changefreq: "weekly",  priority: "0.8" },
];

const productRoutes = getAllProducts().map((p) => ({
  path:       `/shop/${p.slug}`,
  changefreq: "monthly",
  priority:   "0.7",
}));

const allRoutes = [...staticRoutes, ...productRoutes];

const urlNodes = allRoutes
  .map(({ path, changefreq, priority }) =>
`  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`)
  .join("\n");

const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlNodes}
</urlset>
`;

const outPath = resolve(__dirname, "../public/sitemap.xml");
writeFileSync(outPath, xml, "utf-8");
console.log(`sitemap.xml — ${allRoutes.length} URLs written to public/sitemap.xml`);

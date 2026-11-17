// Optional standalone refresh. The normal build also writes dist/sitemap.xml
// using the same public catalog snapshot that produced its artwork pages.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PROJECT_ROOT, loadBuildEnvironment, loadBuildCatalog, createSitemap } from "./seo-build.mjs";

const catalog = await loadBuildCatalog({ env: await loadBuildEnvironment() });
await writeFile(resolve(PROJECT_ROOT, "public/sitemap.xml"), createSitemap(catalog), "utf8");
console.log(`Sitemap refreshed from ${catalog.products.length} public shop products.`);

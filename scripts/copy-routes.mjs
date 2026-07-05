// scripts/copy-routes.mjs
// Post-build: copies dist/index.html into every known route directory so
// GitHub Pages serves a real 200 for direct URL loads instead of a 404.
//
// Runs automatically as part of the predeploy script.

import { copyFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getAllProducts } from "../src/data/products.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist      = resolve(__dirname, "../dist");
const src       = resolve(dist, "index.html");

const routes = [
  "admin",
  "admin/artwork",
  "admin/home",
  "login",
  "upload",
  "portfolio",
  "portfolio/airbrush",
  "portfolio/photoshop",
  "portfolio/tattoos",
  "gallery",
  "contact",
  "shop",
  "success",
  "cancel",
  ...getAllProducts().map((p) => `shop/${p.slug}`),
];

for (const route of routes) {
  const dir = resolve(dist, route);
  mkdirSync(dir, { recursive: true });
  copyFileSync(src, resolve(dir, "index.html"));
  console.log(`  200 → /${route}`);
}

console.log(`\n${routes.length} routes copied.`);

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const uploader = await readFile(new URL("../src/Components/UploadImage.jsx", import.meta.url), "utf8");
const productCatalog = await readFile(new URL("../src/data/products.js", import.meta.url), "utf8");

test("admin routes expose the dashboard, homepage editor, media uploader, and products", () => {
  assert.match(app, /path="\/admin"/);
  assert.match(app, /path="\/admin\/home"/);
  assert.match(app, /path="\/admin\/artwork"/);
  assert.match(app, /path="\/upload" element=\{<Navigate to="\/admin\/artwork" replace \/>\}/);
  assert.match(app, /path="\/admin\/products"/);
});

test("uploader uses the custom-claim hook and only proven Storage folders", () => {
  assert.match(uploader, /useAdminAuth/);
  assert.doesNotMatch(uploader, /ADMIN_EMAIL|ADMIN_UID|airbrushnink@gmail\.com/);

  for (const folder of ["airbrush", "photoshop", "tattoos", "portfolio-videos"]) {
    assert.match(uploader, new RegExp(`"${folder}"`));
  }
});

test("shop inventory remains a source catalog rather than an invented Firebase collection", () => {
  assert.match(productCatalog, /export const products = \[/);
  assert.match(productCatalog, /stripePriceId/);
  assert.match(productCatalog, /featured:/);
  assert.match(productCatalog, /status:/);
  assert.doesNotMatch(productCatalog, /collection\(|onSnapshot\(|getDocs\(/);
});

test("public portfolio routes keep hidden tattoo work behind a visibility guard", () => {
  for (const route of ["/portfolio", "/portfolio/airbrush", "/portfolio/photoshop"]) {
    assert.match(app, new RegExp(`path="${route.replaceAll("/", "\\/")}"`));
  }
  assert.match(app, /path="\/portfolio\/tattoos"/);
  assert.match(app, /isPortfolioCategoryVisible\("tattoos"\)/);
  assert.match(app, /<Navigate to="\/portfolio" replace \/>/);
});

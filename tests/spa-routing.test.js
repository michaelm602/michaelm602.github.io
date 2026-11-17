import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { UTILITY_ROUTES, STATIC_PUBLIC_ROUTES } from "../src/utils/seo.js";

const fallback = await readFile(new URL("../public/404.html", import.meta.url), "utf8");
const shell = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

test("missing paths show a noindex error page instead of redirecting to the homepage", () => {
  assert.match(fallback, /name="robots" content="noindex, follow"/);
  assert.match(fallback, /<h1>This page isn’t here\.<\/h1>/);
  assert.doesNotMatch(fallback, /l\.replace|window\.location|http-equiv="refresh"/);
  assert.match(app, /path="\*" element=\{<NotFound/);
});

test("legacy SPA restoration still strips leading slashes", () => {
  assert.match(shell, /replace\(\/\^\\\/\+\//);
});

test("build output includes direct-entry admin routes", () => {
  for (const route of [
    "admin",
    "admin/artwork",
    "admin/home",
    "admin/products",
    "login",
    "upload",
    "success",
    "cancel",
    "portfolio",
    "gallery",
  ]) {
    assert.ok([...UTILITY_ROUTES, ...STATIC_PUBLIC_ROUTES].includes(`/${route}`));
  }
  assert.ok(!STATIC_PUBLIC_ROUTES.includes("/portfolio/tattoos"));
});

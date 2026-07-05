import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fallback = await readFile(new URL("../public/404.html", import.meta.url), "utf8");
const shell = await readFile(new URL("../index.html", import.meta.url), "utf8");
const routeCopies = await readFile(new URL("../scripts/copy-routes.mjs", import.meta.url), "utf8");

test("SPA fallback strips leading slashes before restoring browser history", () => {
  assert.match(fallback, /pathname\.replace\(\/\^\\\/\+\//);
  assert.doesNotMatch(fallback, /'\/\?p=\/' \+ l\.pathname/);
  assert.match(shell, /replace\(\/\^\\\/\+\//);
});

test("build output includes direct-entry admin routes", () => {
  for (const route of [
    "admin",
    "admin/artwork",
    "admin/home",
    "login",
    "upload",
    "success",
    "cancel",
    "portfolio",
    "portfolio/airbrush",
    "portfolio/photoshop",
    "portfolio/tattoos",
    "gallery",
  ]) {
    assert.match(routeCopies, new RegExp(`"${route.replace("/", "\\/")}"`));
  }
});

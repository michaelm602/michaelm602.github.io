import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const policyCheckbox = await import(
  "../src/Components/PolicyAcknowledgementCheckbox.js"
).catch(() => ({}));
const cartDrawerSource = await readFile(
  new URL("../src/Components/CartDrawer.jsx", import.meta.url),
  "utf8"
);

function renderCheckbox(checked) {
  if (!policyCheckbox.default) return "";
  return renderToStaticMarkup(
    React.createElement(
      policyCheckbox.default,
      {
        id: "policy-test",
        checked,
        onChange: () => {},
        label: "I accept the made-to-order policy.",
      },
    )
  );
}

test("unchecked policy control renders a clear empty box with an accessible tap target", () => {
  const markup = renderCheckbox(false);

  assert.match(markup, /type="checkbox"/);
  assert.doesNotMatch(markup, /checked=""/);
  assert.match(markup, /min-h-11/);
  assert.match(markup, /border-zinc-300/);
  assert.match(markup, /bg-transparent/);
  assert.match(markup, /peer-focus-visible:ring-2/);
  assert.doesNotMatch(markup, />Accepted</);
  assert.doesNotMatch(markup, /<svg/);
});

test("checked policy control renders an emerald box, white checkmark, and accepted state", () => {
  const markup = renderCheckbox(true);

  assert.match(markup, /checked=""/);
  assert.match(markup, /peer-checked:border-emerald-500/);
  assert.match(markup, /peer-checked:bg-emerald-500/);
  assert.match(markup, /<svg[^>]*text-white/);
  assert.match(markup, />Accepted</);
});

test("Card checkout is disabled until the current cart policy is accepted", () => {
  assert.match(
    cartDrawerSource,
    /onClick=\{handleStripeCheckout\}[\s\S]*?disabled=\{cartItems\.length === 0 \|\| !policyAcknowledged\}[\s\S]*?>\s*Card checkout/
  );
});

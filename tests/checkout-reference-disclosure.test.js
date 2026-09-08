import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const checkoutReference = await import(
  "../src/Components/CheckoutReferenceDisclosure.js"
).catch(() => ({}));

function renderReference(orderId) {
  if (!checkoutReference.default) return "";
  return renderToStaticMarkup(
    React.createElement(checkoutReference.default, { orderId })
  );
}

test("checkout reference is hidden behind a closed details disclosure", () => {
  const markup = renderReference("tssvKpEgdZjPInpGFMMF");

  assert.match(markup, /<details/);
  assert.match(markup, /Show checkout reference/);
  assert.match(markup, /tssvKpEgdZjPInpGFMMF/);
  assert.doesNotMatch(markup, /<details[^>]*\sopen(?:=|>)/);
});

test("checkout reference disclosure is omitted without a reference", () => {
  assert.equal(renderReference(null), "");
});

import test from "node:test";
import assert from "node:assert/strict";
import { parseContactContext, buildContactPayload } from "../src/utils/contactIntent.js";

test("missing, unsupported, and inherited object names fall back to general", () => {
  for (const query of ["", "?intent=unknown", "?intent=tattoo", "?intent=toString", "?intent=__proto__"]) {
    assert.equal(parseContactContext(query).intent, "general");
  }
});

test("all customer inquiry intents survive query parsing", () => {
  for (const intent of ["general", "custom-art", "print", "product", "original", "airbrush", "photoshop"]) {
    assert.equal(parseContactContext(`?intent=${intent}`).intent, intent);
  }
});

test("original artwork inquiries retain live product context", () => {
  const context = parseContactContext("?intent=original&product=adoration-in-the-lights-darkness&productName=Adoration%20Updated");
  assert.equal(context.intent, "original");
  assert.equal(context.product, "adoration-in-the-lights-darkness");
  assert.equal(context.productTitle, "Adoration Updated");
});

test("product and sold artwork slugs resolve to catalog titles", () => {
  const context = parseContactContext("?intent=print&piece=overwhelmed&product=alter-ego&source=shop%20card");
  assert.equal(context.piece, "overwhelmed");
  assert.equal(context.pieceTitle, "Overwhelmed");
  assert.equal(context.productTitle, "Alter Ego");
  assert.equal(context.source, "shop card");
});

test("unknown context remains identifiable without inventing a catalog match", () => {
  const context = parseContactContext("?intent=product&product=unknown-piece&piece=&source=%20portfolio%0Acard%20");
  assert.equal(context.product, "unknown-piece");
  assert.equal(context.productTitle, "");
  assert.equal(context.piece, "");
  assert.equal(context.source, "portfolio card");
  assert.equal(parseContactContext(`?source=${"a".repeat(300)}`).source.length, 200);
});

test("inquiry context reaches existing EmailJS message templates and structured fields", () => {
  const context = parseContactContext("?intent=print&piece=overwhelmed&source=portfolio");
  const payload = buildContactPayload({ name: "Sam", email: "sam@example.com", message: "Can I arrange pickup?" }, context, "test time");
  assert.equal(payload.name, "Sam");
  assert.equal(payload.email, "sam@example.com");
  assert.equal(payload.intent, "print");
  assert.equal(payload.piece, "overwhelmed");
  assert.equal(payload.source, "portfolio");
  assert.equal(payload.time, "test time");
  assert.ok(payload.message.startsWith("Can I arrange pickup?\n\n"));
  assert.match(payload.message, /Intent: print/);
  assert.match(payload.message, /Artwork: Overwhelmed \(overwhelmed\)/);
  assert.match(payload.message, /Source: portfolio/);
});

test("product inquiries retain the slug in email even when it cannot be resolved", () => {
  const payload = buildContactPayload({ name: "Sam", email: "sam@example.com", message: "Question" }, parseContactContext("?intent=product&product=unknown-piece"), "now");
  assert.match(payload.message, /Product: unknown-piece/);
  assert.equal(payload.product, "unknown-piece");
});

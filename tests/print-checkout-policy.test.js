import test from "node:test";
import assert from "node:assert/strict";
import * as printPolicy from "../src/utils/printCheckoutPolicy.js";

test("an unacknowledged made-to-order policy blocks checkout", async () => {
  let checkoutStarts = 0;
  const result = await printPolicy.startAcknowledgedPrintCheckout(false, async () => {
    checkoutStarts += 1;
  });

  assert.deepEqual(result, {
    started: false,
    error: "Please confirm the made-to-order print policy before checkout.",
  });
  assert.equal(checkoutStarts, 0);
});

test("an acknowledged made-to-order policy allows checkout", async () => {
  let checkoutFinished = false;
  const result = await printPolicy.startAcknowledgedPrintCheckout(true, async () => {
    await Promise.resolve();
    checkoutFinished = true;
  });

  assert.deepEqual(result, { started: true, error: "" });
  assert.equal(checkoutFinished, true);
});

test("an unchecked policy displays the full notice", () => {
  assert.equal(typeof printPolicy.getPrintPolicyDisclosureState, "function");
  assert.deepEqual(
    printPolicy.getPrintPolicyDisclosureState({
      acknowledged: false,
      reviewRequested: false,
    }),
    { acknowledged: false, expanded: true }
  );
});

test("an acknowledged policy displays the compact state", () => {
  assert.deepEqual(
    printPolicy.getPrintPolicyDisclosureState({
      acknowledged: true,
      reviewRequested: false,
    }),
    { acknowledged: true, expanded: false }
  );
});

test("an acknowledged policy can expand for review", () => {
  assert.deepEqual(
    printPolicy.getPrintPolicyDisclosureState({
      acknowledged: true,
      reviewRequested: true,
    }),
    { acknowledged: true, expanded: true }
  );
});

test("cart changes and cleared acknowledgement invalidate the checked state", () => {
  assert.equal(typeof printPolicy.isPrintPolicyAcknowledgedForCart, "function");
  assert.equal(
    printPolicy.isPrintPolicyAcknowledgedForCart("cart-a", "cart-a", 1),
    true
  );
  assert.equal(
    printPolicy.isPrintPolicyAcknowledgedForCart("cart-a", "cart-b", 1),
    false
  );
  assert.equal(
    printPolicy.isPrintPolicyAcknowledgedForCart(null, "cart-a", 1),
    false
  );
  assert.equal(
    printPolicy.isPrintPolicyAcknowledgedForCart("empty-cart", "empty-cart", 0),
    false
  );
});

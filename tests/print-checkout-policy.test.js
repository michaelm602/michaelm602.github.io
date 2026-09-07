import test from "node:test";
import assert from "node:assert/strict";
import { startAcknowledgedPrintCheckout } from "../src/utils/printCheckoutPolicy.js";

test("an unacknowledged made-to-order policy blocks checkout", async () => {
  let checkoutStarts = 0;
  const result = await startAcknowledgedPrintCheckout(false, async () => {
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
  const result = await startAcknowledgedPrintCheckout(true, async () => {
    await Promise.resolve();
    checkoutFinished = true;
  });

  assert.deepEqual(result, { started: true, error: "" });
  assert.equal(checkoutFinished, true);
});

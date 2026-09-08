import test from "node:test";
import assert from "node:assert/strict";

const paymentMethods = await import("../src/utils/checkoutPaymentMethods.js").catch(
  () => ({})
);

test("production checkout never enables browser-priced PayPal funding", () => {
  const result = paymentMethods.getCheckoutPaymentMethods?.({
    isProduction: true,
    paypalRequested: true,
    paypalBackendReady: true,
  });

  assert.deepEqual(result, {
    stripe: true,
    paypal: false,
    venmo: false,
    payLater: false,
    showPayPalButtons: false,
  });
});
test("PayPal funding remains disabled without its trusted backend", () => {
  const result = paymentMethods.getCheckoutPaymentMethods?.({
    isProduction: false,
    paypalRequested: true,
    paypalBackendReady: false,
  });

  assert.deepEqual(result, {
    stripe: true,
    paypal: false,
    venmo: false,
    payLater: false,
    showPayPalButtons: false,
  });
});

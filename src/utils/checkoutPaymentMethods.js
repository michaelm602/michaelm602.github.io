export const PAYPAL_CHECKOUT_UNAVAILABLE_MESSAGE =
  "PayPal checkout is temporarily unavailable. Please use card checkout.";

export function getCheckoutPaymentMethods({
  isProduction = false,
  paypalRequested = false,
  paypalBackendReady = false,
} = {}) {
  // Production stays fail-closed until PayPal create, capture, pricing, and
  // order persistence all run through a trusted backend.
  const paypalEnabled =
    !isProduction && paypalRequested === true && paypalBackendReady === true;

  return {
    stripe: true,
    paypal: paypalEnabled,
    venmo: paypalEnabled,
    payLater: paypalEnabled,
    showPayPalButtons: paypalEnabled,
  };
}

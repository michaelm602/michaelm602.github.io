export const PRINT_SALES_CONTACT_EMAIL = "airbrushnink@gmail.com";

export const PRINT_SALES_POLICY =
  "All print sales are final once submitted to production. Because prints are made to order through a professional print partner, cancellations, refunds, and exchanges are not available after production begins. If there is a problem with your order, contact airbrushnink@gmail.com and I'll work with the print partner to make it right where possible. If an order cannot be fulfilled or shipping is significantly delayed, I'll contact you with available options.";

export const PRINT_CHECKOUT_ACKNOWLEDGEMENT =
  "I understand this is a made-to-order print and sales are final once submitted to production.";

export const PRINT_CHECKOUT_ACKNOWLEDGEMENT_ERROR =
  "Please confirm the made-to-order print policy before checkout.";

export function getPrintPolicyDisclosureState({ acknowledged, reviewRequested }) {
  if (!acknowledged) {
    return { acknowledged: false, expanded: true };
  }

  return { acknowledged: true, expanded: Boolean(reviewRequested) };
}

export function isPrintPolicyAcknowledgedForCart(
  acknowledgedCartSignature,
  currentCartSignature,
  itemCount
) {
  return (
    itemCount > 0 &&
    Boolean(acknowledgedCartSignature) &&
    acknowledgedCartSignature === currentCartSignature
  );
}

export async function startAcknowledgedPrintCheckout(acknowledged, startCheckout) {
  if (!acknowledged) {
    return {
      started: false,
      error: PRINT_CHECKOUT_ACKNOWLEDGEMENT_ERROR,
    };
  }

  await startCheckout();
  return { started: true, error: "" };
}

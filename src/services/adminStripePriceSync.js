import { httpsCallable } from "firebase/functions";
import { cloudFunctions } from "../firebase";
import { createAdminStripePriceSyncClient } from "../utils/adminStripePriceSync";

const invokeStripeSync = httpsCallable(cloudFunctions, "adminStripePrintPriceSync");
const client = createAdminStripePriceSyncClient(async (request) => {
  const response = await invokeStripeSync(request);
  return response.data;
});

export const previewAdminStripePriceSync = client.preview;
export const confirmAdminStripePriceSync = client.confirm;
export const createMissingAdminStripePrices = client.create;

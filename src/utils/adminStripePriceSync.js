export function createAdminStripePriceSyncClient(invoke) {
  if (typeof invoke !== "function") throw new TypeError("Stripe sync callable is required.");
  return {
    preview(productId) {
      return invoke({ action: "preview", productId });
    },
    create(productId, operationId) {
      return invoke({ action: "create", productId, operationId });
    },
  };
}

export function formatAdminStripeSyncError(error) {
  const message = error?.message || "Stripe price sync failed.";
  return message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, "").trim();
}

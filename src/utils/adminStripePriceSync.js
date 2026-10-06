export function createAdminStripePriceSyncClient(invoke) {
  if (typeof invoke !== "function") throw new TypeError("Stripe sync callable is required.");
  return {
    preview(productId, proposedPrints) {
      return invoke({ action: "preview", productId, proposedPrints });
    },
    apply(productId, operationId) {
      return invoke({ action: "apply", productId, operationId });
    },
  };
}

export function buildAdminPrintProposal(product) {
  const prints = product?.prints || {};
  return {
    available: prints.available === true,
    defaultOptionId: typeof prints.defaultOptionId === "string" && prints.defaultOptionId
      ? prints.defaultOptionId
      : null,
    options: Array.isArray(prints.options)
      ? prints.options.map((option, index) => ({
          optionId: String(option?.id || "").trim(),
          label: String(option?.label || "").trim(),
          amountCents: option?.amountCents,
          currency: String(option?.currency || "").trim().toLowerCase(),
          active: option?.active === true,
          sortOrder: Number.isSafeInteger(Number(option?.sortOrder)) ? Number(option.sortOrder) : index,
        }))
      : [],
  };
}

export function adminPrintDraftChanged(draft, published) {
  return JSON.stringify(buildAdminPrintProposal(draft)) !== JSON.stringify(buildAdminPrintProposal(published));
}

export function getAdminStripeNormalizationMessage(sync, productTitle) {
  if (sync?.normalizationRequired !== true) return null;
  const title = String(productTitle || "").trim() || "artwork";
  return `Legacy Stripe setup detected. These print sizes are currently spread across multiple Stripe Products. Applying this plan will create or recover one canonical ${title} Product, resolve verified Prices for all retained options, and atomically update Firestore. Existing Stripe Products and Prices will remain untouched.`;
}

export function dollarsToAmountCents(value) {
  const normalized = String(value ?? "").trim();
  const match = /^(\d+)(?:\.(\d{0,2}))?$|^\.(\d{1,2})$/.exec(normalized);
  if (!match) return null;
  const dollars = Number(match[1] || 0);
  const cents = Number((match[2] || match[3] || "").padEnd(2, "0"));
  const amount = dollars * 100 + cents;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function amountCentsToDollarInput(amountCents) {
  return Number.isSafeInteger(Number(amountCents)) && Number(amountCents) > 0
    ? (Number(amountCents) / 100).toFixed(2)
    : "";
}

export function formatAdminStripeSyncError(error) {
  const message = error?.message || "Stripe price sync failed.";
  return message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, "").trim();
}

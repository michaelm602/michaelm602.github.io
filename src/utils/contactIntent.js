import { getAllProducts } from "../data/products.js";

export const CONTACT_INTENTS = {
  general: {
    heading: "Contact the Artist",
    helper: "Have a question? Tell me what you need help with.",
  },
  "custom-art": {
    heading: "Request Custom Artwork",
    helper: "Share your idea, preferred size, budget, and any date you have in mind. We can discuss the details together.",
  },
  print: {
    heading: "Ask About a Print",
    helper: "An original may be sold while prints are still available. Ask about print sizes or shipping. Prints are made to order and fulfilled by a professional print partner.",
  },
  product: {
    heading: "Ask About This Print",
    helper: "Ask a question about this print before ordering, including size or shipping. Prints are made to order and fulfilled by a professional print partner.",
  },
  airbrush: {
    heading: "Ask About Airbrush Work",
    helper: "Describe your airbrush idea, the surface or item, approximate size, and any timing you have in mind.",
  },
  photoshop: {
    heading: "Request Design Work",
    helper: "Tell me about your design or photo-editing idea, how you plan to use it, and any timing you have in mind.",
  },
};

export function parseContactContext(search) {
  const params = new URLSearchParams(search);
  const requestedIntent = params.get("intent");
  const intent = Object.hasOwn(CONTACT_INTENTS, requestedIntent) ? requestedIntent : "general";
  const readContext = (key) => (params.get(key) || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const product = readContext("product");
  const piece = readContext("piece");
  const catalog = getAllProducts();
  const titleFor = (slug) => catalog.find((entry) => entry.slug === slug)?.title || "";

  return { intent, product, piece, source: readContext("source"), productTitle: titleFor(product), pieceTitle: titleFor(piece) };
}

export function buildContactPayload(formData, context, time) {
  const describe = (slug, title) => title ? `${title} (${slug})` : slug;
  const requestContext = [
    `Intent: ${context.intent}`,
    context.product && `Product: ${describe(context.product, context.productTitle)}`,
    context.piece && `Artwork: ${describe(context.piece, context.pieceTitle)}`,
    context.source && `Source: ${context.source}`,
  ].filter(Boolean).join("\n");

  return {
    ...formData,
    ...context,
    title: CONTACT_INTENTS[context.intent].heading,
    // Keep context in the existing template's message field as well as separate fields.
    message: `${formData.message}\n\n--- Inquiry context ---\n${requestContext}`,
    request_context: requestContext,
    time,
  };
}

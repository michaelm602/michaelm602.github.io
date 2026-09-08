import React from "react";

export default function CheckoutReferenceDisclosure({ orderId, className = "" }) {
  if (!orderId) return null;

  return React.createElement(
    "details",
    { className: `text-left text-xs text-zinc-400 ${className}`.trim() },
    React.createElement(
      "summary",
      {
        className:
          "cursor-pointer list-none underline underline-offset-2 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
      },
      "Show checkout reference"
    ),
    React.createElement(
      "div",
      { className: "mt-2 border border-white/10 bg-white/[0.03] p-3" },
      React.createElement(
        "p",
        { className: "mb-1 uppercase tracking-widest text-zinc-500" },
        "Checkout reference"
      ),
      React.createElement(
        "code",
        { className: "break-all text-sm text-zinc-300" },
        orderId
      )
    )
  );
}

import React from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { getOriginalPresentation } from "../utils/storefrontProduct.js";

export default function OriginalAvailability({ product, compact = false }) {
  const presentation = getOriginalPresentation(product);
  if (!presentation.visible) return null;

  return React.createElement(
    "section",
    {
      "aria-label": "Original artwork availability",
      className: compact
        ? "mb-3 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-left"
        : "mb-6 rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 sm:p-5",
    },
    React.createElement(
      "p",
      { className: "text-sm font-semibold text-amber-100" },
      presentation.label
    ),
    presentation.details.length > 0
      ? React.createElement(
          "p",
          { className: "mt-1 text-sm text-zinc-300" },
          presentation.details.join(" | ")
        )
      : null,
    presentation.contactPath
      ? React.createElement(
          Link,
          {
            to: presentation.contactPath,
            className:
              "mt-3 inline-flex text-sm font-semibold text-white underline underline-offset-4",
          },
          compact ? "Ask About Original" : "Contact to purchase"
        )
      : null
  );
}

OriginalAvailability.propTypes = {
  product: PropTypes.shape({
    slug: PropTypes.string,
    original: PropTypes.object,
  }),
  compact: PropTypes.bool,
};

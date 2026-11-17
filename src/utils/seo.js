import { PAGE_COPY } from "../content/pageCopy.js";

export const SITE_URL = "https://www.likwitblvd.com";
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/og-image.png`;
export const STATIC_PUBLIC_ROUTES = Object.keys(PAGE_COPY);
export const UTILITY_ROUTES = [
  "/admin", "/admin/artwork", "/admin/home", "/admin/products",
  "/login", "/upload", "/success", "/cancel",
];

const PAGE_TITLES = {
  "/": "Portland Airbrush Art, Prints & Commissions | Likwit Blvd",
  "/portfolio": "Airbrush & Digital Art Portfolio | Likwit Blvd",
  "/portfolio/airbrush": "Airbrush Art by a Portland Artist | Likwit Blvd",
  "/portfolio/photoshop": "Photoshop & Digital Art Portfolio | Likwit Blvd",
  "/gallery": "Artwork Gallery | Airbrush & Digital Art | Likwit Blvd",
  "/shop": "Airbrush Art Prints | Likwit Blvd",
  "/contact": "Art Commissions & Questions | Contact Likwit Blvd",
};

const PAGE_DESCRIPTIONS = {
  "/": "Explore airbrush artwork and made-to-order prints by Portland artist Michael Maldonado. Browse Likwit Blvd's portfolio or request custom artwork.",
  "/portfolio": "Explore airbrush artwork and Photoshop projects by Michael Maldonado of Likwit Blvd. Browse the collections and ask about a custom artwork or design project.",
  "/portfolio/airbrush": "Explore airbrush and acrylic artwork by Portland artist Michael Maldonado. View the collection, browse prints, or ask about a custom airbrush project.",
  "/portfolio/photoshop": "Explore Photoshop, digital artwork, and photo-editing projects from Likwit Blvd. Share your image or design idea to discuss a custom project.",
  "/gallery": "Browse airbrush artwork and digital creations by Michael Maldonado of Likwit Blvd. Explore the portfolio and find your next piece.",
  "/shop": "Shop made-to-order prints of Likwit Blvd airbrush artwork. Explore each piece and its sizes. Print orders are fulfilled by a professional print partner.",
  "/contact": "Contact Michael Maldonado at Likwit Blvd about custom artwork, airbrush projects, digital design, originals, or prints. Share your idea and project details.",
};

export function normalizeSeoPath(value = "/") {
  const path = String(value).split(/[?#]/, 1)[0];
  if (!path.startsWith("/") || path.startsWith("//")) return "/not-found";
  return path.replace(/\/+$/, "") || "/";
}

export function isProductPath(path) {
  return /^\/shop\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizeSeoPath(path));
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function publicImage(value) {
  if (typeof value !== "string" || !value) return DEFAULT_SOCIAL_IMAGE;
  try {
    const url = new URL(value, SITE_URL);
    return url.protocol === "https:" ? url.href : DEFAULT_SOCIAL_IMAGE;
  } catch {
    return DEFAULT_SOCIAL_IMAGE;
  }
}

function structuredDataFor(path, metadata, product) {
  const artistId = `${SITE_URL}/#artist`;
  const websiteId = `${SITE_URL}/#website`;
  const graph = [
    {
      "@type": "Person",
      "@id": artistId,
      name: "Michael Maldonado",
      jobTitle: "Artist",
      url: `${SITE_URL}/`,
      description: "The artist behind Likwit Blvd in Portland, Oregon, creating airbrush, acrylic, and digital artwork.",
      sameAs: [
        "https://www.instagram.com/likwitblvd/",
        "https://www.facebook.com/profile.php?id=61587425201456",
        "https://www.tiktok.com/@likwitblvd",
      ],
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      name: "Likwit Blvd",
      url: `${SITE_URL}/`,
      publisher: { "@id": artistId },
    },
    {
      "@type": path === "/contact" ? "ContactPage" : "WebPage",
      "@id": `${metadata.canonical}#webpage`,
      url: metadata.canonical,
      name: metadata.title,
      description: metadata.description,
      isPartOf: { "@id": websiteId },
      about: { "@id": product ? `${metadata.canonical}#artwork` : artistId },
    },
  ];

  if (product) {
    // Artwork identity only. A build snapshot is not an inventory or price authority.
    graph.push({
      "@type": "VisualArtwork",
      "@id": `${metadata.canonical}#artwork`,
      name: product.title,
      url: metadata.canonical,
      creator: { "@id": artistId },
      ...(product.description ? { description: product.description } : {}),
      ...(metadata.image !== DEFAULT_SOCIAL_IMAGE ? { image: metadata.image } : {}),
      ...(product.original?.medium ? { artMedium: product.original.medium } : {}),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function getPageSeo(value, { product = null, imageUrl = null, missing = false } = {}) {
  const path = normalizeSeoPath(value);
  const isUtility = UTILITY_ROUTES.includes(path) || path.startsWith("/admin/");
  const productRoute = isProductPath(path);
  const isPublic = !missing && (STATIC_PUBLIC_ROUTES.includes(path) || productRoute);
  const currentProduct = productRoute && product?.slug && path === `/shop/${product.slug}` ? product : null;

  let title = PAGE_TITLES[path];
  let description = PAGE_DESCRIPTIONS[path];
  if (currentProduct) {
    title = currentProduct.seo?.title?.trim() || `${currentProduct.title} | Likwit Blvd Artwork`;
    description = currentProduct.seo?.description?.trim() || currentProduct.description?.trim() ||
      `Explore ${currentProduct.title} by Michael Maldonado of Likwit Blvd. View the artwork and its current options, or contact the artist with a question.`;
  } else if (productRoute && !missing) {
    title = "Artwork | Likwit Blvd";
    description = "Explore artwork by Michael Maldonado of Likwit Blvd and view its current details.";
  } else if (!isPublic) {
    title = isUtility ? "Account & Order Pages | Likwit Blvd" : "Page Not Found | Likwit Blvd";
    description = isUtility ? "Likwit Blvd account and order tools." : "This page could not be found. Browse the Likwit Blvd portfolio or shop, or contact the artist.";
  }

  const metadata = {
    title,
    description,
    canonical: isPublic ? `${SITE_URL}${path === "/" ? "/" : path}` : null,
    robots: isPublic ? "index, follow, max-image-preview:large" : "noindex, follow",
    image: publicImage(imageUrl),
    type: currentProduct ? "product" : "website",
    structuredData: null,
  };
  if (isPublic) metadata.structuredData = structuredDataFor(path, metadata, currentProduct);
  return metadata;
}

export function applyPageMetadata(document, metadata) {
  document.title = metadata.title;
  const setMeta = (attribute, key, value) => {
    const matches = [...document.querySelectorAll(`meta[${attribute}="${key}"]`)];
    const element = matches.shift() || document.createElement("meta");
    for (const duplicate of matches) duplicate.remove();
    element.setAttribute(attribute, key);
    element.setAttribute("content", value);
    if (!element.parentNode) document.head.appendChild(element);
  };

  setMeta("name", "description", metadata.description);
  setMeta("name", "robots", metadata.robots);
  for (const [key, value] of Object.entries({
    "og:title": metadata.title,
    "og:description": metadata.description,
    "og:type": metadata.type,
    "og:url": metadata.canonical || "",
    "og:image": metadata.image,
    "og:site_name": "Likwit Blvd",
  })) setMeta("property", key, value);
  for (const [key, value] of Object.entries({
    "twitter:card": "summary_large_image",
    "twitter:title": metadata.title,
    "twitter:description": metadata.description,
    "twitter:image": metadata.image,
  })) setMeta("name", key, value);

  const canonicals = [...document.querySelectorAll('link[rel="canonical"]')];
  const canonical = canonicals.shift() || document.createElement("link");
  for (const duplicate of canonicals) duplicate.remove();
  if (metadata.canonical) {
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", metadata.canonical);
    if (!canonical.parentNode) document.head.appendChild(canonical);
  } else canonical.remove();

  let structured = document.getElementById("page-structured-data");
  if (metadata.structuredData) {
    if (!structured) {
      structured = document.createElement("script");
      structured.id = "page-structured-data";
      structured.type = "application/ld+json";
      document.head.appendChild(structured);
    }
    structured.textContent = serializeJsonLd(metadata.structuredData);
  } else structured?.remove();
}

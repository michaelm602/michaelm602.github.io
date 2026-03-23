// src/pages/ProductDetailPage.jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { storage } from "../firebase";
import { ref, getDownloadURL, listAll } from "firebase/storage";
import { useCart } from "../Components/CartContext";
import { sizePriceMap } from "../utils/sizePricing";
import { products } from "../data/products";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

const minPrice = Math.min(...Object.values(sizePriceMap));

export default function ProductDetailPage() {
  const { slug } = useParams();
  const product = products.find((p) => p.slug === slug) || null;

  const [imageUrl, setImageUrl] = useState(null);       // thumb — shown in hero frame
  const [lightboxUrl, setLightboxUrl] = useState(null); // full — shown in zoom/lightbox
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { addToCart } = useCart();

  // SEO metadata
  useEffect(() => {
    if (!product) return;

    const title = `${product.title} — Airbrush Artwork Print | Likwit Blvd`;
    const description = `${product.title} — original airbrush artwork print. Hand-finished and made to order.`;

    document.title = title;

    const setMeta = (property, content, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", "product", "property");
    if (imageUrl) setMeta("og:image", imageUrl, "property");

    // Canonical
    const canonicalHref = `https://www.likwitblvd.com/shop/${product.slug}`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalHref);

    return () => {
      document.title = "Likwit Blvd";
      canonical.removeAttribute("href");
    };
  }, [product?.title, product?.slug, imageUrl]);

  // Single listAll — fetches main image + related products in one Firebase round-trip
  useEffect(() => {
    if (!product) return;
    let alive = true;

    setImageUrl(null);
    setLightboxUrl(null);
    setImageError(false);
    setImageLoaded(false);
    setRelatedProducts([]);

    const fetchImages = async () => {
      try {
        const result = await listAll(ref(storage, "airbrush"));

        // Build a map: titleRaw → { fullRef, thumbRef }
        const byTitle = new Map();

        for (const itemRef of result.items) {
          if (!/\.(webp|jpg|jpeg|png)$/i.test(itemRef.name)) continue;

          const isThumb = itemRef.name.toLowerCase().endsWith("__thumb.webp");
          const titleRaw = isThumb
            ? itemRef.name.replace(/\.[^.]+$/, "").replace(/__thumb$/i, "")
            : itemRef.name.replace(/\.[^.]+$/, "").split("__")[0];

          if (!byTitle.has(titleRaw)) byTitle.set(titleRaw, {});
          const entry = byTitle.get(titleRaw);
          if (isThumb) { if (!entry.thumbRef) entry.thumbRef = itemRef; }
          else         { if (!entry.fullRef)  entry.fullRef  = itemRef; }
        }

        // Main product refs
        const mainEntry = byTitle.get(product.title) || {};
        const mainFullRef  = mainEntry.fullRef  || null;
        const mainThumbRef = mainEntry.thumbRef || mainEntry.fullRef || null;

        // Related candidates (up to 3, thumb preferred)
        const seenTitles = new Set([product.title]);
        const relatedCandidates = [];

        for (const [titleRaw, entry] of byTitle) {
          if (relatedCandidates.length >= 3) break;
          if (seenTitles.has(titleRaw)) continue;
          const match = products.find((p) => p.title === titleRaw);
          if (match) {
            seenTitles.add(titleRaw);
            relatedCandidates.push({ product: match, thumbRef: entry.thumbRef || entry.fullRef });
          }
        }

        // Fetch all URLs concurrently
        const [mainFullUrl, mainThumbUrl, ...relatedThumbUrls] = await Promise.all([
          mainFullRef  ? getDownloadURL(mainFullRef)  : Promise.resolve(null),
          mainThumbRef ? getDownloadURL(mainThumbRef) : Promise.resolve(null),
          ...relatedCandidates.map(({ thumbRef }) => getDownloadURL(thumbRef)),
        ]);

        if (!alive) return;

        if (mainThumbUrl) {
          setImageUrl(mainThumbUrl);
        } else if (mainFullUrl) {
          setImageUrl(mainFullUrl); // fallback: no thumb, use full
        } else {
          console.error(`Product image load failed — no Firebase file matched title: "${product.title}"`);
          setImageError(true);
        }

        setLightboxUrl(mainFullUrl);

        setRelatedProducts(
          relatedCandidates.map((c, i) => ({ ...c.product, imageUrl: relatedThumbUrls[i] }))
        );
      } catch (err) {
        console.error(`Image fetch failed for: "${product.title}"`, err);
        if (alive) setImageError(true);
      }
    };

    fetchImages();
    return () => { alive = false; };
  }, [product?.title]);

  // 404 — rendered after all hooks
  if (!product) {
    return (
      <div
        style={{
          background: "#0a0a0a",
          minHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
        }}
      >
        <p style={{ color: "#555", fontSize: "14px", letterSpacing: "1px" }}>
          This piece isn't here.
        </p>
        <Link
          to="/shop"
          style={{
            color: "#555",
            fontSize: "10px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            borderBottom: "1px solid #333",
            paddingBottom: "2px",
          }}
        >
          Browse the collection →
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    addToCart({
      title: product.title,
      size: selectedSize,
      quantity: Number(selectedQuantity),
      price: sizePriceMap[selectedSize],
      image: imageUrl,
    });
    window.dispatchEvent(new Event("open-cart"));
  };

  return (
    <>
    <div style={{ background: "#0a0a0a", minHeight: "100vh", fontFamily: "Georgia, serif" }}>

      {/* ── SECTION 1: Split Panel ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          minHeight: "360px",
          background: "#0a0a0a",
        }}
      >
        {/* Left: Image Panel */}
        <div
          style={{
            flex: 6,
            height: "calc(85vh - 4rem)",
            maxHeight: "700px",
            background: "#090909",
            borderRight: "1px solid #141414",
            position: "sticky",
            top: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            padding: "12px",
          }}
        >
          {/* Ambient glow */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 70% 65% at 50% 50%, rgba(120,110,100,0.09) 0%, transparent 65%), radial-gradient(ellipse 40% 40% at 50% 50%, rgba(90,80,70,0.07) 0%, transparent 55%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          {/* Image container — reserves aspect-ratio space while loading */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                height: "100%",
                maxHeight: "100%",
                aspectRatio: "4/5",
                background: "linear-gradient(150deg, #242424, #141414)",
                border: "1px solid #282828",
                boxShadow:
                  "0 8px 60px rgba(0,0,0,0.95), 0 0 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {imageError ? (
                <span style={{ color: "#333", fontSize: "10px", letterSpacing: "1px" }}>
                  Image unavailable
                </span>
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.title}
                  decoding="async"
                  fetchPriority="high"
                  onLoad={() => setImageLoaded(true)}
                  onClick={() => setLightboxOpen(true)}
                  style={{
                    height: "100%",
                    maxHeight: "100%",
                    width: "100%",
                    objectFit: "contain",
                    cursor: "zoom-in",
                    opacity: imageLoaded ? 1 : 0,
                    transition: "opacity 0.25s ease",
                  }}
                />
              ) : (
                <span style={{ color: "#2a2a2a", fontSize: "8px", letterSpacing: "3px", textTransform: "uppercase" }}>
                  {product.title}
                </span>
              )}
            </div>

            {/* Zoom hint — only shown when image is loaded */}
            {imageUrl && (
              <div
                onClick={() => setLightboxOpen(true)}
                style={{
                  position: "absolute",
                  bottom: "4px",
                  right: "4px",
                  fontSize: "12px",
                  color: "#71717a",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  cursor: "zoom-in",
                }}
              >
                ⊕ Click to zoom
              </div>
            )}
          </div>
        </div>

        {/* Right: Purchase Stack */}
        <div
          style={{
            flex: 4,
            display: "flex",
            flexDirection: "column",
            padding: "28px 20px 24px",
            background: "#0a0a0a",
          }}
        >
          {/* Category */}
          <div
            style={{
              fontSize: "7px",
              color: "#3a3a3a",
              letterSpacing: "4px",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            {product.category}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: "30px",
              fontWeight: 600,
              color: "#ffffff",
              letterSpacing: "-0.5px",
              lineHeight: 1.1,
              marginBottom: "7px",
            }}
          >
            {product.title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: "16px",
              color: "#e4e4e7",
              lineHeight: 1.625,
              marginBottom: "5px",
            }}
          >
            {product.description}
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "14px",
              color: "#a1a1aa",
              fontStyle: "italic",
              marginBottom: "22px",
              paddingBottom: "18px",
              borderBottom: "1px solid #161616",
            }}
          >
            {product.tagline}
          </div>

          {/* Price */}
          <div style={{ marginBottom: "4px" }}>
            <span style={{ fontSize: "18px", color: "#ffffff", letterSpacing: "1px" }}>From </span>
            <span style={{ color: "#ffffff", fontSize: "20px", fontWeight: 500, letterSpacing: "-0.5px" }}>
              ${minPrice}
            </span>
            <span style={{ fontSize: "14px", color: "#a1a1aa", marginLeft: "6px", letterSpacing: "1px" }}>
              · 4 sizes
            </span>
          </div>

          {/* Scarcity */}
          <div
            style={{
              fontSize: "9px",
              color: "#555",
              marginBottom: "18px",
              letterSpacing: "0.3px",
            }}
          >
            Limited run — once it's gone, it's gone.
          </div>

          {/* Size selector */}
          <div style={{ marginBottom: "10px" }}>
            <div
              style={{
                fontSize: "12px",
                color: "#a1a1aa",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: "5px",
              }}
            >
              Size
            </div>
            <select
              value={selectedSize}
              onChange={(e) => {
                setSelectedSize(e.target.value);
                if (e.target.value) setSizeError(false);
              }}
              style={{
                width: "100%",
                background: "#0f0f0f",
                border: `1px solid ${sizeError ? "#553333" : "#1e1e1e"}`,
                borderRadius: "2px",
                padding: "9px 12px",
                color: selectedSize ? "#e4e4e7" : "#71717a",
                fontSize: "16px",
                appearance: "none",
                cursor: "pointer",
              }}
            >
              <option value="" disabled>Select size</option>
              {Object.keys(sizePriceMap).map((size) => (
                <option key={size} value={size} style={{ background: "#111" }}>
                  {size} — ${sizePriceMap[size]}
                </option>
              ))}
            </select>
            <div
              style={{
                fontSize: "7px",
                color: "#2a2a2a",
                marginTop: "4px",
                letterSpacing: "1px",
              }}
            >
              16×20 · 18×24 · 24×36 · 30×40
            </div>
            {sizeError && (
              <div style={{ fontSize: "9px", color: "#664444", marginTop: "4px" }}>
                Please select a size
              </div>
            )}
          </div>

          {/* Quantity selector */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "12px",
                color: "#a1a1aa",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: "5px",
              }}
            >
              Quantity
            </div>
            <select
              value={selectedQuantity}
              onChange={(e) => setSelectedQuantity(e.target.value)}
              style={{
                width: "100%",
                background: "#0f0f0f",
                border: "1px solid #1e1e1e",
                borderRadius: "2px",
                padding: "9px 12px",
                color: "#e4e4e7",
                fontSize: "16px",
                appearance: "none",
                cursor: "pointer",
              }}
            >
              {[1, 2, 3, 4, 5].map((q) => (
                <option key={q} value={q} style={{ background: "#111" }}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleAddToCart}
            style={{
              background: "linear-gradient(to right, #151515, #2c2c2c)",
              border: "1px solid #3c3c3c",
              borderRadius: "2px",
              padding: "14px",
              textAlign: "center",
              color: "#e8e8e8",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "0.025em",
              textTransform: "uppercase",
              marginBottom: "12px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.6)",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Own This Piece
          </button>

          {/* Trust strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px 0",
              borderTop: "1px solid #161616",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "14px", color: "#d4d4d8", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
              Hand-finished, made to order
            </span>
            <span style={{ color: "#2a2a2a", fontSize: "10px" }}>·</span>
            <span style={{ fontSize: "14px", color: "#d4d4d8", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
              Stripe &amp; PayPal
            </span>
            <span style={{ color: "#2a2a2a", fontSize: "10px" }}>·</span>
            <span style={{ fontSize: "14px", color: "#d4d4d8", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
              Ships in 7–10 days
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Related Products ── */}
      {relatedProducts.length > 0 && (
        <div
          style={{
            background: "#070707",
            padding: "32px 20px",
            borderTop: "1px solid #111",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "#71717a",
                letterSpacing: "4px",
                textTransform: "uppercase",
              }}
            >
              More From the Collection
            </div>
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            {relatedProducts.map((related) => (
              <Link
                key={related.slug}
                to={`/shop/${related.slug}`}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "9px",
                  textDecoration: "none",
                  cursor: "pointer",
                }}
                className="related-card"
              >
                <div
                  style={{
                    background: "linear-gradient(145deg, #181818, #0f0f0f)",
                    aspectRatio: "4/5",
                    border: "1px solid #1c1c1c",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                    overflow: "hidden",
                    transition: "transform 0.25s ease, border-color 0.25s ease",
                    willChange: "transform",
                  }}
                >
                  <img
                    src={related.imageUrl}
                    alt={related.title}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      transition: "transform 0.25s ease",
                    }}
                  />
                </div>
                <div style={{ fontSize: "16px", color: "#ffffff", fontWeight: 500 }}>{related.title}</div>
                <div style={{ fontSize: "15px", color: "#d4d4d8" }}>From ${minPrice}</div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#e4e4e7",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    borderBottom: "1px solid #282828",
                    paddingBottom: "3px",
                    display: "inline-block",
                    transition: "color 0.2s ease, border-color 0.2s ease",
                  }}
                >
                  View Piece →
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 3: Commission CTA ── */}
      <div
        style={{
          background: "#0b0b0b",
          borderTop: "1px solid #111",
          padding: "36px 20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            color: "#71717a",
            letterSpacing: "4px",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          Commission Original Work
        </div>
        <div
          style={{
            fontSize: "26px",
            color: "#ffffff",
            fontWeight: 600,
            marginBottom: "8px",
            letterSpacing: "-0.4px",
          }}
        >
          Tell me what you carry.
        </div>
        <div
          style={{
            fontSize: "16px",
            color: "#d4d4d8",
            marginBottom: "22px",
            maxWidth: "320px",
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.8,
          }}
        >
          Every custom piece starts with a conversation. Bring the concept — I'll bring it to life.
        </div>
        <Link
          to="/contact"
          style={{
            display: "inline-block",
            border: "1px solid #333",
            borderRadius: "2px",
            padding: "12px 30px",
            fontSize: "13px",
            color: "#888",
            letterSpacing: "3px",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Start a Commission
        </Link>
      </div>

    </div>

    {imageUrl && (
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={[{ src: lightboxUrl || imageUrl, alt: product.title }]}
        animation={{ fade: 250 }}
        styles={{
          container: {
            backdropFilter: "blur(10px)",
            backgroundColor: "rgba(0,0,0,0.92)",
            WebkitBackdropFilter: "blur(10px)",
          },
        }}
      />
    )}
    </>
  );
}

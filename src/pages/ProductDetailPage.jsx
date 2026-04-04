import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDownloadURL, ref } from "firebase/storage";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useCart } from "../Components/CartContext";
import {
  getAllProducts,
  getPrimaryProductImage,
  getProductBySlug,
  getProductMinPrice,
  getProductPrice,
  getProductSizeOptions,
  getRelatedProducts,
} from "../data/products";
import { resolveProductImageUrl } from "../utils/productImageUrls";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const product = getProductBySlug(slug);
  const allProducts = useMemo(() => getAllProducts(), []);
  const relatedBaseProducts = useMemo(
    () => (product ? getRelatedProducts(product, allProducts) : []),
    [product, allProducts]
  );

  const [imageUrl, setImageUrl] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sizeSectionRef = useRef(null);

  const { addToCart } = useCart();
  const sizeOptions = getProductSizeOptions(product);
  const primaryImage = getPrimaryProductImage(product);
  const minPrice = getProductMinPrice(product);
  const selectedPrice = selectedSize ? getProductPrice(product, selectedSize) : null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (!product) return;

    const title = product.seo?.title || `${product.title} - Airbrush Artwork Print | Likwit Blvd`;
    const description =
      product.seo?.description ||
      `${product.title} original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.`;

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
    setMeta("og:url", `https://www.likwitblvd.com/shop/${product.slug}`, "property");
    if (imageUrl) setMeta("og:image", imageUrl, "property");

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
  }, [product, imageUrl]);

  useEffect(() => {
    if (!product || !primaryImage) return;
    let alive = true;

    setImageUrl(null);
    setLightboxUrl(null);
    setImageError(false);
    setImageLoaded(false);
    setRelatedProducts([]);

    const fetchImages = async () => {
      try {
        const relatedEntries = await Promise.all(
          relatedBaseProducts.map(async (relatedProduct) => {
            const relatedImage = getPrimaryProductImage(relatedProduct);
            const relatedUrl = await resolveProductImageUrl(relatedImage, "thumb");

            return { ...relatedProduct, imageUrl: relatedUrl };
          })
        );

        const [thumbUrl, fullUrl] = await Promise.all([
          resolveProductImageUrl(primaryImage, "thumb"),
          resolveProductImageUrl(primaryImage, "full"),
        ]);

        if (!alive) return;

        setImageUrl(thumbUrl || fullUrl);
        setLightboxUrl(fullUrl || thumbUrl);
        setRelatedProducts(relatedEntries);

        if (!thumbUrl && !fullUrl) {
          setImageError(true);
        }
      } catch (error) {
        console.error(`Image fetch failed for: "${product.title}"`, error);
        if (alive) setImageError(true);
      }
    };

    fetchImages();
    return () => {
      alive = false;
    };
  }, [product, primaryImage, relatedBaseProducts]);

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
          Browse the collection -
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }

    const price = getProductPrice(product, selectedSize);
    if (price == null) {
      setSizeError(true);
      return;
    }

    setSizeError(false);
    addToCart({
      productId: product.id,
      title: product.title,
      size: selectedSize,
      quantity: Number(selectedQuantity),
      price,
      image: imageUrl,
    });
    window.dispatchEvent(new Event("open-cart"));
  };

  const handleStickyCta = () => {
    if (!selectedSize) {
      setSizeError(true);
      sizeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    handleAddToCart();
  };

  const trustPoints = [
    "Made to order - never mass produced",
    "Crafted individually with care",
    "Secure checkout with Stripe & PayPal",
    "Ships in 7-10 days",
  ];

  return (
    <>
      <div
        style={{
          background: "#0a0a0a",
          minHeight: "100vh",
          fontFamily: "Georgia, serif",
          paddingBottom: isMobile ? "calc(92px + env(safe-area-inset-bottom, 0px))" : 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: isMobile ? "10px 16px" : "10px 20px",
            borderBottom: "1px solid #141414",
          }}
        >
          <Link
            to="/shop"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              color: "#71717a",
              letterSpacing: "2px",
              textTransform: "uppercase",
              textDecoration: "none",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#a1a1aa")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to Shop
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "flex-start",
            minHeight: "360px",
            background: "#0a0a0a",
          }}
        >
          <div
            style={{
              flex: isMobile ? "none" : 6,
              height: isMobile ? "min(48vh, 420px)" : "calc(85vh - 4rem)",
              maxHeight: isMobile ? "420px" : "700px",
              minHeight: isMobile ? "280px" : "360px",
              background: "#090909",
              borderRight: isMobile ? "none" : "1px solid #141414",
              borderBottom: isMobile ? "1px solid #141414" : "none",
              position: isMobile ? "relative" : "sticky",
              top: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              padding: isMobile ? "12px 12px 18px" : "12px",
            }}
          >
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
                  width: isMobile ? "100%" : "auto",
                  maxWidth: "100%",
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
                    alt={primaryImage?.alt || product.title}
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

              {imageUrl && (
                <div
                  onClick={() => setLightboxOpen(true)}
                  style={{
                    position: "absolute",
                    bottom: isMobile ? "-2px" : "4px",
                    right: "4px",
                    fontSize: "11px",
                    color: "#8a8a94",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    cursor: "zoom-in",
                    background: "rgba(10,10,10,0.72)",
                    padding: "6px 8px",
                    border: "1px solid #1d1d1d",
                    borderRadius: "999px",
                  }}
                >
                  + Click to zoom
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              flex: isMobile ? "none" : 4,
              display: "flex",
              flexDirection: "column",
              padding: isMobile ? "20px 16px 24px" : "28px 24px 28px",
              background: "#0a0a0a",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                color: "#5a5a5a",
                letterSpacing: "4px",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}
            >
              {product.category}
            </div>

            <div
              style={{
                fontSize: isMobile ? "34px" : "38px",
                fontWeight: 600,
                color: "#ffffff",
                letterSpacing: "-0.7px",
                lineHeight: 1.02,
                marginBottom: "12px",
              }}
            >
              {product.title}
            </div>

            <div
              style={{
                fontSize: isMobile ? "18px" : "19px",
                color: "#f2f2f2",
                lineHeight: 1.45,
                marginBottom: "18px",
                maxWidth: "30rem",
              }}
            >
              {product.shortDescription}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "15px", color: "#b8b8bf", letterSpacing: "1px", textTransform: "uppercase" }}>
                From
              </span>
              <span
                style={{
                  color: "#ffffff",
                  fontSize: isMobile ? "30px" : "34px",
                  fontWeight: 600,
                  letterSpacing: "-0.8px",
                  lineHeight: 1,
                }}
              >
                ${minPrice}
              </span>
              <span style={{ fontSize: "14px", color: "#8f8f97", marginBottom: "2px" }}>
                {sizeOptions.length} sizes available
              </span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                alignSelf: "flex-start",
                marginBottom: "18px",
                padding: "8px 12px",
                border: "1px solid rgba(163, 137, 98, 0.28)",
                background: "linear-gradient(180deg, rgba(38,33,28,0.78), rgba(16,16,16,0.6))",
                color: "#dcc6a3",
                fontSize: "12px",
                letterSpacing: "1.1px",
                textTransform: "uppercase",
                borderRadius: "999px",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#c89d61" }} />
              Limited run - once it's gone, it's gone
            </div>

            <button
              onClick={handleAddToCart}
              style={{
                background: "linear-gradient(135deg, #f1f1f1 0%, #d5d5d5 100%)",
                border: "1px solid rgba(255,255,255,0.45)",
                borderRadius: "3px",
                padding: isMobile ? "16px 18px" : "17px 20px",
                textAlign: "center",
                color: "#080808",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "14px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                cursor: "pointer",
                width: "100%",
              }}
            >
              Claim This Artwork
            </button>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: "10px",
                marginBottom: "20px",
                padding: isMobile ? "14px" : "14px 16px",
                border: "1px solid #191919",
                background: "linear-gradient(180deg, rgba(20,20,20,0.96), rgba(9,9,9,0.96))",
              }}
            >
              {trustPoints.map((point) => (
                <div
                  key={point}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    color: "#d7d7db",
                    fontSize: "13px",
                    lineHeight: 1.45,
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "999px",
                      background: "#7f7f87",
                      marginTop: "7px",
                      flexShrink: 0,
                    }}
                  />
                  <span>{point}</span>
                </div>
              ))}
            </div>

            <div ref={sizeSectionRef} style={{ marginBottom: "18px", scrollMarginTop: isMobile ? "96px" : "24px" }}>
              <div
                style={{
                  fontSize: "12px",
                  color: "#a1a1aa",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                Choose Size
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr",
                  gap: "10px",
                }}
              >
                {sizeOptions.map((size) => {
                  const isSelected = selectedSize === size.label;

                  return (
                    <button
                      key={size.label}
                      type="button"
                      onClick={() => {
                        setSelectedSize(size.label);
                        setSizeError(false);
                      }}
                      style={{
                        textAlign: "left",
                        padding: isMobile ? "12px 12px" : "13px 14px",
                        background: isSelected
                          ? "linear-gradient(180deg, rgba(58,58,58,0.96), rgba(28,28,28,0.96))"
                          : "linear-gradient(180deg, rgba(18,18,18,0.96), rgba(10,10,10,0.96))",
                        border: `1px solid ${isSelected ? "#8f8f97" : sizeError ? "#5d3434" : "#232323"}`,
                        color: "#f4f4f5",
                        cursor: "pointer",
                        borderRadius: "3px",
                        boxShadow: isSelected ? "0 0 0 1px rgba(255,255,255,0.08) inset" : "none",
                      }}
                      aria-pressed={isSelected}
                    >
                      <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>{size.label}</div>
                      <div style={{ fontSize: "13px", color: isSelected ? "#ffffff" : "#a1a1aa" }}>${size.price}</div>
                    </button>
                  );
                })}
              </div>

              {sizeError && (
                <div style={{ fontSize: "11px", color: "#9d5c5c", marginTop: "8px", letterSpacing: "0.4px" }}>
                  Please select a size
                </div>
              )}
            </div>

            <div style={{ marginBottom: "22px", maxWidth: isMobile ? "100%" : "180px" }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "#7a7a82",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  marginBottom: "8px",
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
                  padding: "10px 12px",
                  color: "#d4d4d8",
                  fontSize: "14px",
                  appearance: "none",
                  cursor: "pointer",
                }}
              >
                {[1, 2, 3, 4, 5].map((quantity) => (
                  <option key={quantity} value={quantity} style={{ background: "#111" }}>
                    {quantity}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                borderTop: "1px solid #171717",
                paddingTop: "18px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "#7a7a82",
                  letterSpacing: "4px",
                  textTransform: "uppercase",
                  marginBottom: "12px",
                }}
              >
                About This Piece
              </div>
              <div
                style={{
                  fontSize: "15px",
                  color: "#d4d4d8",
                  lineHeight: 1.75,
                }}
              >
                {product.description}
              </div>
            </div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div
            style={{
              background: "#070707",
              padding: isMobile ? "28px 16px" : "32px 20px",
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              {relatedProducts.map((related) => (
                <Link
                  key={related.id}
                  to={`/shop/${related.slug}`}
                  style={{
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
                    {related.imageUrl ? (
                      <img
                        src={related.imageUrl}
                        alt={getPrimaryProductImage(related)?.alt || related.title}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          transition: "transform 0.25s ease",
                        }}
                      />
                    ) : (
                      <span style={{ color: "#333", fontSize: "10px", letterSpacing: "1px" }}>
                        Image unavailable
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "16px", color: "#ffffff", fontWeight: 500 }}>{related.title}</div>
                  <div style={{ fontSize: "15px", color: "#d4d4d8" }}>From ${getProductMinPrice(related)}</div>
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
                    View Piece -
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            background: "#0b0b0b",
            borderTop: "1px solid #111",
            padding: isMobile ? "32px 16px" : "36px 20px",
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
            Every custom piece starts with a conversation. Bring the concept - I'll bring it to life.
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
          controller={{ closeOnBackdropClick: true }}
          slides={[{ src: lightboxUrl || imageUrl, alt: primaryImage?.alt || product.title }]}
          animation={{ fade: 250 }}
          render={{
            buttonClose: () => (
              <button
                type="button"
                aria-label="Close"
                onClick={() => setLightboxOpen(false)}
                style={{
                  position: "fixed",
                  top: "16px",
                  right: "16px",
                  zIndex: 10001,
                  width: "44px",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(20,20,20,0.85)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: "999px",
                  color: "#ffffff",
                  cursor: "pointer",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            ),
          }}
          styles={{
            container: {
              backgroundColor: "rgba(0,0,0,0.92)",
            },
          }}
        />
      )}

      {isMobile && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 90,
            padding: "10px 14px calc(10px + env(safe-area-inset-bottom, 0px))",
            background: "rgba(10,10,10,0.92)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 -12px 30px rgba(0,0,0,0.38)",
          }}
        >
          <div
            style={{
              maxWidth: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "10px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: "#8a8a94",
                  marginBottom: "4px",
                }}
              >
                {selectedSize ? selectedSize : "Select size"}
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "#ffffff",
                  letterSpacing: "-0.4px",
                }}
              >
                {selectedPrice != null ? `$${selectedPrice}` : "Select size"}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStickyCta}
              style={{
                flexShrink: 0,
                minWidth: "180px",
                background: "linear-gradient(135deg, #f1f1f1 0%, #d5d5d5 100%)",
                border: "1px solid rgba(255,255,255,0.45)",
                borderRadius: "3px",
                padding: "14px 16px",
                color: "#080808",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                cursor: "pointer",
              }}
            >
              Claim This Artwork
            </button>
          </div>
        </div>
      )}
    </>
  );
}

# Product Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `/shop/:slug` product detail page template, starting with "Alter Ego", fully integrated with the existing Firebase Storage, cart, and Stripe checkout flow.

**Architecture:** Three changes — create `src/data/products.js` as the product registry, create `src/pages/ProductDetailPage.jsx` as the page component, and add the `/shop/:slug` route to `src/App.jsx`. The page fetches its own image from Firebase on mount, renders a split-panel layout, and re-uses the existing `addToCart` + `open-cart` event pattern from ShopGallery.

**Tech Stack:** React 18, React Router v6, Firebase Storage (`getDownloadURL`, `listAll`, `ref`), Tailwind CSS, CartContext (`addToCart`), `sizePriceMap` from `sizePricing.js`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/data/products.js` | **Create** | All 14 product definitions — title, slug, description, tagline, Firebase path |
| `src/pages/ProductDetailPage.jsx` | **Create** | Split-panel product page with image fetch, purchase stack, related products, commission CTA |
| `src/App.jsx` | **Edit** | Add `/shop/:slug` route before the catch-all |

Files NOT touched: `CartContext.jsx`, `ShopGallery.jsx`, `sizePricing.js`, `stripeLinks.js`, `firebase.js`

---

## Task 1: Product Registry

**Files:**
- Create: `src/data/products.js`

- [ ] **Step 1.1: Create the file**

```js
// src/data/products.js
// Single source of truth for all product metadata.
// title must exactly match the key used in src/utils/stripeLinks.js

export const products = [
  {
    title: "Adoration in the lights darkness",
    slug: "adoration-in-the-lights-darkness",
    category: "Airbrush · Original Print",
    description: "Light finds its way through even the deepest dark — this piece holds that tension.",
    tagline: "For the ones who feel everything.",
    firebasePath: "airbrush/Adoration in the lights darkness.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Alter Ego",
    slug: "alter-ego",
    category: "Airbrush · Original Print",
    description: "Two versions of the same person, neither one wrong — just one you show and one you carry.",
    tagline: "A piece people stop and stare at. Then ask about.",
    firebasePath: "airbrush/Alter Ego.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Feathered Serenity",
    slug: "feathered-serenity",
    category: "Airbrush · Original Print",
    description: "Stillness made visible. Every feather placed with intention.",
    tagline: "Soft, but it commands the room.",
    firebasePath: "airbrush/Feathered Serenity.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Fractured Perception",
    slug: "fractured-perception",
    category: "Airbrush · Original Print",
    description: "Reality isn't one thing — this piece explores the cracks between versions of it.",
    tagline: "The more you look, the more you see.",
    firebasePath: "airbrush/Fractured Perception.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Harmony in Shadows",
    slug: "harmony-in-shadows",
    category: "Airbrush · Original Print",
    description: "Balance doesn't always live in the light — sometimes it hides where the eye doesn't go first.",
    tagline: "A slow burn. The kind that stays with you.",
    firebasePath: "airbrush/Harmony in Shadows.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Illuminated Void",
    slug: "illuminated-void",
    category: "Airbrush · Original Print",
    description: "Emptiness rendered luminous. A paradox you can hang on a wall.",
    tagline: "It fills a room without trying.",
    firebasePath: "airbrush/Illuminated Void.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Lost in Thought",
    slug: "lost-in-thought",
    category: "Airbrush · Original Print",
    description: "Everyone's been there. This piece captures that exact place between presence and somewhere else.",
    tagline: "People recognize themselves in it.",
    firebasePath: "airbrush/Lost in Thought.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Love is Love",
    slug: "love-is-love",
    category: "Airbrush · Original Print",
    description: "No conditions. No exceptions. Just the thing itself.",
    tagline: "Unapologetic. Exactly as it should be.",
    firebasePath: "airbrush/Love is Love.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Out for Fame",
    slug: "out-for-fame",
    category: "Airbrush · Original Print",
    description: "Ambition made visible. Street energy, gallery presence.",
    tagline: "Built for walls that mean something.",
    firebasePath: "airbrush/Out for Fame.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Overwhelmed",
    slug: "overwhelmed",
    category: "Airbrush · Original Print",
    description: "The moment before breaking — and the beauty that lives there.",
    tagline: "Uncomfortable. Honest. Hard to look away.",
    firebasePath: "airbrush/Overwhelmed.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Serenity",
    slug: "serenity",
    category: "Airbrush · Original Print",
    description: "Pure stillness. A piece that slows the room down.",
    tagline: "The quiet kind of powerful.",
    firebasePath: "airbrush/Serenity.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Spirit of the Knight",
    slug: "spirit-of-the-knight",
    category: "Airbrush · Original Print",
    description: "Valor without vanity. A piece about what it means to stand for something.",
    tagline: "Commands attention the moment it's on the wall.",
    firebasePath: "airbrush/Spirit of the Knight.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Veiled Whispers",
    slug: "veiled-whispers",
    category: "Airbrush · Original Print",
    description: "Secrets held in layers of shadow and light. You won't catch everything on first look.",
    tagline: "The kind that rewards close attention.",
    firebasePath: "airbrush/Veiled Whispers.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
  {
    title: "Walk in Faith",
    slug: "walk-in-faith",
    category: "Airbrush · Original Print",
    description: "Forward, even when the path isn't clear. This piece is for that.",
    tagline: "People put it somewhere they see every morning.",
    firebasePath: "airbrush/Walk in Faith.webp",
    sizes: ["16x20", "18x24", "24x36", "30x40"],
  },
];
```

- [ ] **Step 1.2: Verify titles match stripeLinks.js**

Open `src/utils/stripeLinks.js` and confirm every `title` in `products.js` matches a top-level key exactly (case-sensitive). There are 14 entries in both files. If any mismatch is found, correct it in `products.js` — `stripeLinks.js` is the source of truth for title strings.

- [ ] **Step 1.3: Commit**

```bash
git add src/data/products.js
git commit -m "feat: add product registry with all 14 products"
```

---

## Task 2: ProductDetailPage Component

**Files:**
- Create: `src/pages/ProductDetailPage.jsx`

- [ ] **Step 2.1: Create the component**

```jsx
// src/pages/ProductDetailPage.jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { storage } from "../firebase";
import { ref, getDownloadURL, listAll } from "firebase/storage";
import { useCart } from "../Components/CartContext";
import { sizePriceMap } from "../utils/sizePricing";
import { products } from "../data/products";

const minPrice = Math.min(...Object.values(sizePriceMap));

export default function ProductDetailPage() {
  const { slug } = useParams();
  const product = products.find((p) => p.slug === slug) || null;

  const [imageUrl, setImageUrl] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);

  const { addToCart } = useCart();

  // Fetch main product image
  useEffect(() => {
    if (!product) return;
    let alive = true;
    getDownloadURL(ref(storage, product.firebasePath))
      .then((url) => { if (alive) setImageUrl(url); })
      .catch(() => { if (alive) setImageError(true); });
    return () => { alive = false; };
  }, [product?.firebasePath]);

  // Fetch related products (first 3 non-current from Firebase)
  useEffect(() => {
    if (!product) return;
    let alive = true;

    const fetchRelated = async () => {
      try {
        const result = await listAll(ref(storage, "airbrush"));

        // Collect matching candidates without fetching URLs yet
        const candidates = [];
        for (const itemRef of result.items) {
          if (candidates.length >= 3) break;
          // Skip thumbs and non-images
          if (itemRef.name.toLowerCase().includes("__thumb")) continue;
          if (!/\.(webp|jpg|jpeg|png)$/i.test(itemRef.name)) continue;
          // Derive title: strip extension, then strip __quantity suffix
          const base = itemRef.name.replace(/\.[^.]+$/, "");
          const titleRaw = base.split("__")[0];
          const match = products.find((p) => p.title === titleRaw);
          if (!match || match.title === product.title) continue;
          candidates.push({ product: match, itemRef });
        }

        // Batch fetch URLs for the 3 candidates
        const withUrls = await Promise.all(
          candidates.map(async ({ product: p, itemRef }) => ({
            ...p,
            imageUrl: await getDownloadURL(itemRef),
          }))
        );

        if (alive) setRelatedProducts(withUrls);
      } catch (err) {
        console.error("Related products fetch failed:", err);
        // Related section simply stays empty — not a fatal error
      }
    };

    fetchRelated();
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
    <div style={{ background: "#0a0a0a", minHeight: "100vh", fontFamily: "Georgia, serif" }}>

      {/* ── SECTION 1: Split Panel ── */}
      <div
        style={{
          display: "flex",
          height: "calc(85vh - 4rem)",
          minHeight: "360px",
          maxHeight: "700px",
          background: "#0a0a0a",
        }}
      >
        {/* Left: Image Panel */}
        <div
          style={{
            flex: 6,
            background: "#090909",
            borderRight: "1px solid #141414",
            position: "relative",
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
                  style={{
                    height: "100%",
                    maxHeight: "100%",
                    width: "100%",
                    objectFit: "contain",
                  }}
                />
              ) : (
                /* Loading placeholder — same dark box, no layout shift */
                <span style={{ color: "#2a2a2a", fontSize: "8px", letterSpacing: "3px", textTransform: "uppercase" }}>
                  {product.title}
                </span>
              )}
            </div>

            {/* Zoom hint */}
            <div
              style={{
                position: "absolute",
                bottom: "4px",
                right: "4px",
                fontSize: "7px",
                color: "#2c2c2c",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              ⊕ Click to zoom
            </div>
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
            overflowY: "auto",
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
              fontSize: "22px",
              fontWeight: 700,
              color: "#f0f0f0",
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
              fontSize: "11px",
              color: "#666",
              lineHeight: 1.8,
              marginBottom: "5px",
            }}
          >
            {product.description}
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "10px",
              color: "#444",
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
            <span style={{ fontSize: "10px", color: "#555", letterSpacing: "1px" }}>From </span>
            <span style={{ color: "#e8e8e8", fontSize: "18px", fontWeight: 700, letterSpacing: "-0.5px" }}>
              ${minPrice}
            </span>
            <span style={{ fontSize: "9px", color: "#3a3a3a", marginLeft: "6px", letterSpacing: "1px" }}>
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
                fontSize: "7px",
                color: "#3a3a3a",
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
                color: selectedSize ? "#e0e0e0" : "#777",
                fontSize: "11px",
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
                fontSize: "7px",
                color: "#3a3a3a",
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
                color: "#e0e0e0",
                fontSize: "11px",
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
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "2.5px",
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
            <span style={{ fontSize: "9px", color: "#4a4a4a", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
              Hand-finished, made to order
            </span>
            <span style={{ color: "#2a2a2a", fontSize: "10px" }}>·</span>
            <span style={{ fontSize: "9px", color: "#4a4a4a", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
              Stripe &amp; PayPal
            </span>
            <span style={{ color: "#2a2a2a", fontSize: "10px" }}>·</span>
            <span style={{ fontSize: "9px", color: "#4a4a4a", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
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
                fontSize: "7px",
                color: "#383838",
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
                    transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
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
                <div style={{ fontSize: "11px", color: "#bbb" }}>{related.title}</div>
                <div style={{ fontSize: "9px", color: "#444" }}>From ${minPrice}</div>
                <div
                  style={{
                    fontSize: "7px",
                    color: "#444",
                    letterSpacing: "2px",
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
            fontSize: "7px",
            color: "#383838",
            letterSpacing: "4px",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          Commission Original Work
        </div>
        <div
          style={{
            fontSize: "17px",
            color: "#d8d8d8",
            fontWeight: 700,
            marginBottom: "8px",
            letterSpacing: "-0.4px",
          }}
        >
          Tell me what you carry.
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#484848",
            marginBottom: "22px",
            maxWidth: "260px",
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
            fontSize: "8px",
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
  );
}
```

- [ ] **Step 2.2: Add hover styles for related product cards**

The related product card hover effects (image zoom, card lift) require CSS. Add this to `src/index.css` (or whatever global CSS file exists — check `src/index.css`):

```css
.related-card:hover > div:first-child {
  transform: translateY(-2px);
  border-color: #333;
  box-shadow: 0 8px 32px rgba(0,0,0,0.7);
}
.related-card:hover > div:first-child img {
  transform: scale(1.02);
}
.related-card:hover > div:last-child {
  color: #888;
  border-color: #555;
}
```

- [ ] **Step 2.3: Commit**

```bash
git add src/pages/ProductDetailPage.jsx src/index.css
git commit -m "feat: add ProductDetailPage component"
```

---

## Task 3: Add Route to App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 3.1: Add import and route**

Add this import at the top of `src/App.jsx` with the other page imports:

```js
import ProductDetailPage from "./pages/ProductDetailPage";
```

Add this route inside `<Routes>`, **immediately after** the `/shop` route and **before** the `/success` and `/cancel` routes (and definitely before the catch-all `path="*"`):

```jsx
<Route path="/shop/:slug" element={<ProductDetailPage />} />
```

The relevant section of `App.jsx` should look like:

```jsx
<Route path="/shop" element={<ShopPage />} />
<Route path="/shop/:slug" element={<ProductDetailPage />} />
<Route path="/contact" element={<Contact />} />
```

- [ ] **Step 3.2: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add /shop/:slug route for product detail pages"
```

---

## Task 4: Manual Verification

No automated test framework is configured. Verify these manually with `npm run dev`:

- [ ] **4.1 — Happy path: direct URL**
  Navigate to `http://localhost:5173/shop/alter-ego`. Expect:
  - Split panel renders (dark left image panel, right purchase stack)
  - Image loads from Firebase without layout shift
  - Title "Alter Ego", description, tagline, "From $100" visible
  - "Limited run" scarcity text below price
  - Size dropdown shows 4 options with prices
  - Trust strip shows 3 items inline with dots

- [ ] **4.2 — Add to cart flow**
  - Click "Own This Piece" without selecting size → "Please select a size" appears, cart does NOT open
  - Select "16x20", click button → cart opens, item appears with correct title/size/price ($100)
  - Select "18x24", quantity 2, click button → cart opens, correct item ($200 × 2)

- [ ] **4.3 — Related products**
  Scroll below the split panel. Expect 3 cards (not "Alter Ego"). Each has an image, title, price, and "View Piece →". Clicking a card navigates to that product's page.

- [ ] **4.4 — Related card hover**
  Hover over a related card. Image should scale slightly, card lifts, "View Piece →" gets brighter.

- [ ] **4.5 — Commission CTA**
  "Start a Commission" link navigates to `/contact`.

- [ ] **4.6 — 404 fallback**
  Navigate to `http://localhost:5173/shop/not-a-real-product`. Expect: "This piece isn't here." with "Browse the collection →" link. Clicking link goes to `/shop`.

- [ ] **4.7 — ShopGallery regression check**
  Navigate to `/shop`. Confirm existing shop grid still loads, add-to-cart still works, cart opens as before.

- [ ] **4.8 — Other product pages**
  Navigate to `http://localhost:5173/shop/serenity` and `http://localhost:5173/shop/lost-in-thought`. Both should render the template with correct titles and descriptions.

---

## Edge Cases to Watch

1. **Firebase filename with `__` suffix:** Some files may be named `"Alter Ego__5.webp"`. The related products fetch handles this by splitting on `__` before looking up `products.js`. The main image fetch uses `product.firebasePath` directly (no `__` in paths defined in `products.js`), so it's unaffected.

2. **Image load order in related products:** The `listAll` result order from Firebase is not guaranteed. The first 3 matches (after filtering) are shown. If you need specific products to appear as related, `products.js` ordering does not control this — Firebase storage listing order does.

3. **Cart deduplication:** If the same product+size is already in cart, `CartContext.addToCart` increments quantity rather than adding a duplicate. This is existing behavior — no change needed.

4. **`firebasePath` case sensitivity:** Firebase Storage paths are case-sensitive. The paths in `products.js` must match exactly what's stored (e.g., `"airbrush/Alter Ego.webp"` — capital letters, space, `.webp`). If a product image doesn't load, check the exact filename in Firebase Storage console.

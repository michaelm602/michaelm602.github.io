// src/components/Gallery.jsx
import { useEffect, useMemo, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import "../styles/Gallery.css";

/**
 * Strategy:
 * - Try to use thumbnails for the grid (fast)
 * - Use full-size URLs for lightbox
 *
 * Naming convention (recommended):
 *   /tattoos/foo.jpg  (original or full)
 *   /tattoos/foo.webp (optimized full)
 *   /tattoos/foo__thumb.webp (optimized thumb)
 *
 * If thumbs don't exist yet, it will fallback to full image URLs.
 */

function stripExt(name = "") {
  return name.replace(/\.[^.]+$/, "");
}

function getExt(name = "") {
  const m = name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "";
}

function isImage(name = "") {
  const ext = getExt(name);
  return ["jpg", "jpeg", "png", "webp"].includes(ext);
}

async function safeGetURL(storageRef) {
  try {
    return await getDownloadURL(storageRef);
  } catch {
    return null;
  }
}

export default function Gallery({ folder, label }) {
  const [pieces, setPieces] = useState([]);
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const fetchImages = async () => {
      setLoading(true);
      try {
        const folderRef = ref(storage, folder);
        const res = await listAll(folderRef);

        // Filter only image objects
        const items = res.items.filter((i) => isImage(i.name));

        // Build a lookup by base name (no extension)
        // Example: "iwata" => { jpgRef, webpRef, thumbRef }
        const byBase = new Map();

        for (const item of items) {
          const base = stripExt(item.name);
          const ext = getExt(item.name);

          if (!byBase.has(base)) byBase.set(base, {});
          const entry = byBase.get(base);

          // Thumb naming option A: foo__thumb.webp
          if (base.toLowerCase().endsWith("__thumb")) {
            const realBase = base.replace(/__thumb$/, "");
            if (!byBase.has(realBase)) byBase.set(realBase, {});
            const realEntry = byBase.get(realBase);
            realEntry.thumbRef = item;
            continue;
          }

          if (ext === "webp") entry.webpRef = item;
          if (ext === "jpg" || ext === "jpeg") entry.jpgRef = item;
          if (ext === "png") entry.pngRef = item;
        }

        // For each base entry, choose best full + best thumb (thumb optional)
        const bases = Array.from(byBase.keys())
          .filter((b) => !b.endsWith("__thumb"))
          .sort((a, b) => a.localeCompare(b));

        // We will request URLs in parallel
        const formatted = await Promise.all(
          bases.map(async (base, i) => {
            const entry = byBase.get(base) || {};

            // Best full: webp > jpg > png
            const fullRef = entry.webpRef || entry.jpgRef || entry.pngRef;
            const full = fullRef ? await safeGetURL(fullRef) : null;

            // Best thumb (if exists): thumbRef (prefer webp) otherwise null
            // If you choose to store thumbs as foo__thumb.webp or foo__thumb.jpg,
            // this will pick them up.
            let thumb = null;
            if (entry.thumbRef) thumb = await safeGetURL(entry.thumbRef);

            // Fallback: if no thumb, use full (still works)
            const gridSrc = thumb || full;

            return {
              src: full,            // lightbox
              gridSrc: gridSrc,     // grid
              title: `${label} Piece #${i + 1}`,
              alt: `${label} Piece #${i + 1}`,
            };
          })
        );

        const clean = formatted.filter((p) => p.src && p.gridSrc);

        if (alive) setPieces(clean);
      } catch (err) {
        console.error(`Error loading ${folder} images:`, err);
        if (alive) setPieces([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchImages();

    return () => {
      alive = false;
    };
  }, [folder, label]);

  const slides = useMemo(
    () => pieces.map((p) => ({ src: p.src, title: p.title })),
    [pieces]
  );

  const onOpen = (idx) => {
    setPhotoIndex(idx);
    setOpen(true);
  };

  return (
    <>
      {loading ? (
        <div className="text-center mt-12">
          <svg
            className="animate-spin h-8 w-8 text-white mx-auto"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-label="Loading"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
            ></path>
          </svg>
          <p className="mt-4 text-sm text-gray-400">Loading gallery...</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {pieces.map((piece, idx) => (
            <button
              key={idx}
              type="button"
              className="gallery-piece"
              onClick={() => onOpen(idx)}
              aria-label={`Open ${piece.alt}`}
            >
              <img
                src={piece.gridSrc}
                alt={piece.alt}
                loading="lazy"
                decoding="async"
                // hint to the browser: the grid image doesn't need to be huge
                // (works best if your thumbs are small)
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={photoIndex}
        slides={slides}
        styles={{
          container: {
            backdropFilter: "blur(10px)",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            WebkitBackdropFilter: "blur(10px)",
          },
          slide: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        }}
        render={{
          slide: ({ slide }) => (
            <img
              src={slide.src}
              alt={slide.title || "Artwork"}
              loading="eager"
              decoding="async"
              style={{
                maxWidth: "90vw",
                maxHeight: "90vh",
                objectFit: "contain",
              }}
            />
          ),
        }}
      />
    </>
  );
}

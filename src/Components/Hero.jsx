import { useEffect, useMemo, useState } from "react";

export default function Hero({ images = [], intervalMs = 3000 }) {
  // sanitize input
  const safeImages = useMemo(
    () => (Array.isArray(images) ? images.filter(Boolean) : []),
    [images]
  );

  const [currentIndex, setCurrentIndex] = useState(0);

  // reset index if images list changes size
  useEffect(() => {
    setCurrentIndex(0);
  }, [safeImages.length]);

  useEffect(() => {
    if (safeImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % safeImages.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [safeImages.length, intervalMs]);

  if (!safeImages.length) return null;

  return (
    <section aria-label="Hero slideshow" className="relative w-full h-[90vh] md:h-screen bg-black overflow-hidden">
      {/* Background images */}
      {safeImages.map((img, idx) => (
        <img
          key={`${img}-${idx}`}
          src={img}
          alt=""
          role="presentation"
          loading="eager"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === currentIndex ? "opacity-100" : "opacity-0"
            }`}
        />
      ))}

      {/* Dark overlay — keeps text readable regardless of image brightness */}
      <div className="absolute inset-0 z-[1] bg-black/60" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white text-center px-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
          AIRBRUSH & INK
        </h1>

        <p className="text-base sm:text-lg md:text-xl max-w-md sm:max-w-lg mb-6 sm:mb-8">
          Unique visuals and layered detail in every piece. Explore the work.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="#/shop"
            className="px-6 py-2 rounded bg-white text-black font-semibold hover:bg-zinc-200 transition"
          >
            Shop Prints
          </a>

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("services");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="px-6 py-2 rounded border border-white/40 text-white hover:bg-white/10 transition"
          >
            View Portfolio
          </button>
        </div>
      </div>
    </section>
  );
}

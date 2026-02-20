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
    <section className="relative w-full h-[90vh] md:h-screen bg-black overflow-hidden">
      {/* Background images */}
      {safeImages.map((img, idx) => (
        <img
          key={`${img}-${idx}`}
          src={img}
          alt={`Hero Background ${idx + 1}`}
          width="1920"
          height="1080"
          loading={idx === currentIndex ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={idx === currentIndex ? "high" : "auto"}
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
      </div>
    </section>
  );
}

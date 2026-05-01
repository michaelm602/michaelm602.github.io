import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function Hero({ images = [], intervalMs = 3000 }) {
  const incomingImages = useMemo(
    () => (Array.isArray(images) ? images.filter(Boolean) : []),
    [images]
  );
  const incomingSignature = incomingImages.join("|");

  const [displayImages, setDisplayImages] = useState(() => incomingImages);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [crossfadeImage, setCrossfadeImage] = useState(null);
  const [showCrossfadeImage, setShowCrossfadeImage] = useState(false);

  const displayImagesRef = useRef(displayImages);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => {
    displayImagesRef.current = displayImages;
  }, [displayImages]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (!incomingImages.length) {
      setDisplayImages([]);
      setCrossfadeImage(null);
      return;
    }

    const previousImages = displayImagesRef.current;
    const imageSetIsSame =
      previousImages.length === incomingImages.length &&
      previousImages.every((image, index) => image === incomingImages[index]);

    if (imageSetIsSame) return;

    if (!previousImages.length) {
      setDisplayImages(incomingImages);
      setCurrentIndex(0);
      return;
    }

    const previousVisibleImage =
      previousImages[currentIndexRef.current] || previousImages[0];

    setCrossfadeImage(previousVisibleImage);
    setShowCrossfadeImage(true);
    setDisplayImages(incomingImages);
    setCurrentIndex(0);

    let fadeFrameTwo = 0;
    const fadeFrameOne = requestAnimationFrame(() => {
      fadeFrameTwo = requestAnimationFrame(() => setShowCrossfadeImage(false));
    });
    const cleanupTimer = window.setTimeout(() => setCrossfadeImage(null), 850);

    return () => {
      cancelAnimationFrame(fadeFrameOne);
      cancelAnimationFrame(fadeFrameTwo);
      window.clearTimeout(cleanupTimer);
    };
  }, [incomingImages, incomingSignature]);

  useEffect(() => {
    if (displayImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayImages.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [displayImages.length, intervalMs]);

  if (!displayImages.length) return null;

  return (
    <section
      aria-label="Hero slideshow"
      className="relative w-full h-[82svh] min-h-[520px] md:h-[calc(100vh-56px)] md:min-h-[640px] bg-black overflow-hidden"
    >
      {displayImages.map((img, idx) => {
        const isFirstImage = idx === 0;
        const isCurrentImage = idx === currentIndex;

        return (
          <img
            key={`${img}-${idx}`}
            src={img}
            alt=""
            role="presentation"
            aria-hidden="true"
            loading={isFirstImage ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={isFirstImage ? "high" : "low"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${isCurrentImage ? "opacity-100" : "opacity-0"
              }`}
          />
        );
      })}

      {crossfadeImage && (
        <img
          src={crossfadeImage}
          alt=""
          role="presentation"
          aria-hidden="true"
          decoding="async"
          className={`absolute inset-0 z-[1] w-full h-full object-cover transition-opacity duration-700 ease-out ${showCrossfadeImage ? "opacity-100" : "opacity-0"
            }`}
        />
      )}

      <div className="absolute inset-0 z-[2] bg-black/50" />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[3]"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.62) 100%), radial-gradient(circle at center, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.42) 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white text-center px-5 pt-3">
        <p className="mb-4 text-[0.68rem] sm:text-xs uppercase tracking-[0.28em] text-white/65">
          Hand-finished prints and custom work
        </p>

        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-tight"
          style={{ textShadow: "0 2px 24px rgba(0,0,0,0.6)" }}
        >
          Made to Order. Built to Hit.
        </h1>

        <p
          className="text-base sm:text-lg md:text-xl max-w-md sm:max-w-xl mb-7 sm:mb-9 text-white/80 leading-relaxed"
          style={{ textShadow: "0 2px 18px rgba(0,0,0,0.58)" }}
        >
          Hand-finished airbrush and ink work - no mass production, no shortcuts. Every piece ships once.
        </p>

        <div className="flex w-full max-w-xs flex-col sm:max-w-none sm:w-auto sm:flex-row gap-3 sm:gap-4">
          <Link
            to="/shop"
            className="inline-flex justify-center rounded-sm bg-white px-7 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black shadow-[0_14px_40px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Shop Artwork
          </Link>

          <Link
            to="/contact"
            className="inline-flex justify-center rounded-sm border border-white/35 bg-black/10 px-7 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Request Custom Piece
          </Link>
        </div>
      </div>
    </section>
  );
}

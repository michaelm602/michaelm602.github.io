import { useEffect, useState } from "react";
import img1 from "../assets/images/hero-images/iwata.jpg";
import img2 from "../assets/images/hero-images/photoshop.jpg";

const images = [img1, img2];

export default function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative w-full h-[90vh] md:h-screen bg-black overflow-hidden">
      {/* Background images */}
      {images.map((img, idx) => (
        <img
          key={idx}
          src={img}
          alt={`Hero Background ${idx + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === currentIndex ? "opacity-40" : "opacity-0"
            }`}
        />
      ))}

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

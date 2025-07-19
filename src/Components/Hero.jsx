import { useEffect, useState } from "react";
import img1 from "../assets/images/hero-images/iwata.jpg";
import img2 from "../assets/images/hero-images/photoshop.jpg";
import img3 from "../assets/images/hero-images/tattoomachine.jpg";

const images = [img1, img2, img3];

export default function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000); // 4.5 seconds per image
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative h-screen w-full bg-black overflow-hidden">
      {/* Background images layered with fade transition */}
      {images.map((img, idx) => (
        <img
          key={idx}
          src={img}
          alt={`Hero Background ${idx + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
            idx === currentIndex ? "opacity-40" : "opacity-0"
          }`}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white text-center px-4">
        <h1 className="text-5xl font-bold mb-4">AIRBRUSH & INK</h1>
        <p className="text-xl max-w-xl mb-8">
          Unique visuals and layered detail in every piece. Explore the work.
        </p>
        <a
          href="/portfolio"
          className="bg-white text-black py-2 px-6 rounded shadow hover:bg-gray-100 transition"
        >
          View Portfolio
        </a>
      </div>
    </section>
  );
}

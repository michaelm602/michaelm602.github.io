// src/components/CTA.jsx
import { Link } from "react-router-dom";

export default function CTA() {
  return (
    <div className="w-full flex justify-center items-center mt-[-5vh] sm:mt-[-13vh] md:mt-[-15vh] lg:mt-[-14vh] xl:mt-[-8vh] mb-[-5vh] z-20 relative">
      <Link
        to="/shop"
        className="inline-block bg-gradient-to-r from-black to-zinc-800 text-white text-sm sm:text-base uppercase font-semibold tracking-wide sm:tracking-wider py-2.5 px-6 sm:py-3 sm:px-8 rounded-md transition-all duration-300 hover:from-zinc-900 hover:to-zinc-700 shadow-lg"
      >
        SHOP NOW
      </Link>
    </div>
  );
}

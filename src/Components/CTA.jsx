// src/components/CTA.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function CTA() {
  return (
    <div className="w-full flex justify-center mt-[-2vh] sm:mt-[-4vh] md:mt-[-6vh] lg:mt-[-7vh] xl:mt-[-1vh] mb-12 z-20 relative">
  <Link
    to="/portfolio"
    className="inline-block bg-black text-white text-sm sm:text-base uppercase font-semibold tracking-wide sm:tracking-wider py-2.5 px-6 sm:py-3 sm:px-8 rounded-md transition duration-300 hover:bg-[#222] shadow-lg"
  >
    CHECK OUT MY PORTFOLIO
  </Link>
</div>
  );
}

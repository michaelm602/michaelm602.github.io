// src/components/CTA.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function CTA() {
  return (
<div className="w-full flex justify-center items-center mt-[-18vh] sm:mt-[-5vh] md:mt-[-6vh] lg:mt-[-15vh] xl:mt-[-15vh] mb-[1.5vh] z-20 relative">


  <Link
    to="/portfolio"
    className="inline-block bg-black text-white text-sm sm:text-base uppercase font-semibold tracking-wide sm:tracking-wider py-2.5 px-6 sm:py-3 sm:px-8 rounded-md transition duration-300 hover:bg-[#222] shadow-lg"
  >
    CHECK OUT MY PORTFOLIO
  </Link>
</div>
  );
}

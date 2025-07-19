// src/components/CTA.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function CTA() {
  return (
    <section className="text-center mb-20 z-10 relative">
      <Link
        to="/portfolio"
        className="inline-block bg-black text-white uppercase font-semibold tracking-wider py-3 px-8 rounded-md transition duration-300 hover:bg-[#222]"
      >
        CHECK OUT MY PORTFOLIO
      </Link>
    </section>
  );
}

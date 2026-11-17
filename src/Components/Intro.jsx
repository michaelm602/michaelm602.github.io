// src/components/Intro.jsx
import React from "react";
import { PAGE_COPY } from "../content/pageCopy";

export default function Intro() {
  return (
    <section className="text-white text-center mt-8 px-6 max-w-2xl mx-auto z-10 relative mb-8">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4">
        {PAGE_COPY["/"].artistHeading}
      </h2>
      <p className="text-base sm:text-lg leading-relaxed text-zinc-400">
        {PAGE_COPY["/"].artistIntro}
      </p>
    </section>
  );
}

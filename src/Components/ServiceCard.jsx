import React from "react";
import { Link } from "react-router-dom";

export default function ServiceCard({ title, description, image, link, tag }) {
  return (
    <Link
      to={link}
      className="
        group rounded-lg shadow-lg overflow-hidden
        transition duration-300 transform hover:-translate-y-1 hover:shadow-2xl
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black
        w-full max-w-[500px]
        flex flex-col
        bg-gradient-to-b from-black to-[#222]
        border border-white/10 hover:border-white/20
      "
    >
      <div className="relative w-full h-[220px] overflow-hidden">
        {tag && (
          <span
            className="
              absolute top-2 left-2 z-10
              bg-black/70 backdrop-blur-sm
              text-white text-xs font-semibold
              px-2 py-1 rounded
              ring-1 ring-white/20
            "
          >
            {tag}
          </span>
        )}

        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover object-center block brightness-90 transition duration-500 group-hover:scale-[1.035] group-hover:brightness-100"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500 text-sm">
            Image coming soon
          </div>
        )}

        <div className="absolute inset-0 bg-black/25 transition duration-300 group-hover:bg-black/15" />
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-white text-xl font-bold">{title}</h3>

        <p className="text-base text-gray-200 mt-2 mb-4 flex-grow leading-relaxed whitespace-pre-line">
          {description}
        </p>

        <div className="mt-auto pt-6 border-t border-white/10 flex justify-center">
          <span
            className="
    text-sm tracking-wide
    text-white/80
    cursor-pointer
    relative
    animate-attention
    group-hover:text-white
    group-hover:animate-none
  "
          >
            Portfolio →
          </span>
        </div>
      </div>
    </Link>
  );
}

import React from "react";
import { Link } from "react-router-dom";

export default function ServiceCard({ title, description, image, link, tag }) {
  return (
    <Link
      to={link}
      className="rounded-xl shadow-lg overflow-hidden transition-transform duration-300 transform hover:scale-[1.03] w-full max-w-[500px] flex flex-col bg-gradient-to-r from-black to-[#222]"
    >
      <div className="relative">
        {tag && (
          <span className="absolute top-2 left-2 bg-black text-white/10 text-xs px-2 py-1 rounded">
            {tag.toUpperCase()}
          </span>
        )}
        <img
          src={image || "https://via.placeholder.com/600x400?text=Service+Image"}
          alt={title}
        />
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-white text-xl font-bold">{title}</h3>
        <p className="text-base text-gray-200 mt-2 mb-4 flex-grow leading-relaxed whitespace-pre-line">
          {description}
        </p>        <div className="pt-4 border-t border-gray-700 flex justify-center">
          <span className="text-md text-white font-semibold">Portfolio</span>
        </div>

      </div>
    </Link>
  );
}

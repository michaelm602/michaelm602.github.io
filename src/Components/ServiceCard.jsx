import React from "react";
import { Link } from "react-router-dom";

export default function ServiceCard({ title, description, image, link, tag }) {
  return (
    <Link
      to={link}
      className="rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition duration-300 w-full sm:w-[300px] md:w-[320px] flex flex-col"
    >
      <div className="relative">
        {tag && (
          <span className="absolute top-2 left-2 bg-black text-white/10 text-xs px-2 py-1 rounded">
            {tag.toUpperCase()}
          </span>
        )}
        <img src={image} alt={title} className="w-full h-48 object-cover opacity-80" />
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-white text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-300 mt-1 mb-3 flex-grow">{description}</p>
        <hr className="border-gray-700 my-2" />
        <div className="flex justify-between text-sm text-white font-semibold">
          <span>Explore</span>
          <span>Details</span>
        </div>
      </div>
    </Link>
  );
}

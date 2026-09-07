// src/pages/Portfolio.jsx
import { Link } from "react-router-dom";
import { getVisiblePortfolioCategories } from "../config/portfolioCategories";

export default function Portfolio() {
  const categories = getVisiblePortfolioCategories();

  return (
    <div className="py-12 px-8 text-center text-white min-h-screen bg-gradient-to-r from-black to-[#222]">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">Portfolio</h2>
      <p className="text-lg mb-8">Select a category to see the work:</p>

      <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 animate-fadeSlideUp">
        {categories.map((category) => (
          <Link key={category.slug} to={category.path} className="group block bg-[#1c1c1c] p-6 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <img
              src={category.previewImage}
              alt={category.previewAlt}
              className="h-48 w-full object-cover object-center rounded-md mb-4"
            />
            <span className="block text-xl font-medium text-white group-hover:text-[#ccc]">{category.title}</span>
          </Link>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm">
        <Link to="/contact?intent=airbrush" className="underline underline-offset-4">Ask About Airbrush Work</Link>
        <Link to="/contact?intent=photoshop" className="underline underline-offset-4">Request Design Work</Link>
        <Link to="/contact?intent=custom-art" className="underline underline-offset-4">Request Custom Artwork</Link>
      </div>
    </div>
  );
}

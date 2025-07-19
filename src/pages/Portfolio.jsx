// src/pages/Portfolio.jsx
import { Link } from "react-router-dom";

export default function Portfolio() {
  return (
    <div className="py-12 px-8 text-center text-white min-h-screen bg-gradient-to-r from-black to-gray-800">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">Portfolio</h2>
      <p className="text-lg mb-8">Select a category to see the work:</p>

      <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 animate-fadeSlideUp">
        <Link to="/portfolio/airbrush" className="block bg-[#1c1c1c] p-8 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transform transition duration-300 hover:-translate-y-1">
          <span role="img" aria-label="Airbrush" className="text-3xl">🎨</span>
          <span className="block mt-2 text-xl">Airbrush</span>
        </Link>

        <Link to="/portfolio/photoshop" className="block bg-[#1c1c1c] p-8 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transform transition duration-300 hover:-translate-y-1">
          <span role="img" aria-label="Photoshop" className="text-3xl">💻</span>
          <span className="block mt-2 text-xl">Photoshop</span>
        </Link>

        <Link to="/portfolio/tattoos" className="block bg-[#1c1c1c] p-8 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transform transition duration-300 hover:-translate-y-1">
          <span role="img" aria-label="Tattoos" className="text-3xl">🖋️</span>
          <span className="block mt-2 text-xl">Tattoos</span>
        </Link>
      </div>
    </div>
  );
}
import { Link } from "react-router-dom";

export default function CTA() {
  return (
    <Link
      to="/shop"
      className="inline-block bg-white text-black text-sm sm:text-base uppercase font-semibold tracking-wide sm:tracking-wider py-2.5 px-6 sm:py-3 sm:px-8 rounded-md transition duration-300 hover:bg-gray-100 shadow-lg"
    >
      SHOP NOW
    </Link>
  );
}
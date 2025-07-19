import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-[1000] flex justify-between items-center px-6 py-2 bg-gradient-to-r from-black to-[#222] text-white shadow-md mb-10">
      {/* Logo */}
      <h1 className="text-[1.4rem] font-bold tracking-[0.03em] font-['Courier_New']">
        Airbrush & Ink
      </h1>

      {/* Links */}
      <ul className="flex items-center list-none text-[0.95rem] font-medium tracking-[0.03em] gap-3">
        <li>
          <Link to="/" className="text-[#ccc] hover:text-white transition-colors">
            Home
          </Link>
        </li>

        <li className="flex items-center relative before:content-[''] before:inline-block before:w-px before:h-4 before:bg-white before:mx-3">
          <Link to="/portfolio" className="text-[#ccc] hover:text-white transition-colors">
            Portfolio
          </Link>
        </li>

        <li className="flex items-center relative before:content-[''] before:inline-block before:w-px before:h-4 before:bg-white before:mx-3">
          <Link to="/contact" className="text-[#ccc] hover:text-white transition-colors">
            Contact
          </Link>
        </li>
      </ul>
    </nav>
  );
}

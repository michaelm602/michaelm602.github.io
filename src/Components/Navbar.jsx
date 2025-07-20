import { Link } from "react-router-dom";
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="sticky top-0 z-[1000] bg-gradient-to-r from-black to-[#222] text-white shadow-md mb-10">
      <div className="flex justify-between items-center px-6 py-2">
        {/* Logo */}
        <h1 className="text-[1.4rem] font-bold tracking-[0.03em] font-['Courier_New']">
          Airbrush & Ink
        </h1>

        {/* Desktop Nav */}
        <ul className="hidden md:flex items-center list-none text-[0.95rem] font-medium tracking-[0.03em] gap-3">
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

        {/* Mobile Icon */}
        <button
          className="md:hidden text-white z-[1100]"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle Menu"
        >
          {menuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`md:hidden fixed top-0 left-0 w-full h-screen flex items-center justify-center transition-all duration-300 ease-in-out z-[1000]
          ${menuOpen ? 'opacity-100 backdrop-blur-md bg-black/80 visible' : 'opacity-0 pointer-events-none'}
        `}
      >
        <div className="flex flex-col items-center justify-center gap-10 text-2xl font-semibold text-white tracking-wide">
          <Link
            to="/"
            onClick={closeMenu}
            className="hover:text-[#ccc] transition-all duration-300 ease-out transform scale-95 hover:scale-100"
          >
            Home
          </Link>
          <Link
            to="/portfolio"
            onClick={closeMenu}
            className="hover:text-[#ccc] transition-all duration-300 ease-out transform scale-95 hover:scale-100"
          >
            Portfolio
          </Link>
          <Link
            to="/contact"
            onClick={closeMenu}
            className="hover:text-[#ccc] transition-all duration-300 ease-out transform scale-95 hover:scale-100"
          >
            Contact
          </Link>
        </div>
      </div>
    </nav>
  );
}

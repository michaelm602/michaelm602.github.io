import { Link } from "react-router-dom";
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaTiktok, FaEnvelope } from "react-icons/fa";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsub();
  }, []);

  const goToServices = () => {
    const currentPath = window.location.hash;

    if (currentPath === "#/") {
      const el = document.getElementById("services");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
      setMenuOpen(false);
    } else {
      sessionStorage.setItem("scrollToServices", "true");
      navigate("/"); // triggers scroll after landing
      setMenuOpen(false);
    }
  };

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-[1000] bg-gradient-to-r from-black to-[#222] text-white shadow-md mb-10">
      <div className="flex justify-between items-center px-6 py-2">
        {/* Logo */}
        <h1 className="font-semibold text-[1.4rem] tracking-[0.03em]">
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
            <button
              onClick={goToServices}
              className="text-[#ccc] hover:text-white transition-colors"
            >
              Portfolio
            </button>
          </li>
          <li className="flex items-center relative before:content-[''] before:inline-block before:w-px before:h-4 before:bg-white before:mx-3">
            <Link to="/contact" className="text-[#ccc] hover:text-white transition-colors">
              Contact
            </Link>
          </li>

          {user && (
            <li className="ml-4">
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-sm rounded bg-gradient-to-r from-black to-[#444] hover:from-[#111] hover:to-[#555] transition-colors"
              >
                Log Out
              </button>
            </li>
          )}
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
          {/* Nav Links */}
          <Link
            to="/"
            onClick={closeMenu}
            className={`transition-all duration-300 ease-out transform scale-95 hover:scale-100 
                        ${menuOpen ? 'animate-slideInLeft delay-[100ms]' : ''}`}
          >
            Home
          </Link>
          <button
            onClick={goToServices}
            className={`transition-all duration-300 ease-out transform scale-95 hover:scale-100 
              ${menuOpen ? 'animate-slideInLeft delay-[200ms]' : ''}`}
          >
            Portfolio
          </button>
          <Link
            to="/contact"
            onClick={closeMenu}
            className={`transition-all duration-300 ease-out transform scale-95 hover:scale-100 
                        ${menuOpen ? 'animate-slideInLeft delay-[300ms]' : ''}`}
          >
            Contact
          </Link>

          {user && (
            <button
              onClick={() => {
                handleLogout();
                closeMenu();
              }}
              className={`text-lg mt-6 px-6 py-2 rounded bg-gradient-to-r from-black to-[#444] hover:from-[#111] hover:to-[#555] transition-colors 
                        ${menuOpen ? 'animate-slideInLeft delay-[400ms]' : ''}`}
            >
              Log Out
            </button>
          )}

          {/* Social Icons */}
          <div className="flex gap-6 mt-8 text-xl text-white">
            <a
              href="https://facebook.com/yourpage"
              target="_blank"
              rel="noopener noreferrer"
              className={`hover:text-[#ccc] transition-colors 
                          ${menuOpen ? 'animate-slideInLeft delay-[400ms]' : ''}`}
              aria-label="Facebook"
            >
              <FaFacebookF />
            </a>
            <a
              href="https://instagram.com/yourhandle"
              target="_blank"
              rel="noopener noreferrer"
              className={`hover:text-[#ccc] transition-colors 
                          ${menuOpen ? 'animate-slideInLeft delay-[500ms]' : ''}`}
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>
            <a
              href="https://tiktok.com/@yourhandle"
              target="_blank"
              rel="noopener noreferrer"
              className={`hover:text-[#ccc] transition-colors 
                          ${menuOpen ? 'animate-slideInLeft delay-[600ms]' : ''}`}
              aria-label="TikTok"
            >
              <FaTiktok />
            </a>
            <a
              href="mailto:your@email.com"
              className={`hover:text-[#ccc] transition-colors 
                          ${menuOpen ? 'animate-slideInLeft delay-[700ms]' : ''}`}
              aria-label="Email"
            >
              <FaEnvelope />
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}

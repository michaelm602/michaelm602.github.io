import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X, ShoppingCart } from "lucide-react";
import { FaFacebookF, FaInstagram, FaTiktok, FaEnvelope } from "react-icons/fa";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import CartDrawer from "./CartDrawer";
import { useCart } from "./CartContext";
import { isAdminUser } from "../utils/admin";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(undefined); // undefined while auth resolves
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { cartItems } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser || null);
    });
    return () => unsub();
  }, []);

  // Don’t render navbar until auth is resolved
  if (user === undefined) return null;

  const isAdmin = isAdminUser(user);

  const closeMenu = () => setMenuOpen(false);

  const goToServices = () => {
    const currentPath = window.location.hash;

    if (currentPath === "#/") {
      const el = document.getElementById("services");
      if (el) el.scrollIntoView({ behavior: "smooth" });
      closeMenu();
    } else {
      sessionStorage.setItem("scrollToServices", "true");
      navigate("/");
      closeMenu();
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    closeMenu();
    navigate("/");
  };

  const goAdmin = () => {
    navigate("/admin");
    closeMenu();
  };

  const goHome = () => {
    navigate("/");
    closeMenu();
  };

  const goContact = () => {
    navigate("/contact");
    closeMenu();
  };

  const goShop = () => {
    navigate("/shop");
    closeMenu();
  };

  const cartCount = cartItems.reduce((t, i) => t + i.quantity, 0);

  return (
    <>
      <nav className="sticky top-0 z-[2000] bg-gradient-to-r from-black to-[#222] text-white shadow-md">
        <div className="flex justify-between items-center px-6 py-2">
          {/* Logo */}
          <Link
            to="/"
            className="font-semibold text-[1.5rem] tracking-[0.03em]"
            onClick={closeMenu}
          >
            Likwit Blvd
          </Link>

          {/* Desktop Nav */}
          <ul className="hidden md:flex items-center text-[0.95rem] font-medium gap-3">
            <li>
              <Link to="/" className="text-[#ccc] hover:text-white">
                Home
              </Link>
            </li>

            <li className="flex items-center relative before:content-[''] before:inline-block before:w-px before:h-4 before:bg-white before:mx-3">
              <button onClick={goToServices} className="text-[#ccc] hover:text-white">
                Portfolio
              </button>
            </li>

            <li className="flex items-center relative before:content-[''] before:inline-block before:w-px before:h-4 before:bg-white before:mx-3">
              <Link to="/contact" className="text-[#ccc] hover:text-white">
                Contact
              </Link>
            </li>

            <li className="flex items-center relative before:content-[''] before:inline-block before:w-px before:h-4 before:bg-white before:mx-3">
              <Link to="/shop" className="text-[#ccc] hover:text-white">
                Shop
              </Link>
            </li>

            {isAdmin && (
              <li className="flex items-center relative before:content-[''] before:inline-block before:w-px before:h-4 before:bg-white before:mx-3">
                <button onClick={goAdmin} className="text-[#ccc] hover:text-white">
                  Admin
                </button>
              </li>
            )}

            {user && (
              <li className="ml-4">
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 text-sm rounded bg-gradient-to-r from-black to-[#444]"
                >
                  Log Out
                </button>
              </li>
            )}
          </ul>

          {/* Right side: Cart + Hamburger */}
          <div className="flex items-center gap-3">
            {/* Cart */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative border border-[#444] p-2 rounded-full"
              aria-label="Cart"
              type="button"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gray-600 text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile Toggle */}
            <button
              className="md:hidden z-[6000]"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle Menu"
              type="button"
            >
              {menuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ✅ Mobile Menu Overlay (outside nav so it can’t get trapped) */}
      <div
        className={`md:hidden fixed inset-0 flex items-center justify-center transition-all duration-300 ease-in-out
          ${menuOpen
            ? "opacity-100 visible pointer-events-auto z-[5000] backdrop-blur-md bg-black/80"
            : "opacity-0 invisible pointer-events-none z-[-1]"
          }
        `}
      >
        <div className="flex flex-col items-center justify-center gap-10 text-2xl font-semibold text-white tracking-wide">
          <button onClick={goHome} className="hover:text-[#ccc] transition-colors">
            Home
          </button>

          <button onClick={goToServices} className="hover:text-[#ccc] transition-colors">
            Portfolio
          </button>

          <button onClick={goContact} className="hover:text-[#ccc] transition-colors">
            Contact
          </button>

          <button onClick={goShop} className="hover:text-[#ccc] transition-colors">
            Shop
          </button>

          {isAdmin && (
            <button onClick={goAdmin} className="hover:text-[#ccc] transition-colors">
              Admin
            </button>
          )}

          {user && (
            <button
              onClick={handleLogout}
              className="text-lg mt-4 px-6 py-2 rounded bg-gradient-to-r from-black to-[#444] hover:opacity-80 transition"
            >
              Log Out
            </button>
          )}

          {/* Social Icons */}
          <div className="flex gap-6 mt-6 text-xl text-white">
            <a
              href="https://facebook.com/yourpage"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#ccc] transition-colors"
              aria-label="Facebook"
            >
              <FaFacebookF />
            </a>

            <a
              href="https://instagram.com/yourhandle"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#ccc] transition-colors"
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>

            <a
              href="https://www.tiktok.com/@thatonehomieguy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#ccc] transition-colors"
              aria-label="TikTok"
            >
              <FaTiktok />
            </a>

            <button onClick={goContact} className="hover:text-[#ccc] transition-colors" aria-label="Contact">
              <FaEnvelope />
            </button>
          </div>

          {/* Tap outside vibe */}
          <button
            onClick={closeMenu}
            className="mt-6 text-sm text-gray-300 hover:text-white transition"
            type="button"
          >
            Close
          </button>
        </div>
      </div>

      {/* Cart Slide-out Overlay */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[4000]"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}

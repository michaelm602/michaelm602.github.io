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
  const [user, setUser] = useState(undefined);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { cartItems } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("AUTH USER:", firebaseUser?.email, firebaseUser?.uid);
      setUser(firebaseUser || null);
    });
    return () => unsub();
  }, []);

  // ⛔ Don't render navbar until auth is resolved
  if (user === undefined) return null;

  const isAdmin = isAdminUser(user);


  const goToServices = () => {
    const currentPath = window.location.hash;

    if (currentPath === "#/") {
      const el = document.getElementById("services");
      if (el) el.scrollIntoView({ behavior: "smooth" });
      setMenuOpen(false);
    } else {
      sessionStorage.setItem("scrollToServices", "true");
      navigate("/");
      setMenuOpen(false);
    }
  };

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const goAdmin = () => {
    navigate("/admin");
    closeMenu();
  };


  return (
    <nav className="sticky top-0 z-[1000] bg-gradient-to-r from-black to-[#222] text-white shadow-md mb-10">
      <div className="flex justify-between items-center px-6 py-2">
        {/* Logo */}
        <Link to="/" className="font-semibold text-[1.5rem] tracking-[0.03em]">
          Likwit Blvd
        </Link>

        {/* Desktop Nav */}
        <ul className="hidden md:flex items-center text-[0.95rem] font-medium gap-3">
          <li><Link to="/" className="text-[#ccc] hover:text-white">Home</Link></li>

          <li className="flex items-center before:w-px before:h-4 before:bg-white before:mx-3">
            <button onClick={goToServices} className="text-[#ccc] hover:text-white">
              Portfolio
            </button>
          </li>

          <li className="flex items-center before:w-px before:h-4 before:bg-white before:mx-3">
            <Link to="/contact" className="text-[#ccc] hover:text-white">
              Contact
            </Link>
          </li>

          <li className="flex items-center before:w-px before:h-4 before:bg-white before:mx-3">
            <Link to="/shop" className="text-[#ccc] hover:text-white">
              Shop
            </Link>
          </li>

          {/* 🔥 ADMIN BUTTON */}
          {isAdmin && (
            <li className="flex items-center before:w-px before:h-4 before:bg-white before:mx-3">
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

        {/* Cart */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative border border-[#444] p-2 rounded-full"
        >
          <ShoppingCart size={20} />
          {cartItems.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-gray-600 text-xs w-5 h-5 flex items-center justify-center rounded-full">
              {cartItems.reduce((t, i) => t + i.quantity, 0)}
            </span>
          )}
        </button>

        {/* Mobile Toggle */}
        <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </nav>
  );
}

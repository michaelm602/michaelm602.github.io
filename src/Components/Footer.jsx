import { FaFacebookF, FaInstagram, FaTiktok, FaEnvelope } from "react-icons/fa";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-black text-gray-400 text-sm py-6 sm:py-5 md:py-9 mt-[2vh] sm:mt-[-5vh] md:mt-[-10vh] lg:mt-[-3vh] border-t border-neutral-800">
      <div className="max-w-screen-xl mx-auto px-4 text-center">
        <p>&copy; 2025 Airbrush & Ink — All rights reserved.</p>

        {/* Social Icons */}
        <div className="mt-4 flex justify-center gap-6 text-lg">
          <a
            href="https://facebook.com/yourpage"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
            aria-label="Facebook"
          >
            <FaFacebookF />
          </a>
          <a
            href="https://instagram.com/yourhandle"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
            aria-label="Instagram"
          >
            <FaInstagram />
          </a>
          <a
            href="https://tiktok.com/@yourhandle"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
            aria-label="TikTok"
          >
            <FaTiktok />
          </a>
          <Link
            to="/contact"
            className="hover:text-white transition-colors"
            aria-label="Contact Page"
          >
            <FaEnvelope />
          </Link>
        </div>
      </div>
    </footer>
  );
}
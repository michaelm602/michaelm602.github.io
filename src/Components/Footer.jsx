import { FaFacebookF, FaInstagram, FaTiktok, FaEnvelope } from "react-icons/fa";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-black text-gray-400 text-sm py-8 border-t border-neutral-800">
      <div className="max-w-screen-xl mx-auto px-4 text-center">
        <p>&copy; {new Date().getFullYear()} Likwit Blvd — All rights reserved.</p>

        {/* Social Icons */}
        <div className="mt-4 flex justify-center gap-6 text-lg">
          <a
            href="https://www.facebook.com/profile.php?id=61587425201456"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
            aria-label="Likwit Blvd Facebook"
          >
            <FaFacebookF />
          </a>

          <a
            href="https://www.instagram.com/likwitblvd/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
            aria-label="Likwit Blvd Instagram"
          >
            <FaInstagram />
          </a>

          <a
            href="https://www.tiktok.com/@likwitblvd?lang=en"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
            aria-label="Likwit Blvd TikTok"
          >
            <FaTiktok />
          </a>

          <Link
            to="/contact"
            className="hover:text-white transition-colors"
            aria-label="Contact Likwit Blvd"
          >
            <FaEnvelope />
          </Link>
        </div>
      </div>
    </footer>
  );
}

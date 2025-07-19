// Footer.jsx
export default function Footer() {
  return (
    <footer className="bg-black text-gray-400 text-sm py-6 border-t border-neutral-800">
      <div className="max-w-screen-xl mx-auto px-4 text-center">
        <p>&copy; 2025 Sonny — All rights reserved.</p>
        <div className="mt-2 flex justify-center gap-4 flex-wrap text-sm">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Instagram
          </a>
          <a
            href="mailto:your@email.com"
            className="hover:text-white transition-colors"
          >
            Email
          </a>
        </div>
      </div>
    </footer>
  );
}

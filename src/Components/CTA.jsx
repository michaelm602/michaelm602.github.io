import { Link } from "react-router-dom";

export default function CTA() {
  return (
    <Link
      to="/shop"
      className="inline-flex justify-center rounded-sm bg-white px-7 py-3 text-sm sm:text-base font-semibold uppercase tracking-[0.12em] text-black shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      SHOP NOW
    </Link>
  );
}

import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center gap-5 px-6 py-16 text-center text-white">
      <p className="text-sm uppercase tracking-widest text-zinc-400">404</p>
      <h1 className="text-3xl font-bold">This page isn’t here.</h1>
      <p className="text-zinc-300">The link may have changed. Find your way back to the artwork below.</p>
      <div className="flex flex-wrap justify-center gap-6">
        <Link to="/portfolio" className="underline underline-offset-4">View the portfolio</Link>
        <Link to="/shop" className="underline underline-offset-4">Shop prints</Link>
        <Link to="/contact" className="underline underline-offset-4">Contact the artist</Link>
      </div>
    </section>
  );
}

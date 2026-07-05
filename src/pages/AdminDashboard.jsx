import { Link } from "react-router-dom";

const ADMIN_SECTIONS = [
  {
    to: "/admin/home",
    title: "Homepage",
    description: "Edit homepage hero images, services, copy, and service artwork.",
  },
  {
    to: "/admin/artwork",
    title: "Artwork & Media",
    description: "Upload and remove airbrush, Photoshop, tattoo, and portfolio video files.",
  },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-black via-[#111] to-[#222] px-4 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">Admin Overview</h1>
        <p className="mt-2 text-white/60">Choose the part of the site you want to manage.</p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {ADMIN_SECTIONS.map((section) => (
            <Link
              key={section.to}
              to={section.to}
              className="rounded-2xl border border-white/10 bg-black/40 p-6 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/5"
            >
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{section.description}</p>
            </Link>
          ))}
        </div>

        <p className="mt-8 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/55">
          Shop products and Stripe Price IDs are maintained in the source catalog, not in Firebase.
        </p>
      </div>
    </div>
  );
}

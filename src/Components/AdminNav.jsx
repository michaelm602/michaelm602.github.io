import { NavLink } from "react-router-dom";

const ADMIN_LINKS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/home", label: "Homepage" },
  { to: "/admin/artwork", label: "Artwork & Media" },
];

export default function AdminNav() {
  return (
    <nav
      aria-label="Admin sections"
      className="border-b border-white/10 bg-black/95 px-4 py-3 text-white"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span className="mr-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
          Admin
        </span>
        {ADMIN_LINKS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `rounded px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-white text-black"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

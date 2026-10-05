import { useEffect, useMemo, useRef, useState } from "react";
import { listAdminArtworkMedia } from "../services/adminArtworkMedia";
import { trapFocusWithin } from "../utils/modalFocus";

function formatLoadError(error) {
  if (error?.code === "storage/unauthorized") {
    return "Artwork browsing was denied. Confirm the admin claim, then sign out and back in.";
  }
  return error?.message || "Unable to load existing artwork.";
}

export default function ArtworkMediaPicker({ open, onClose, onSelect }) {
  const [media, setMedia] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const searchRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      trapFocusWithin(event, dialogRef.current, document.activeElement);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => searchRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;

    setLoading(true);
    setError("");
    setSearch("");
    listAdminArtworkMedia()
      .then((items) => {
        if (active) setMedia(items);
      })
      .catch((loadError) => {
        if (!active) return;
        setMedia([]);
        setError(formatLoadError(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt, open]);

  const filteredMedia = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return media;
    return media.filter((item) =>
      `${item.title} ${item.fullPath}`.toLocaleLowerCase().includes(needle)
    );
  }, [media, search]);

  if (!open) return null;

  const chooseMedia = (item) => {
    onSelect(item);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/85 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="artwork-picker-title"
        aria-describedby="artwork-picker-description"
        className="flex h-[100dvh] w-full flex-col overflow-hidden border-white/15 bg-[#0d0d0d] shadow-2xl sm:max-h-[90vh] sm:max-w-5xl sm:rounded-xl sm:border"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
          <div>
            <h2 id="artwork-picker-title" className="text-lg font-semibold text-white sm:text-xl">
              Choose existing artwork
            </h2>
            <p id="artwork-picker-description" className="mt-1 text-sm text-white/50">
              Select an existing grouped image from <code>airbrush/</code>. No file will be changed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close artwork picker"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/20 text-2xl leading-none text-white/70 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            &times;
          </button>
        </header>

        <div className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-6">
          <label className="block text-sm font-medium text-white/75" htmlFor="artwork-media-search">
            Search artwork
          </label>
          <input
            ref={searchRef}
            id="artwork-media-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search filename or Storage path"
            className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-black px-3 py-2 text-base text-white outline-none placeholder:text-white/30 focus:border-white/50 focus:ring-2 focus:ring-white/15 sm:text-sm"
          />
          {!loading && !error && (
            <p className="mt-2 text-xs text-white/40">
              {filteredMedia.length} of {media.length} grouped artwork files
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
          {loading ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center text-white/55">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" />
              <p className="mt-3 text-sm">Loading artwork...</p>
            </div>
          ) : error ? (
            <div role="alert" className="mx-auto max-w-lg rounded-lg border border-rose-400/30 bg-rose-400/10 p-4 text-center text-sm text-rose-100">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="mt-3 min-h-11 rounded-lg border border-rose-200/30 px-4 py-2 font-semibold hover:bg-rose-200/10 focus:outline-none focus:ring-2 focus:ring-rose-100/50"
              >
                Try again
              </button>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-white/50">
              {media.length === 0
                ? "No artwork is available under airbrush/."
                : "No artwork matches this search."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {filteredMedia.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => chooseMedia(item)}
                  className="group min-w-0 overflow-hidden rounded-lg border border-white/15 bg-black/50 text-left transition hover:border-white/40 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/60"
                  title={`Choose ${item.fullPath}`}
                >
                  <span className="flex aspect-square w-full items-center justify-center overflow-hidden bg-[#171717]">
                    <img
                      src={item.displayUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="block px-2.5 py-3 sm:px-3">
                    <span className="block truncate text-sm font-semibold text-white/90">
                      {item.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-white/40">
                      {item.fullPath}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

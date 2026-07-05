import React, { useState, useEffect, useRef } from "react";
import { storage } from "../firebase";
import {
  ref,
  uploadBytesResumable,
  deleteObject,
  listAll,
  getDownloadURL,
} from "firebase/storage";
import useAdminAuth from "../hooks/useAdminAuth";

/**
 * AdminPanel (deduped)
 * - Groups files by "base name"
 * - Shows ONE tile per artwork:
 *    - grid image prefers __thumb.webp if present
 *    - full image prefers .webp > .jpg/.jpeg > .png
 * - Deletes ALL variants for that base (jpg/webp/thumb/etc)
 *
 * Naming convention supported:
 *   foo.jpg
 *   foo.webp
 *   foo__thumb.webp
 */

function stripExt(name = "") {
  return name.replace(/\.[^.]+$/, "");
}

function getExt(name = "") {
  const m = name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "";
}

function isImage(name = "") {
  const ext = getExt(name);
  return ["jpg", "jpeg", "png", "webp"].includes(ext);
}

function isVideo(name = "") {
  const ext = getExt(name);
  return ["mp4", "webm", "mov", "m4v"].includes(ext);
}

async function safeGetURL(storageRef) {
  try {
    return await getDownloadURL(storageRef);
  } catch {
    return null;
  }
}

const FOLDERS = ["airbrush", "photoshop", "tattoos", "portfolio-videos"];
const FOLDER_LABELS = {
  airbrush: "Airbrush artwork",
  photoshop: "Photoshop artwork",
  tattoos: "Tattoo artwork",
  "portfolio-videos": "Portfolio videos",
};

export default function AdminPanel() {
  const [items, setItems] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState("airbrush");
  const { isAdmin, loading: adminLoading, error: adminError } = useAdminAuth();

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [operationError, setOperationError] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!adminLoading) fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLoading, selectedFolder]);

  const fetchItems = async () => {
    setLoadingItems(true);
    setOperationError("");

    try {
      const listRef = ref(storage, `${selectedFolder}/`);
      const res = await listAll(listRef);

      // If it's portfolio-videos, treat as videos; otherwise images
      const wantVideos = selectedFolder === "portfolio-videos";

      const relevant = res.items.filter((i) =>
        wantVideos ? isVideo(i.name) : isImage(i.name)
      );

      if (wantVideos) {
        // No dedupe needed here (usually), but we can still show clean list
        const vids = await Promise.all(
          relevant.map(async (itemRef) => {
            const url = await safeGetURL(itemRef);
            return {
              kind: "video",
              key: itemRef.name,
              title: stripExt(itemRef.name),
              gridSrc: url,
              fullSrc: url,
              refsToDelete: [itemRef],
            };
          })
        );

        setItems(vids.filter((v) => v.gridSrc));
        return;
      }

      // ---- IMAGE DEDUPE ----
      // Map: realBase -> { webpRef, jpgRef, jpegRef, pngRef, thumbRef, allRefs[] }
      const byBase = new Map();

      for (const item of relevant) {
        const base = stripExt(item.name);
        const ext = getExt(item.name);

        // detect thumbs like foo__thumb.webp
        if (base.endsWith("__thumb")) {
          const realBase = base.replace(/__thumb$/, "");
          if (!byBase.has(realBase)) byBase.set(realBase, { allRefs: [] });
          const entry = byBase.get(realBase);
          entry.thumbRef = item;
          entry.allRefs.push(item);
          continue;
        }

        if (!byBase.has(base)) byBase.set(base, { allRefs: [] });
        const entry = byBase.get(base);

        if (ext === "webp") entry.webpRef = item;
        if (ext === "jpg") entry.jpgRef = item;
        if (ext === "jpeg") entry.jpegRef = item;
        if (ext === "png") entry.pngRef = item;

        entry.allRefs.push(item);
      }

      // sort bases for stable display
      const bases = Array.from(byBase.keys()).sort((a, b) => a.localeCompare(b));

      const formatted = await Promise.all(
        bases.map(async (base) => {
          const entry = byBase.get(base) || {};

          // prefer full webp, then jpg/jpeg, then png
          const fullRef =
            entry.webpRef || entry.jpgRef || entry.jpegRef || entry.pngRef;

          const fullSrc = fullRef ? await safeGetURL(fullRef) : null;

          // prefer thumb for grid
          const thumbSrc = entry.thumbRef ? await safeGetURL(entry.thumbRef) : null;
          const gridSrc = thumbSrc || fullSrc;

          return {
            kind: "image",
            key: base,
            title: base,
            gridSrc,
            fullSrc,
            refsToDelete: entry.allRefs || (fullRef ? [fullRef] : []),
          };
        })
      );

      setItems(formatted.filter((p) => p.gridSrc && p.fullSrc));
    } catch (err) {
      console.error("🔥 Admin list error:", err);
      setItems([]);
      setOperationError(err?.code === "storage/unauthorized"
        ? "Image listing was denied by Firebase Storage."
        : err?.message || "Unable to load images.");
    } finally {
      setLoadingItems(false);
    }
  };

  const handleUpload = async () => {
    if (!isAdmin) {
      setOperationError("This account is not authorized to upload images.");
      return;
    }
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setOperationError("Choose a file before uploading.");
      return;
    }

    const expectsVideo = selectedFolder === "portfolio-videos";
    const validType = expectsVideo ? isVideo(file.name) : isImage(file.name);
    if (!validType) {
      setOperationError(
        expectsVideo
          ? "Portfolio videos must be MP4, WebM, MOV, or M4V files."
          : "Artwork uploads must be JPG, JPEG, PNG, or WebP files."
      );
      return;
    }

    const imageRef = ref(storage, `${selectedFolder}/${file.name}`);
    setUploading(true);
    setUploadProgress(0);
    setOperationError("");

    const uploadTask = uploadBytesResumable(imageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error(error);
        setOperationError(error?.code === "storage/unauthorized"
          ? "Upload denied. Confirm the admin claim, then sign out and back in."
          : error?.message || "Upload failed.");
        setUploading(false);
      },
      async () => {
        try {
          await getDownloadURL(uploadTask.snapshot.ref);
          alert("Upload successful!");
          if (fileInputRef.current) fileInputRef.current.value = "";
          await fetchItems();
        } catch (error) {
          console.error(error);
          setOperationError(error?.message || "The file uploaded, but its public URL could not be loaded.");
        } finally {
          setUploading(false);
        }
      }
    );
  };

  const handleDelete = async (item) => {
    if (!isAdmin) {
      setOperationError("This account is not authorized to delete images.");
      return;
    }

    const count = item.refsToDelete?.length || 1;
    const baseMessage =
      count > 1
        ? `Delete this artwork and ALL ${count} file variants (jpg/webp/thumb)?`
        : "Delete this file?";
    const msg = selectedFolder === "airbrush"
      ? `${baseMessage}\n\nAirbrush files may also be referenced by shop products. Confirm the source catalog before deleting.`
      : baseMessage;

    if (!window.confirm(msg)) return;

    try {
      setOperationError("");
      // delete everything tied to that base
      const refs = item.refsToDelete || [];
      await Promise.all(refs.map((r) => deleteObject(r)));
      alert("Deleted successfully");
      fetchItems();
    } catch (err) {
      console.error(err);
      setOperationError(err?.code === "storage/unauthorized"
        ? "Delete denied. Confirm the admin claim, then sign out and back in."
        : err?.message || "Failed to delete.");
    }
  };

  if (adminError) {
    return <p className="min-h-screen bg-black px-4 py-12 text-center text-red-300">{adminError}</p>;
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-r from-black via-[#111] to-[#222] text-white px-4 pb-12">
      <div
        className="w-full max-w-md p-6 rounded-2xl shadow-lg mb-12 mt-12"
        style={{ background: "linear-gradient(to right, #000, #222)" }}
      >
        <h1 className="text-2xl font-bold text-center mb-2">Manage Artwork & Media</h1>
        <p className="mb-5 text-center text-sm text-white/55">
          Upload or remove files used by public galleries and portfolio media.
        </p>

        <select
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value)}
          aria-label="Storage folder"
          disabled={uploading}
          className="w-full mb-4 p-2 rounded bg-black text-white"
        >
          {FOLDERS.map((folder) => (
            <option key={folder} value={folder}>
              {FOLDER_LABELS[folder]}
            </option>
          ))}
        </select>

        <input
          type="file"
          ref={fileInputRef}
          accept={selectedFolder === "portfolio-videos" ? "video/mp4,video/webm,video/quicktime,video/x-m4v" : "image/jpeg,image/png,image/webp"}
          className="w-full mb-4 p-2 rounded bg-black text-white file:bg-[#222] file:text-white file:border-none"
        />

        <p className="mb-4 text-xs text-white/45">
          Storage destination: <code>/{selectedFolder}/filename</code>
        </p>

        {uploading && (
          <div className="w-full bg-gray-700 rounded mb-2">
            <div
              className="bg-blue-500 h-2 rounded"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        <button
          onClick={handleUpload}
          className="w-full py-3 rounded-md font-semibold transition bg-gradient-to-r from-black to-[#222] hover:opacity-80"
          disabled={uploading || !isAdmin}
          title={!isAdmin ? "Admin only" : ""}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>

        {!adminLoading && !isAdmin && (
          <p className="mt-3 text-xs text-gray-400 text-center">
            This account is not authorized to upload or delete files.
          </p>
        )}

        {operationError && (
          <p role="alert" className="mt-3 text-sm text-red-300 text-center">
            {operationError}
          </p>
        )}
      </div>

      {loadingItems ? (
        <div className="flex justify-center items-center h-40">
          <svg
            className="animate-spin h-8 w-8 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-label="Loading"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
            />
          </svg>
        </div>
      ) : (
        <>
          {items.length === 0 ? (
            <p className="text-gray-400">No files found in {selectedFolder}.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {items.map((it) => (
                <div
                  key={it.key}
                  className="flex flex-col items-center justify-between w-full h-[420px]"
                >
                  {it.kind === "video" ? (
                    <video
                      src={it.gridSrc}
                      controls
                      className="w-[290px] h-[300px] sm:w-[400px] sm:h-[350px] rounded-md shadow-md bg-black"
                    />
                  ) : (
                    <img
                      src={it.gridSrc}
                      alt={it.title}
                      className="object-contain w-[290px] h-[300px] sm:w-[400px] sm:h-[350px] rounded-md shadow-md"
                      loading="lazy"
                      decoding="async"
                    />
                  )}

                  <div className="mt-2 text-sm text-gray-300 text-center line-clamp-1">
                    {it.title}
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(it)}
                      className="mt-2 px-4 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

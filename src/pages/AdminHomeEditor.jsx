// src/pages/AdminHomeEditor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { homeContent as FALLBACK } from "../content/homeContent";

const ADMIN_EMAIL = "airbrushnink@gmail.com";

// ---- helpers ----
function normalizeHome(data) {
    return {
        heroImages: Array.isArray(data?.heroImages) ? data.heroImages : [],
        services: Array.isArray(data?.services) ? data.services : [],
    };
}

async function uploadFileAndGetURL(file, path) {
    const fileRef = ref(storage, path);
    const task = uploadBytesResumable(fileRef, file);

    await new Promise((resolve, reject) => {
        task.on("state_changed", null, reject, resolve);
    });

    return await getDownloadURL(task.snapshot.ref);
}

function withTimeout(promise, ms, label = "Operation") {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export default function AdminHomeEditor() {
    const [user, setUser] = useState(null);
    const [userLoaded, setUserLoaded] = useState(false);

    const isAdmin = useMemo(() => {
        return (
            userLoaded &&
            user?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()
        );
    }, [userLoaded, user]);

    const [loading, setLoading] = useState(true);

    // content
    const [heroImages, setHeroImages] = useState(FALLBACK.heroImages || []);
    const [services, setServices] = useState(FALLBACK.services || []);



    // status UI
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveOk, setSaveOk] = useState(false);
    const [saveErr, setSaveErr] = useState("");
    const [lastSavedAt, setLastSavedAt] = useState(null);

    const heroFileRef = useRef(null);

    const markDirty = () => {
        setDirty(true);
        setSaveOk(false);
        setSaveErr("");
    };

    // auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setUserLoaded(true);
        });
        return () => unsub();
    }, []);

    // load Firestore content
    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setSaveErr("");
            try {
                const snap = await withTimeout(
                    getDoc(doc(db, "siteContent", "home")),
                    12000,
                    "Load home content"
                );

                if (snap.exists()) {
                    const data = normalizeHome(snap.data());
                    if (data.heroImages.length) setHeroImages(data.heroImages);
                    if (data.services.length) setServices(data.services);
                }

                // fresh load = not dirty
                setDirty(false);
                setSaveOk(false);
                setLastSavedAt(null);
            } catch (e) {
                console.error("Load home content failed:", e);
                setSaveErr(e?.message || "Failed to load.");
            } finally {
                setLoading(false);
            }
        };

        if (userLoaded) run();
    }, [userLoaded]);

    const saveAll = async () => {
        if (!isAdmin) return alert("Not authorized.");
        if (!navigator.onLine) {
            setSaveErr("You look offline. Check internet, then try again.");
            return;
        }

        setSaving(true);
        setSaveOk(false);
        setSaveErr("");

        try {
            await withTimeout(
                setDoc(
                    doc(db, "siteContent", "home"),
                    {
                        heroImages,
                        services,
                        updatedAt: serverTimestamp(),
                    },
                    { merge: true }
                ),
                15000,
                "Save home content"
            );

            setDirty(false);
            setSaveOk(true);
            setLastSavedAt(new Date());

            // auto-hide the “Saved ✓” glow after a bit (feels nicer)
            setTimeout(() => setSaveOk(false), 2500);
        } catch (e) {
            console.error("Save failed:", e);
            setSaveErr(e?.message || "Save failed. Check console.");
        } finally {
            setSaving(false);
        }
        console.log("Saving to Firestore:", {
            heroImages,
            services,
            project: import.meta.env.VITE_FIREBASE_PROJECT_ID
        });
    };

    // HERO handlers
    const addHeroImage = async () => {
        if (!isAdmin) return alert("Not authorized.");
        const file = heroFileRef.current?.files?.[0];
        if (!file) return alert("Choose a hero image first.");

        try {
            setSaving(true);
            setSaveErr("");
            setSaveOk(false);

            const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "_");
            const url = await withTimeout(
                uploadFileAndGetURL(file, `site/home/hero/${safeName}`),
                30000,
                "Hero upload"
            );

            setHeroImages((prev) => {
                const next = [...prev, url];
                return next;
            });

            if (heroFileRef.current) heroFileRef.current.value = "";
            markDirty();
        } catch (e) {
            console.error(e);
            setSaveErr(e?.message || "Hero upload failed.");
        } finally {
            setSaving(false);
        }
    };

    const removeHeroImage = (idx) => {
        setHeroImages((prev) => prev.filter((_, i) => i !== idx));
        markDirty();
    };

    const moveHero = (idx, dir) => {
        setHeroImages((prev) => {
            const next = [...prev];
            const swapIdx = idx + dir;
            if (swapIdx < 0 || swapIdx >= next.length) return prev;
            [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
            return next;
        });
        markDirty();
    };

    // SERVICES handlers
    const updateService = (idx, patch) => {
        setServices((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], ...patch };
            return next;
        });
        markDirty();
    };

    const addService = () => {
        setServices((prev) => [
            ...prev,
            {
                tag: "NEW",
                title: "New Service",
                description: "Type something here.",
                image: "",
                link: "/portfolio",
            },
        ]);
        markDirty();
    };

    const removeService = (idx) => {
        setServices((prev) => prev.filter((_, i) => i !== idx));
        markDirty();
    };

    const uploadServiceImage = async (idx, file) => {
        if (!isAdmin) return alert("Not authorized.");
        if (!file) return;

        try {
            setSaving(true);
            setSaveErr("");
            setSaveOk(false);

            const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "_");
            const url = await withTimeout(
                uploadFileAndGetURL(file, `site/home/services/${safeName}`),
                30000,
                "Service image upload"
            );

            updateService(idx, { image: url });
        } catch (e) {
            console.error(e);
            setSaveErr(e?.message || "Service image upload failed.");
        } finally {
            setSaving(false);
        }
    };

    const saveButtonLabel = saving
        ? "Saving..."
        : saveErr
            ? "Save Failed"
            : saveOk
                ? "Saved ✓"
                : dirty
                    ? "Save Changes"
                    : "Up to date";

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white">
                Loading Home editor...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-r from-black via-[#111] to-[#222] text-white px-4 pb-16">
            <div className="max-w-5xl mx-auto pt-10">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-bold">Edit Home Page</h1>

                        <div className="mt-2 flex items-center gap-3 text-sm">
                            {dirty ? (
                                <span className="text-yellow-300">Unsaved changes</span>
                            ) : (
                                <span className="text-gray-400">No unsaved changes</span>
                            )}

                            {saveOk && (
                                <span className="text-green-300">
                                    Saved {lastSavedAt ? `(${lastSavedAt.toLocaleTimeString()})` : ""}
                                </span>
                            )}

                            {saveErr && (
                                <span className="text-red-300">
                                    Save failed — {saveErr}
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={saveAll}
                        disabled={!isAdmin || saving || (!dirty && !saveErr)}
                        className="px-4 py-2 rounded bg-white text-black font-semibold disabled:opacity-40 flex items-center gap-2"
                        title={!isAdmin ? "Admin only" : ""}
                    >
                        {saving && (
                            <span
                                className="inline-block h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin"
                                aria-label="Saving"
                            />
                        )}
                        {saveButtonLabel}
                    </button>
                </div>

                {!isAdmin && (
                    <p className="mt-2 text-sm text-gray-400">
                        You’re logged in, but you’re not admin — editing is locked.
                    </p>
                )}

                {/* HERO EDITOR */}
                <div className="mt-10 p-6 rounded-2xl bg-black/40 border border-white/10">
                    <h2 className="text-xl font-bold mb-4">Hero Images</h2>

                    <div className="flex gap-3 items-center flex-wrap">
                        <input
                            type="file"
                            ref={heroFileRef}
                            className="bg-black text-white rounded p-2"
                            accept="image/*"
                            disabled={!isAdmin || saving}
                        />
                        <button
                            onClick={addHeroImage}
                            disabled={!isAdmin || saving}
                            className="px-4 py-2 rounded bg-gradient-to-r from-black to-[#222] border border-white/10 disabled:opacity-40"
                        >
                            Upload Hero Image
                        </button>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {heroImages.map((url, idx) => (
                            <div
                                key={url + idx}
                                className="rounded-xl overflow-hidden bg-black/50 border border-white/10"
                            >
                                <img
                                    src={url}
                                    alt={`Hero ${idx + 1}`}
                                    className="w-full h-44 object-cover"
                                />
                                <div className="p-3 flex items-center justify-between gap-2">
                                    <div className="text-xs text-gray-300 truncate">#{idx + 1}</div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => moveHero(idx, -1)}
                                            disabled={!isAdmin || idx === 0 || saving}
                                            className="px-2 py-1 text-xs rounded bg-white/10 disabled:opacity-30"
                                        >
                                            Up
                                        </button>
                                        <button
                                            onClick={() => moveHero(idx, 1)}
                                            disabled={!isAdmin || idx === heroImages.length - 1 || saving}
                                            className="px-2 py-1 text-xs rounded bg-white/10 disabled:opacity-30"
                                        >
                                            Down
                                        </button>
                                        <button
                                            onClick={() => removeHeroImage(idx)}
                                            disabled={!isAdmin || saving}
                                            className="px-2 py-1 text-xs rounded bg-red-600 disabled:opacity-30"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {heroImages.length === 0 && (
                        <p className="mt-4 text-gray-400">No hero images yet.</p>
                    )}
                </div>

                {/* SERVICES EDITOR */}
                <div className="mt-10 p-6 rounded-2xl bg-black/40 border border-white/10">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <h2 className="text-xl font-bold">Service Cards</h2>
                        <button
                            onClick={addService}
                            disabled={!isAdmin || saving}
                            className="px-4 py-2 rounded bg-white/10 border border-white/10 disabled:opacity-40"
                        >
                            + Add Service
                        </button>
                    </div>

                    <div className="mt-6 space-y-8">
                        {services.map((s, idx) => (
                            <div
                                key={idx}
                                className="p-5 rounded-xl bg-black/50 border border-white/10"
                            >
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="min-w-[280px] flex-1">
                                        <label className="text-sm text-gray-300">Tag</label>
                                        <input
                                            value={s.tag || ""}
                                            onChange={(e) => updateService(idx, { tag: e.target.value })}
                                            disabled={!isAdmin || saving}
                                            className="w-full mt-1 p-2 rounded bg-black border border-white/10"
                                        />
                                    </div>

                                    <div className="min-w-[280px] flex-1">
                                        <label className="text-sm text-gray-300">Title</label>
                                        <input
                                            value={s.title || ""}
                                            onChange={(e) => updateService(idx, { title: e.target.value })}
                                            disabled={!isAdmin || saving}
                                            className="w-full mt-1 p-2 rounded bg-black border border-white/10"
                                        />
                                    </div>

                                    <div className="min-w-[280px] flex-1">
                                        <label className="text-sm text-gray-300">Link</label>
                                        <input
                                            value={s.link || ""}
                                            onChange={(e) => updateService(idx, { link: e.target.value })}
                                            disabled={!isAdmin || saving}
                                            className="w-full mt-1 p-2 rounded bg-black border border-white/10"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="text-sm text-gray-300">Description</label>
                                    <textarea
                                        value={s.description || ""}
                                        onChange={(e) => updateService(idx, { description: e.target.value })}
                                        disabled={!isAdmin || saving}
                                        rows={5}
                                        className="w-full mt-1 p-2 rounded bg-black border border-white/10"
                                        placeholder={"Use line breaks freely.\n\nThey will render."}
                                    />
                                </div>

                                <div className="mt-4 flex items-center gap-4 flex-wrap">
                                    <div className="flex-1 min-w-[260px]">
                                        <label className="text-sm text-gray-300">Card Image</label>
                                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                disabled={!isAdmin || saving}
                                                onChange={(e) => uploadServiceImage(idx, e.target.files?.[0])}
                                                className="bg-black text-white rounded p-2"
                                            />
                                            <button
                                                onClick={() => removeService(idx)}
                                                disabled={!isAdmin || saving}
                                                className="px-3 py-2 rounded bg-red-600 disabled:opacity-40"
                                            >
                                                Delete Card
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-full sm:w-[360px]">
                                        {s.image ? (
                                            <img
                                                src={s.image}
                                                alt={s.title || "Service image"}
                                                className="w-full h-40 object-cover rounded-lg border border-white/10"
                                            />
                                        ) : (
                                            <div className="w-full h-40 rounded-lg border border-white/10 flex items-center justify-center text-gray-400">
                                                No image yet
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {services.length === 0 && (
                        <p className="mt-4 text-gray-400">No service cards yet.</p>
                    )}
                </div>

                <div className="mt-10 text-xs text-gray-400">
                    Uploading images updates the URL immediately, but you still need to click Save to write everything to Firestore.
                </div>
            </div>
        </div>
    );
}

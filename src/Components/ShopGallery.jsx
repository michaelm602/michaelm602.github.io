import { useEffect, useState } from "react";
import { useCart } from "../Components/CartContext";
import { getStorage, ref, listAll, getDownloadURL } from "firebase/storage";
import { sizePriceMap } from "../utils/sizePricing";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";


export default function ShopGallery({ initialFolder = "airbrush", onAddToCart }) {
    const [folder, setFolder] = useState(initialFolder);
    const [items, setItems] = useState([]);
    const [selectedOptions, setSelectedOptions] = useState({});
    const [loading, setLoading] = useState(true);

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);



    const { addToCart } = useCart();

    const storage = getStorage();

    const folders = ["airbrush"];

    const defaultSizes = Object.keys(sizePriceMap);
    const defaultQuantity = 5;

    useEffect(() => {
        let alive = true;

        const stripExt = (name = "") => name.replace(/\.[^.]+$/, "");
        const getExt = (name = "") => {
            const m = name.match(/\.([^.]+)$/);
            return m ? m[1].toLowerCase() : "";
        };

        const isImage = (name = "") => {
            const ext = getExt(name);
            return ["jpg", "jpeg", "png", "webp"].includes(ext);
        };

        const fetchImages = async () => {
            setLoading(true);

            try {
                const folderRef = ref(storage, `${folder}`);
                const result = await listAll(folderRef);

                // 1) only image files
                const imageRefs = result.items.filter((r) => isImage(r.name));

                // 2) group by base name, ignore thumbs
                // base -> { webpRef, jpgRef, pngRef }
                const byBase = new Map();

                for (const itemRef of imageRefs) {
                    const name = itemRef.name;

                    // ignore thumbs completely
                    if (name.toLowerCase().endsWith("__thumb.webp")) continue;

                    const base = stripExt(name);       // e.g. "20260131_173401" or "Title__5"
                    const ext = getExt(name);

                    if (!byBase.has(base)) byBase.set(base, {});
                    const entry = byBase.get(base);

                    if (ext === "webp") entry.webpRef = itemRef;
                    if (ext === "jpg" || ext === "jpeg") entry.jpgRef = itemRef;
                    if (ext === "png") entry.pngRef = itemRef;
                }

                // 3) pick best display ref per base (webp > jpg > png)
                const bases = Array.from(byBase.keys()).sort((a, b) => a.localeCompare(b));

                const itemsWithMeta = await Promise.all(
                    bases.map(async (base) => {
                        const entry = byBase.get(base) || {};
                        const bestRef = entry.webpRef || entry.jpgRef || entry.pngRef;

                        if (!bestRef) return null;

                        const url = await getDownloadURL(bestRef);

                        // Your existing title/quantity logic uses "__"
                        const [titleRaw, quantityRaw] = base.split("__");
                        const title = titleRaw || "Untitled";
                        const quantity = quantityRaw || defaultQuantity;

                        return {
                            title,
                            quantity,
                            sizes: defaultSizes,
                            url,
                            // optional: keep base/ref name for debugging
                            // base,
                            // file: bestRef.name,
                        };
                    })
                );

                const clean = itemsWithMeta.filter(Boolean);

                if (alive) setItems(clean);
            } catch (err) {
                console.error("🔥 Storage error:", err?.message || err);
                if (alive) setItems([]);
            } finally {
                if (alive) setLoading(false);
            }
        };

        fetchImages();

        return () => {
            alive = false;
        };
    }, [folder]);



    const handleSizeChange = (index, value) => {
        setSelectedOptions((prev) => ({
            ...prev,
            [index]: { ...prev[index], size: value }
        }));
    };

    const handleQuantityChange = (index, value) => {
        setSelectedOptions((prev) => ({
            ...prev,
            [index]: { ...prev[index], quantity: value }
        }));
    };

    return (
        <div className="text-white px-4">
            {/* 🔽 Folder Selector */}
            <div className="flex justify-center mb-8">
                <select
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    className="bg-zinc-800 text-white border border-zinc-600 px-4 py-2 rounded"
                >
                    {folders.map((f) => (
                        <option key={f} value={f}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {/* 🖼️ Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-20">
                {items.map((item, i) => (
                    <div key={i} className="bg-zinc-800 p-4 rounded-lg shadow-md flex flex-col">
                        <img
                            src={item.url}
                            alt={item.title}
                            className="w-full max-h-64 object-contain mb-4 rounded cursor-pointer"
                            onClick={() => {
                                setCurrentIndex(i);
                                setLightboxOpen(true);
                            }}
                        />

                        <h2 className="text-xl font-semibold mb-1">{item.title}</h2>

                        <label className="block mb-1 text-sm">Size:</label>
                        <select
                            className="w-full p-2 mb-3 rounded bg-zinc-700 text-white"
                            onChange={(e) => handleSizeChange(i, e.target.value)}
                            value={selectedOptions[i]?.size || ""}
                        >
                            <option value="">Select size</option>
                            {item.sizes?.map((s, idx) => (
                                <option key={idx} value={s}>
                                    {s} — ${sizePriceMap[s] || "?"}
                                </option>
                            ))}
                        </select>

                        <label className="block mb-1 text-sm">Quantity:</label>
                        <select
                            className="w-full p-2 mb-3 rounded bg-zinc-700 text-white"
                            onChange={(e) => handleQuantityChange(i, e.target.value)}
                            value={selectedOptions[i]?.quantity || 1}
                        >
                            {Array.from({ length: Number(item.quantity) }, (_, k) => k + 1).map((q) => (
                                <option key={q} value={q}>
                                    {q}
                                </option>
                            ))}
                        </select>

                        <button
                            className="w-full bg-gradient-to-r from-[#111] to-[#333] hover:from-[#222] hover:to-[#444] text-white border border-[#444] py-2 rounded mt-auto transition-colors duration-300"
                            onClick={() => {
                                const selectedSize = selectedOptions[i]?.size;
                                const selectedQty = parseInt(selectedOptions[i]?.quantity || 1);
                                const price = sizePriceMap[selectedSize] || 0;

                                addToCart({
                                    title: item.title,
                                    size: selectedSize,
                                    quantity: selectedQty,
                                    price,
                                    image: item.url, // ✅ This fixes the broken image
                                });

                                if (onAddToCart) onAddToCart();
                                sessionStorage.setItem("openCartOnReturn", "true")
                                toast.success(`${selectedQty} of "${item.title}" added to cart!`);
                            }}
                            disabled={!selectedOptions[i]?.size}
                        >
                            Add to Cart
                        </button>
                    </div>
                ))}


            </div>

            {/* 📭 No Items Fallback */}
            {loading && (
                <div className="col-span-full text-center mt-12">
                    <svg
                        className="animate-spin h-8 w-8 text-white mx-auto"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                        ></path>
                    </svg>
                    <p className="mt-4 text-sm text-gray-400">Loading products...</p>
                </div>
            )}

            {!loading && items.length === 0 && (
                <p className="text-white col-span-full text-center mt-12">
                    No products found in <span className="font-semibold">{folder}</span>.
                </p>
            )}


            <Lightbox
                open={lightboxOpen}
                close={() => setLightboxOpen(false)}
                index={currentIndex}
                slides={items.map((item) => ({ src: item.url }))}
                animation={{ fade: 250 }}
                styles={{
                    container: {
                        backdropFilter: 'blur(10px)',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        WebkitBackdropFilter: 'blur(10px)',
                    },
                    slide: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    },
                }}
                render={{
                    slide: ({ slide }) => (
                        <img
                            src={slide.src}
                            alt={slide.caption}
                            style={{
                                maxWidth: '90vw',
                                maxHeight: '90vh',
                                objectFit: 'contain',
                            }}
                        />
                    ),
                }}
            />

        </div>
    );
}

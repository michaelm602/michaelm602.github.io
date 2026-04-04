import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useCart } from "../Components/CartContext";
import {
    getAllProducts,
    getDefaultProductSize,
    getPrimaryProductImage,
    getProductMinPrice,
    getProductPrice,
    getProductSizeOptions,
} from "../data/products";
import { resolveProductImageUrl } from "../utils/productImageUrls";

export default function ShopGallery({ initialFolder = "airbrush" }) {
    const [selectedOptions, setSelectedOptions] = useState({});
    const [imageUrls, setImageUrls] = useState({});
    const [loading, setLoading] = useState(true);
    const { addToCart } = useCart();

    const products = useMemo(() => {
        const allProducts = getAllProducts();
        if (initialFolder === "airbrush") {
            return allProducts.filter((product) => product.category?.toLowerCase().includes("airbrush"));
        }
        return allProducts;
    }, [initialFolder]);

    useEffect(() => {
        let alive = true;

        const fetchImages = async () => {
            setLoading(true);

            try {
                const entries = await Promise.all(
                    products.map(async (product) => {
                        const primaryImage = getPrimaryProductImage(product);
                        if (!primaryImage) return [product.id, null];

                        try {
                            const url = await resolveProductImageUrl(primaryImage, "thumb");
                            return [product.id, url];
                        } catch (error) {
                            console.error(`Shop image load failed for "${product.title}"`, error);
                            return [product.id, null];
                        }
                    })
                );

                if (alive) {
                    setImageUrls(Object.fromEntries(entries));
                }
            } finally {
                if (alive) setLoading(false);
            }
        };

        fetchImages();

        return () => {
            alive = false;
        };
    }, [products]);

    const handleSizeChange = (productId, value) => {
        setSelectedOptions((prev) => ({
            ...prev,
            [productId]: { ...prev[productId], size: value },
        }));
    };

    const handleQuantityChange = (productId, value) => {
        setSelectedOptions((prev) => ({
            ...prev,
            [productId]: { ...prev[productId], quantity: value },
        }));
    };

    return (
        <div className="text-white px-4">
            <p className="text-center text-zinc-500 text-xs uppercase tracking-widest mb-8">
                Airbrush Prints - All Made to Order
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-20">
                {loading ? (
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
                ) : products.length === 0 ? (
                    <p className="col-span-full text-white text-center mt-12">
                        No products found in <span className="font-semibold">{initialFolder}</span>.
                    </p>
                ) : (
                    products.map((product) => {
                        const sizeOptions = getProductSizeOptions(product);
                        const defaultSize = getDefaultProductSize(product);
                        const selectedSize = selectedOptions[product.id]?.size || "";
                        const selectedQty = parseInt(selectedOptions[product.id]?.quantity || 1, 10);
                        const imageUrl = imageUrls[product.id];
                        const primaryImage = getPrimaryProductImage(product);

                        return (
                            <div key={product.id} className="bg-zinc-800 p-4 rounded-lg shadow-md flex flex-col">
                                <Link to={`/shop/${product.slug}`} className="block hover:opacity-80 transition-opacity">
                                    {imageUrl ? (
                                        <img
                                            src={imageUrl}
                                            alt={primaryImage?.alt || product.title}
                                            className="w-full h-64 object-contain bg-zinc-900 mb-4 rounded cursor-pointer p-2"
                                        />
                                    ) : (
                                        <div className="w-full h-64 bg-zinc-900 mb-4 rounded p-2 flex items-center justify-center text-zinc-500 text-sm">
                                            Image unavailable
                                        </div>
                                    )}
                                    <h2 className="text-xl font-semibold mb-1">{product.title}</h2>
                                </Link>
                                <p className="text-xs text-zinc-400 mb-1">
                                    {product.shortDescription || product.description}
                                </p>
                                <p className="text-sm text-zinc-300 mb-3">
                                    From ${getProductMinPrice(product)}
                                </p>

                                <label className="block mb-1 text-sm">Size:</label>
                                <select
                                    className="w-full p-2 mb-3 rounded bg-zinc-700 text-white"
                                    onChange={(e) => handleSizeChange(product.id, e.target.value)}
                                    value={selectedSize}
                                >
                                    <option value="">Select size</option>
                                    {sizeOptions.map((size) => (
                                        <option key={size.label} value={size.label}>
                                            {size.label} - ${size.price}
                                        </option>
                                    ))}
                                </select>

                                <label className="block mb-1 text-sm">Quantity:</label>
                                <select
                                    className="w-full p-2 mb-3 rounded bg-zinc-700 text-white"
                                    onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                    value={selectedQty}
                                >
                                    {[1, 2, 3, 4, 5].map((quantity) => (
                                        <option key={quantity} value={quantity}>
                                            {quantity}
                                        </option>
                                    ))}
                                </select>

                                {!selectedSize && (
                                    <p className="text-xs text-zinc-500 text-center mb-2">
                                        Select a size to continue
                                    </p>
                                )}
                                <button
                                    className="w-full bg-gradient-to-r from-[#111] to-[#333] hover:from-[#222] hover:to-[#444] text-white border border-[#444] py-2 rounded mt-auto transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => {
                                        if (!selectedSize) {
                                            toast.warn("Please select a size first.");
                                            return;
                                        }

                                        const price = getProductPrice(product, selectedSize) || defaultSize?.price || 0;

                                        addToCart({
                                            productId: product.id,
                                            title: product.title,
                                            size: selectedSize,
                                            quantity: selectedQty,
                                            price,
                                            image: imageUrl,
                                        });

                                        window.dispatchEvent(new Event("open-cart"));
                                        toast.success(`${selectedQty} of "${product.title}" added to cart!`);
                                    }}
                                    disabled={!selectedSize}
                                >
                                    Own This Piece
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

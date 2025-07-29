import React, { useState } from "react";

export default function ProductCard({ product }) {
    const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || "");
    const [quantity, setQuantity] = useState(1);

    return (
        <div className="bg-white/5 p-4 rounded-lg shadow-lg flex flex-col">
            <img
                src={product.url}
                alt={product.title}
                className="w-full h-64 object-cover rounded mb-4"
            />
            <h3 className="text-lg font-bold mb-2">{product.title}</h3>
            <p className="text-sm mb-2 text-white/70">${product.price}</p>

            <div className="mb-2">
                <label className="text-xs mb-1 block">Size</label>
                <select
                    className="w-full bg-black text-white p-2 rounded"
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                >
                    {product.sizes?.map((size, idx) => (
                        <option key={idx} value={size}>
                            {size}
                        </option>
                    ))}
                </select>
            </div>

            <div className="mb-4">
                <label className="text-xs mb-1 block">Quantity</label>
                <select
                    className="w-full bg-black text-white p-2 rounded"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                >
                    {Array.from({ length: product.quantity }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                            {i + 1}
                        </option>
                    ))}
                </select>
            </div>

            <button className="w-full mt-auto py-2 rounded bg-white text-black font-semibold hover:bg-gray-200 transition">
                Add to Cart
            </button>
        </div>
    );
}

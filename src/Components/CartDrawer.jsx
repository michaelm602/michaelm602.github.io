import React, { useState } from "react";
import { useCart } from "./CartContext";
import { X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export default function CartDrawer({ isOpen, onClose }) {
    const { cartItems, removeFromCart, clearCart, updateCartItem } = useCart();
    const [isEditing, setIsEditing] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div
            className={`fixed top-0 right-0 h-full w-80 bg-gradient-to-r from-black to-[#222] text-white shadow-lg transform transition-transform z-[1200] ${isOpen ? "translate-x-0" : "translate-x-full"
                }`}
        >
            <div className="flex items-center justify-between px-4 py-5 border-b border-gray-300">
                <h2 className="text-lg font-bold">Your Cart</h2>
                <button onClick={onClose}>
                    <X size={24} />
                </button>
            </div>

            <div className="p-4 overflow-y-auto h-[calc(100%-190px)]">
                {cartItems.map((item, index) => (
                    <div key={index} className="flex flex-col gap-2 mb-4 border-b pb-3">
                        <div className="flex items-center gap-4">
                            <img
                                src={item.image}
                                alt={item.title}
                                className="w-16 h-16 object-cover rounded shadow"
                            />
                            <div className="flex-1">
                                <h3 className="font-semibold text-white">{item.title}</h3>
                                {isEditing ? (
                                    <>
                                        <div className="flex items-center gap-2 mt-2">
                                            <label className="text-sm mr-1">Qty:</label>
                                            <button
                                                onClick={() =>
                                                    item.quantity > 1 &&
                                                    updateCartItem(index, { quantity: item.quantity - 1 })
                                                }
                                                className="w-7 h-7 bg-zinc-700 text-white rounded hover:bg-zinc-600"
                                            >
                                                –
                                            </button>
                                            <span className="px-2 w-6 text-center">{item.quantity}</span>
                                            <button
                                                onClick={() =>
                                                    updateCartItem(index, { quantity: item.quantity + 1 })
                                                }
                                                className="w-7 h-7 bg-zinc-700 text-white rounded hover:bg-zinc-600"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <label className="text-sm">Size:</label>
                                            <select
                                                value={item.size}
                                                onChange={(e) =>
                                                    updateCartItem(index, { size: e.target.value })
                                                }
                                                className="w-full px-2 py-1 rounded text-black"
                                            >
                                                <option value="16x20">16x20</option>
                                                <option value="18x24">18x24</option>
                                                <option value="24x36">24x36</option>
                                                <option value="30x40">30x40</option>
                                            </select>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-white/80">
                                            Size: {item.size} — Qty: {item.quantity}
                                        </p>
                                        <p className="text-sm text-white/90">
                                            ${item.price * item.quantity}
                                        </p>
                                    </>
                                )}
                                {isEditing && (
                                    <button
                                        onClick={() => removeFromCart(index)}
                                        className="text-red-500 text-xs mt-2"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-gray-300 flex flex-col gap-2">
                <div className="flex justify-between gap-2">
                    <button
                        className="w-1/2 bg-gradient-to-r from-black to-[#222] text-white py-2 rounded hover:bg-green-700"
                        onClick={() => setIsEditing((prev) => !prev)}
                        disabled={cartItems.length === 0}
                    >
                        {isEditing ? "Done" : "Edit Cart"}
                    </button>

                    <button
                        className="w-1/2 bg-gradient-to-r from-black to-[#222] text-white py-2 rounded hover:bg-blue-700"
                        onClick={() => {
                            onClose();
                            navigate("/checkout");
                        }}
                        disabled={cartItems.length === 0}
                    >
                        Checkout
                    </button>
                </div>

                <button
                    className="w-full text-sm text-red-500 underline"
                    onClick={clearCart}
                    disabled={cartItems.length === 0}
                >
                    Clear Cart
                </button>
            </div>
        </div>
    );
}

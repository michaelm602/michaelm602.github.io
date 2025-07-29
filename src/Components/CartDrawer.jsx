import React from "react";
import { useCart } from "./CartContext";
import { X } from "lucide-react";

export default function CartDrawer({ isOpen, onClose }) {
    const { cartItems, removeFromCart, clearCart } = useCart();

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

            <div className="p-4 overflow-y-auto h-[calc(100%-170px)]">
                {cartItems.length === 0 ? (
                    <p className="text-gray-500 text-center mt-10">Your shopping bag is empty</p>
                ) : (
                    cartItems.map((item, index) => (
                        <div key={index} className="mb-4 border-b pb-3">
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="text-sm text-white">
                                Size: {item.size} — Qty: {item.quantity}
                            </p>
                            <p className="text-sm text-white">${item.price * item.quantity}</p>
                            <button
                                onClick={() => removeFromCart(index)}
                                className="text-red-500 text-xs mt-2"
                            >
                                Remove
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t border-gray-300">
                <button
                    className="w-full bg-gradient-to-r from-black to-[#222] text-white py-2 rounded hover:bg-green-700 mb-2"
                    disabled={cartItems.length === 0}
                >
                    Checkout / Edit Cart
                </button>
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

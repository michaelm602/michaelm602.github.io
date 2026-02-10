import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "./CartContext";
import { X } from "lucide-react";
import { stripeLinks } from "../utils/stripeLinks";
import usePayPalScript from "../utils/usePayPalScript";
import emailjs from "@emailjs/browser";

export default function CartDrawer({ isOpen, onClose }) {
    const { cartItems, removeFromCart, clearCart, updateCartItem } = useCart();
    const [isEditing, setIsEditing] = useState(false);
    const [isPayPalReady, setIsPayPalReady] = useState(false);

    const PAYPAL_CLIENT_ID =
        "AU5aAM3bPf_1lmA--7fuKSvlkyW5imXLRM4a2be_xgyiv4mYJU14v_KJviRqwy67-p5uNjchLtHurRg4";

    usePayPalScript(PAYPAL_CLIENT_ID, () => setIsPayPalReady(true));

    const paypalRenderedRef = useRef(false);

    const total = useMemo(
        () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        [cartItems]
    );

    const cartSignature = useMemo(() => {
        return JSON.stringify(
            cartItems.map((i) => ({
                title: i.title,
                size: i.size,
                price: i.price,
                quantity: i.quantity,
                image: i.image,
            }))
        );
    }, [cartItems]);


    useEffect(() => {
        if (!isOpen) return; // only render when drawer is open
        if (!isPayPalReady) return;

        const containerId = "paypal-button-container";
        const container = document.getElementById(containerId);
        if (!container) return;

        if (paypalRenderedRef.current && container.children.length) return;


        // If cart empty, clear and bail
        if (cartItems.length === 0) {
            container.innerHTML = "";
            paypalRenderedRef.current = false;
            return;
        }

        // Always re-render buttons when cartSignature changes
        container.innerHTML = "";
        paypalRenderedRef.current = false;

        try {
            window.paypal
                .Buttons({
                    createOrder: (data, actions) => {
                        return actions.order.create({
                            purchase_units: [
                                {
                                    amount: {
                                        currency_code: "USD",
                                        value: total.toFixed(2),
                                        breakdown: {
                                            item_total: {
                                                currency_code: "USD",
                                                value: total.toFixed(2),
                                            },
                                        },
                                    },
                                    description: "Likwit Blvd Art Order",
                                    custom_id: "AIRBRUSH_ORDER_" + Date.now(),
                                    items: cartItems.map((item) => ({
                                        name: item.title,
                                        description: `Size: ${item.size}`,
                                        unit_amount: {
                                            currency_code: "USD",
                                            value: Number(item.price).toFixed(2),
                                        },
                                        quantity: String(item.quantity),
                                        category: "PHYSICAL_GOODS",
                                    })),
                                },
                            ],
                        });
                    },

                    onApprove: async (data, actions) => {
                        try {
                            const details = await actions.order.capture();
                            const { name, email_address } = details.payer;

                            const itemsForEmail = cartItems.map((item) => ({
                                name: `${item.title} — ${item.size}`,
                                units: item.quantity,
                                price: (item.price * item.quantity).toFixed(2),
                                image_url: item.image,
                            }));

                            const cost = {
                                shipping: (0).toFixed(2),
                                tax: (0).toFixed(2),
                                total: total.toFixed(2),
                            };

                            await emailjs.send(
                                "service_6j3le5o",
                                "template_dxmzwa3",
                                {
                                    name: `${name.given_name} ${name.surname}`,
                                    message: "New PayPal order received!",
                                    order_id: data.orderID,
                                    email: email_address,
                                    orders: itemsForEmail,
                                    cost,
                                },
                                "OLAEWsvf8PTH1I8A-"
                            );

                            console.log("✅ Order email sent!");
                            alert("Payment successful via PayPal!");
                            clearCart();
                            onClose();

                            // reset so next open re-renders clean
                            paypalRenderedRef.current = false;
                        } catch (err) {
                            console.error("PayPal error:", err);
                            alert("Something went wrong with PayPal.");
                        }
                    },

                    onError: (err) => {
                        console.error("PayPal error:", err);
                        alert("Something went wrong with PayPal.");
                    },
                })
                .render(`#${containerId}`);

            paypalRenderedRef.current = true;
        } catch (e) {
            console.error("PayPal render failed:", e);
        }

        // cleanup when drawer closes/unmounts
        return () => {
            const c = document.getElementById(containerId);
            if (c) c.innerHTML = "";
            paypalRenderedRef.current = false;
        };
    }, [
        isOpen,
        isPayPalReady,
        cartSignature, // 🔥 key: only changes when cart content changes
        total,
        clearCart,
        onClose,
    ]);

    const testCheckout = async () => {
        try {
            const line_items = cartItems.map((item) => {
                const priceId = stripeLinks[item.title]?.[item.size];
                if (!priceId) {
                    throw new Error(
                        `Missing Stripe price ID for ${item.title} - ${item.size}`
                    );
                }
                return {
                    price: priceId,
                    quantity: item.quantity,
                };
            });

            const response = await fetch(
                "https://us-central1-airbrushnink-9f735.cloudfunctions.net/createStripeCheckoutSessionLive",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ items: line_items }),
                }
            );

            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error("Stripe Checkout URL not returned:", data);
            }
        } catch (err) {
            console.error("Checkout failed:", err.message);
        }
    };


    return (
        <div
            className={`fixed top-0 right-0 h-full w-80 
  bg-gradient-to-r from-black to-[#222] 
  text-white shadow-lg transform transition-transform
  z-[4500] pointer-events-auto
  ${isOpen ? "translate-x-0" : "translate-x-full"}
`}
        >
            <div className="flex items-center justify-between px-4 py-5 border-b border-gray-300">
                <h2 className="text-lg font-bold">Your Cart</h2>
                <button onClick={onClose}>
                    <X size={24} />
                </button>
            </div>

            <div className="p-4 overflow-y-auto h-[calc(100%-435px)]">
                {cartItems.map((item, index) => (
                    <div
                        key={index}
                        className="flex flex-col gap-2 mb-4 border-b pb-3"
                    >
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
                                                    updateCartItem(index, {
                                                        quantity: item.quantity - 1,
                                                    })
                                                }
                                                className="w-7 h-7 bg-zinc-700 text-white rounded hover:bg-zinc-600"
                                            >
                                                –
                                            </button>
                                            <span className="px-2 w-6 text-center">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() =>
                                                    updateCartItem(index, {
                                                        quantity: item.quantity + 1,
                                                    })
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
                <div className="flex justify-between text-sm text-white mb-3">
                    <span className="font-semibold">Total:</span>
                    <span className="font-semibold">${total.toLocaleString()}</span>
                </div>

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
                        onClick={testCheckout}
                        disabled={cartItems.length === 0}
                    >
                        Checkout
                    </button>
                </div>

                {cartItems.length > 0 && (
                    <div className="mt-4" id="paypal-button-container"></div>
                )}

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

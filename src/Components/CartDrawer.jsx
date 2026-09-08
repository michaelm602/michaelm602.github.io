import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "./CartContext";
import { X } from "lucide-react";
import {
    getProductSizeOptions,
    resolveCartItemProduct,
} from "../data/products";
import usePayPalScript from "../utils/usePayPalScript";
import { buildOrderItems, saveOrderToFirestore } from "../utils/orderUtils";
import {
    PRINT_CHECKOUT_ACKNOWLEDGEMENT,
    PRINT_SALES_CONTACT_EMAIL,
    PRINT_SALES_POLICY,
    getPrintPolicyDisclosureState,
    isPrintPolicyAcknowledgedForCart,
    startAcknowledgedPrintCheckout,
} from "../utils/printCheckoutPolicy";
import emailjs from "@emailjs/browser";
import toast from "react-hot-toast";

export default function CartDrawer({ isOpen, onClose }) {
    const { cartItems, removeFromCart, clearCart, updateCartItem } = useCart();
    const [isEditing, setIsEditing] = useState(false);
    const [isPayPalReady, setIsPayPalReady] = useState(false);
    const [acknowledgedCartSignature, setAcknowledgedCartSignature] = useState(null);
    const [acknowledgementError, setAcknowledgementError] = useState("");
    const [isPolicyReviewOpen, setIsPolicyReviewOpen] = useState(false);

    const PAYPAL_CLIENT_ID =
        "AU5aAM3bPf_1lmA--7fuKSvlkyW5imXLRM4a2be_xgyiv4mYJU14v_KJviRqwy67-p5uNjchLtHurRg4";

    usePayPalScript(PAYPAL_CLIENT_ID, () => setIsPayPalReady(true));

    const paypalRenderedRef = useRef(false);
    const acknowledgedCartSignatureRef = useRef(null);
    const previousCartSignatureRef = useRef(null);

    const total = useMemo(
        () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        [cartItems]
    );

    const cartSignature = useMemo(() => {
        return JSON.stringify(
            cartItems.map((item) => ({
                productId: item.productId || null,
                title: item.title,
                size: item.size,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
            }))
        );
    }, [cartItems]);

    const policyAcknowledged = isPrintPolicyAcknowledgedForCart(
        acknowledgedCartSignature,
        cartSignature,
        cartItems.length
    );
    const policyDisclosure = getPrintPolicyDisclosureState({
        acknowledged: policyAcknowledged,
        reviewRequested: isPolicyReviewOpen,
    });
    const [policyBeforeEmail, policyAfterEmail] = PRINT_SALES_POLICY.split(
        PRINT_SALES_CONTACT_EMAIL
    );

    const resetPolicyAcknowledgement = useCallback(() => {
        setAcknowledgedCartSignature(null);
        acknowledgedCartSignatureRef.current = null;
        setAcknowledgementError("");
        setIsPolicyReviewOpen(false);
    }, []);

    useEffect(() => {
        const cartChanged =
            previousCartSignatureRef.current !== null &&
            previousCartSignatureRef.current !== cartSignature;

        previousCartSignatureRef.current = cartSignature;

        if (cartChanged || !isOpen) {
            resetPolicyAcknowledgement();
        }
    }, [cartSignature, isOpen, resetPolicyAcknowledgement]);

    useEffect(() => {
        if (!isOpen) return;
        if (!isPayPalReady) return;

        const containerId = "paypal-button-container";
        const container = document.getElementById(containerId);
        if (!container) return;

        if (paypalRenderedRef.current && container.children.length) return;

        if (cartItems.length === 0) {
            container.innerHTML = "";
            paypalRenderedRef.current = false;
            return;
        }

        container.innerHTML = "";
        paypalRenderedRef.current = false;

        try {
            window.paypal
                .Buttons({
                    onClick: async (_data, actions) => {
                        const result = await startAcknowledgedPrintCheckout(
                            acknowledgedCartSignatureRef.current === cartSignature,
                            () => actions.resolve()
                        );

                        if (!result.started) {
                            setAcknowledgementError(result.error);
                            return actions.reject();
                        }

                        setAcknowledgementError("");
                        return undefined;
                    },

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
                            const capture = details.purchase_units?.[0]?.payments?.captures?.[0] || null;
                            const buyerInfo = {
                                name: `${name.given_name} ${name.surname}`.trim(),
                                email: email_address,
                                payerId: details.payer?.payer_id || null,
                            };
                            const fulfilledItems = buildOrderItems(
                                cartItems.map((item) => ({
                                    ...item,
                                    productId: item.productId || resolveCartItemProduct(item)?.id || null,
                                }))
                            );

                            const itemsForEmail = cartItems.map((item) => ({
                                name: `${item.title} - ${item.size}`,
                                units: item.quantity,
                                price: (item.price * item.quantity).toFixed(2),
                                image_url: item.image,
                            }));

                            const cost = {
                                shipping: (0).toFixed(2),
                                tax: (0).toFixed(2),
                                total: total.toFixed(2),
                            };

                            await saveOrderToFirestore(fulfilledItems, buyerInfo, {
                                status: "paid",
                                paymentProvider: "paypal",
                                paypalOrderId: data.orderID,
                                paypalCaptureId: capture?.id || null,
                                paypalPayerId: details.payer?.payer_id || null,
                                orderTotal: Number(total.toFixed(2)),
                                currency: capture?.amount?.currency_code || "USD",
                                paymentStatus: capture?.status || "COMPLETED",
                                captureStatus: capture?.status || "COMPLETED",
                            });

                            await emailjs.send(
                                "service_6j3le5o",
                                "template_dxmzwa3",
                                {
                                    name: buyerInfo.name,
                                    message: "New PayPal order received!",
                                    order_id: data.orderID,
                                    email: buyerInfo.email,
                                    orders: itemsForEmail,
                                    cost,
                                },
                                "OLAEWsvf8PTH1I8A-"
                            );

                            toast.success("Payment successful! Order confirmation sent.");
                            clearCart();
                            resetPolicyAcknowledgement();
                            onClose();

                            paypalRenderedRef.current = false;
                        } catch (err) {
                            console.error("PayPal error:", err);
                            toast.error("Something went wrong with PayPal. Please try again.");
                        }
                    },

                    onError: (err) => {
                        console.error("PayPal error:", err);
                        toast.error("Something went wrong with PayPal. Please try again.");
                    },
                })
                .render(`#${containerId}`);

            paypalRenderedRef.current = true;
        } catch (e) {
            console.error("PayPal render failed:", e);
        }

        return () => {
            const c = document.getElementById(containerId);
            if (c) c.innerHTML = "";
            paypalRenderedRef.current = false;
        };
    }, [
        isOpen,
        isPayPalReady,
        cartSignature,
        total,
        clearCart,
        onClose,
        cartItems,
        resetPolicyAcknowledgement,
    ]);

    const startStripeCheckout = async () => {
        try {
            const items = cartItems.map((item) => ({
                productId:
                    item.productId || resolveCartItemProduct(item)?.id || null,
                size: item.size,
                quantity: item.quantity,
            }));

            const baseUrl = import.meta.env.PROD
                ? "https://www.likwitblvd.com"
                : window.location.origin;

            const response = await fetch(
                "https://us-central1-airbrushnink-9f735.cloudfunctions.net/createStripeCheckoutSession",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        items,
                        successUrl: `${baseUrl}/success?status=success&provider=stripe`,
                        cancelUrl: `${baseUrl}/cancel?status=cancel&provider=stripe`,
                    }),
                }
            );

            const data = await response.json().catch(() => ({}));
            if (response.ok && data.url) {
                try {
                    if (data.orderId) sessionStorage.setItem("pendingStripeOrderId", data.orderId);
                } catch { /* non-fatal */ }
                window.location.href = data.url;
            } else {
                toast.error("Checkout failed. Please try again.");
                console.error("Stripe checkout session error:", data?.error || data);
            }
        } catch (err) {
            toast.error("Checkout failed. Please try again.");
            console.error("Checkout failed:", err.message);
        }
    };

    const handleStripeCheckout = async () => {
        const result = await startAcknowledgedPrintCheckout(
            policyAcknowledged,
            startStripeCheckout
        );
        setAcknowledgementError(result.error);
    };

    const handlePolicyAcknowledgement = (event) => {
        const nextSignature = event.target.checked ? cartSignature : null;
        setAcknowledgedCartSignature(nextSignature);
        acknowledgedCartSignatureRef.current = nextSignature;
        setIsPolicyReviewOpen(false);

        if (event.target.checked) {
            setAcknowledgementError("");
        }
    };

    const handleClose = () => {
        resetPolicyAcknowledgement();
        onClose();
    };

    return (
        <div
            className={`fixed top-0 right-0 h-full w-80 flex flex-col
  bg-gradient-to-r from-black to-[#222]
  text-white shadow-lg transform transition-transform
  z-[4500] pointer-events-auto
  ${isOpen ? "translate-x-0" : "translate-x-full"}
`}
        >
            <div className="flex items-center justify-between px-4 py-5 border-b border-gray-300 flex-shrink-0">
                <h2 className="text-lg font-bold">Your Cart</h2>
                <button onClick={handleClose} aria-label="Close cart">
                    <X size={24} />
                </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
                {cartItems.map((item, index) => {
                    const product = resolveCartItemProduct(item);
                    const sizeOptions = getProductSizeOptions(product);

                    return (
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
                                                    -
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
                                                    {(sizeOptions.length ? sizeOptions : [
                                                        { label: "16x20" },
                                                        { label: "18x24" },
                                                        { label: "24x36" },
                                                        { label: "30x40" },
                                                    ]).map((size) => (
                                                        <option key={size.label} value={size.label}>
                                                            {size.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm text-white/80">
                                                Size: {item.size} - Qty: {item.quantity}
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
                    );
                })}
            </div>

            <div className="p-4 border-t border-gray-300 flex flex-col gap-2 flex-shrink-0">
                <div className="flex justify-between text-sm text-white mb-3">
                    <span className="font-semibold">Total:</span>
                    <span className="font-semibold">${total.toLocaleString()}</span>
                </div>

                {cartItems.length > 0 && (
                    <section
                        aria-labelledby="print-policy-title"
                        className={`mb-2 rounded border transition-colors ${
                            policyDisclosure.expanded
                                ? "border-white/15 bg-white/[0.04] p-3"
                                : "border-white/20 bg-white/[0.07] px-3 py-2.5"
                        }`}
                    >
                        {policyDisclosure.expanded ? (
                            <div id="print-policy-details">
                                <div className="flex items-start justify-between gap-3">
                                    <h3
                                        id="print-policy-title"
                                        className="text-xs font-semibold text-white"
                                    >
                                        Made-to-order print policy
                                    </h3>
                                    {policyAcknowledged && (
                                        <button
                                            type="button"
                                            onClick={() => setIsPolicyReviewOpen(false)}
                                            aria-expanded="true"
                                            aria-controls="print-policy-details"
                                            className="shrink-0 text-xs text-zinc-300 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                        >
                                            Hide details
                                        </button>
                                    )}
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                                    {policyBeforeEmail}
                                    <a
                                        href={`mailto:${PRINT_SALES_CONTACT_EMAIL}`}
                                        className="text-white underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                    >
                                        {PRINT_SALES_CONTACT_EMAIL}
                                    </a>
                                    {policyAfterEmail}
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2.5">
                                <input
                                    id="print-checkout-acknowledgement"
                                    type="checkbox"
                                    checked={policyAcknowledged}
                                    onChange={handlePolicyAcknowledgement}
                                    className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-white"
                                />
                                <div className="min-w-0 flex-1">
                                    <label
                                        id="print-policy-title"
                                        htmlFor="print-checkout-acknowledgement"
                                        className="block cursor-pointer text-xs leading-relaxed text-zinc-200"
                                    >
                                        <span className="font-semibold text-white">Policy acknowledged</span>
                                        <span className="block text-zinc-400">
                                            Made-to-order print sales are final once submitted to production.
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsPolicyReviewOpen(true)}
                                        aria-expanded="false"
                                        aria-controls="print-policy-details"
                                        className="mt-1 text-xs text-zinc-300 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                    >
                                        Review policy
                                    </button>
                                </div>
                            </div>
                        )}

                        {policyDisclosure.expanded && (
                            <div className="mt-3 flex items-start gap-2.5 border-t border-white/10 pt-3">
                                <input
                                    id="print-checkout-acknowledgement"
                                    type="checkbox"
                                    checked={policyAcknowledged}
                                    onChange={handlePolicyAcknowledgement}
                                    aria-describedby={acknowledgementError ? "print-checkout-acknowledgement-error" : undefined}
                                    className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-white"
                                />
                                <label
                                    htmlFor="print-checkout-acknowledgement"
                                    className="cursor-pointer text-xs leading-relaxed text-zinc-200"
                                >
                                    {PRINT_CHECKOUT_ACKNOWLEDGEMENT}
                                </label>
                            </div>
                        )}

                        {acknowledgementError && (
                            <p
                                id="print-checkout-acknowledgement-error"
                                role="alert"
                                className="mt-2 text-xs leading-relaxed text-red-300"
                            >
                                {acknowledgementError}
                            </p>
                        )}
                    </section>
                )}

                <div className="flex justify-between gap-2">
                    <button
                        className="w-1/2 border border-white/30 text-white py-2 rounded hover:bg-white/10 hover:border-white/60 transition-colors duration-200 disabled:opacity-40"
                        onClick={() => setIsEditing((prev) => !prev)}
                        disabled={cartItems.length === 0}
                    >
                        {isEditing ? "Done" : "Edit Cart"}
                    </button>
                    <button
                        className="w-1/2 bg-white text-black font-semibold py-2 rounded hover:bg-gray-100 transition-colors duration-200 disabled:opacity-40"
                        onClick={handleStripeCheckout}
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

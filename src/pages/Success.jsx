import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, Clock3, Mail, ShoppingBag } from "lucide-react";
import { useCart } from "../Components/CartContext";

const ORDER_STATUS_URL =
    "https://us-central1-airbrushnink-9f735.cloudfunctions.net/getOrderStatus";
const ORDER_STATUS_POLL_MS = 2000;
const MAX_ORDER_STATUS_ATTEMPTS = 15;

function readPendingStripeOrderId() {
    try {
        return sessionStorage.getItem("pendingStripeOrderId");
    } catch {
        return null;
    }
}

function clearPendingStripeOrderId() {
    try {
        sessionStorage.removeItem("pendingStripeOrderId");
    } catch {
        // Non-fatal if storage is unavailable.
    }
}

export default function Success() {
    const location = useLocation();
    const { clearCart } = useCart();
    const didClearCartRef = useRef(false);
    const [orderStatus, setOrderStatus] = useState("processing");
    const [orderLookupFailed, setOrderLookupFailed] = useState(false);

    const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const provider = params.get("provider");
    const status = params.get("status");
    const orderId = params.get("orderId");
    const isStripeSuccess = provider === "stripe" && status === "success";

    useEffect(() => {
        if (!isStripeSuccess || didClearCartRef.current) return;

        const pendingStripeOrderId = readPendingStripeOrderId();
        const orderMatchesPending = pendingStripeOrderId && (!orderId || orderId === pendingStripeOrderId);
        const hasCheckoutOrder = Boolean(orderId || pendingStripeOrderId);

        if (hasCheckoutOrder && (orderMatchesPending || !pendingStripeOrderId)) {
            clearCart();
            clearPendingStripeOrderId();
            didClearCartRef.current = true;
        }
    }, [clearCart, isStripeSuccess, orderId]);

    useEffect(() => {
        if (!isStripeSuccess || !orderId) return;

        let stopped = false;
        let timeoutId = null;
        let attempts = 0;

        const scheduleRetry = () => {
            if (!stopped && attempts < MAX_ORDER_STATUS_ATTEMPTS) {
                timeoutId = window.setTimeout(
                    checkOrderStatus,
                    ORDER_STATUS_POLL_MS
                );
            }
        };

        const checkOrderStatus = async () => {
            attempts += 1;

            try {
                const response = await fetch(ORDER_STATUS_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderId }),
                });
                if (!response.ok) throw new Error("Order status request failed");

                const result = await response.json();
                if (stopped) return;

                setOrderLookupFailed(false);
                const confirmed =
                    result?.exists === true &&
                    result?.status === "paid" &&
                    result?.paymentStatus === "paid" &&
                    result?.confirmationState === "confirmed";
                setOrderStatus(confirmed ? "paid" : "processing");

                if (!confirmed) scheduleRetry();
            } catch {
                if (stopped) return;
                setOrderLookupFailed(true);
                setOrderStatus("processing");
                scheduleRetry();
            }
        };

        checkOrderStatus();

        return () => {
            stopped = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [isStripeSuccess, orderId]);

    const isConfirmed = orderStatus === "paid";

    return (
        <div className="min-h-screen bg-[#080808] text-white px-5 py-16 sm:py-24">
            <div className="mx-auto flex min-h-[72vh] max-w-3xl flex-col items-center justify-center text-center">
                <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                    {isConfirmed ? <CheckCircle2 size={34} /> : <Clock3 size={34} />}
                </div>

                <p className="mb-4 text-xs uppercase tracking-[0.28em] text-zinc-500">
                    {isConfirmed ? "Payment Confirmed" : "Payment Received"}
                </p>

                <h1 className="mb-5 max-w-2xl text-3xl font-semibold leading-tight sm:text-5xl">
                    Thank you. Your order is in.
                </h1>

                <p className="mb-8 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                    Stripe has returned you safely to Likwit Blvd. Your order confirmation is handled by the secure Stripe webhook, so it may take a moment for the final paid status to appear here.
                </p>

                <div className="mb-9 grid w-full gap-3 text-left sm:grid-cols-3">
                    <div className="border border-white/10 bg-white/[0.03] p-4">
                        <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">Order</p>
                        <p className="break-all text-sm text-zinc-200">{orderId || "Processing"}</p>
                    </div>
                    <div className="border border-white/10 bg-white/[0.03] p-4">
                        <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">Status</p>
                        <p className="text-sm text-zinc-200">
                            {isConfirmed ? "Confirmed by Stripe" : "Confirmation processing"}
                        </p>
                    </div>
                    <div className="border border-white/10 bg-white/[0.03] p-4">
                        <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">Next</p>
                        <p className="text-sm text-zinc-200">A confirmation email will follow.</p>
                    </div>
                </div>

                {orderLookupFailed && (
                    <p className="mb-7 max-w-xl text-sm text-amber-200">
                        We could not refresh the order status in this browser, but your payment return was received. Keep your Stripe receipt email for reference.
                    </p>
                )}

                <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
                    <Link
                        to="/shop"
                        className="inline-flex items-center justify-center gap-2 rounded-sm bg-white px-7 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                        <ShoppingBag size={17} />
                        Back to Shop
                    </Link>
                    <Link
                        to="/contact"
                        className="inline-flex items-center justify-center gap-2 rounded-sm border border-white/20 px-7 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                        <Mail size={17} />
                        Need Help?
                    </Link>
                </div>
            </div>
        </div>
    );
}

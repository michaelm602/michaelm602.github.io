import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ShoppingBag, XCircle } from "lucide-react";

function clearMatchingPendingStripeOrderId(orderId) {
    try {
        const pendingOrderId = sessionStorage.getItem("pendingStripeOrderId");
        if (pendingOrderId && (!orderId || pendingOrderId === orderId)) {
            sessionStorage.removeItem("pendingStripeOrderId");
        }
    } catch {
        // Non-fatal if storage is unavailable.
    }
}

export default function Cancel() {
    const location = useLocation();
    const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const provider = params.get("provider");
    const status = params.get("status");
    const orderId = params.get("orderId");
    const isStripeCancel = provider === "stripe" && status === "cancel";

    useEffect(() => {
        if (isStripeCancel) clearMatchingPendingStripeOrderId(orderId);
    }, [isStripeCancel, orderId]);

    const openCart = () => {
        window.dispatchEvent(new Event("open-cart"));
    };

    return (
        <div className="min-h-screen bg-[#080808] text-white px-5 py-16 sm:py-24">
            <div className="mx-auto flex min-h-[72vh] max-w-2xl flex-col items-center justify-center text-center">
                <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-500/30 bg-white/[0.04] text-zinc-300">
                    <XCircle size={34} />
                </div>

                <p className="mb-4 text-xs uppercase tracking-[0.28em] text-zinc-500">
                    Checkout Canceled
                </p>

                <h1 className="mb-5 text-3xl font-semibold leading-tight sm:text-5xl">
                    No charge was made.
                </h1>

                <p className="mb-8 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                    You left Stripe Checkout before completing payment. Your cart is still saved, so you can review it, make changes, or come back later.
                </p>

                {orderId && (
                    <div className="mb-9 w-full border border-white/10 bg-white/[0.03] p-4 text-left">
                        <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">Pending checkout</p>
                        <p className="break-all text-sm text-zinc-300">{orderId}</p>
                    </div>
                )}

                <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
                    <button
                        type="button"
                        onClick={openCart}
                        className="inline-flex items-center justify-center gap-2 rounded-sm bg-white px-7 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                        <ShoppingBag size={17} />
                        Review Cart
                    </button>
                    <Link
                        to="/shop"
                        className="inline-flex items-center justify-center gap-2 rounded-sm border border-white/20 px-7 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                        <ArrowLeft size={17} />
                        Back to Shop
                    </Link>
                </div>
            </div>
        </div>
    );
}

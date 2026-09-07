import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../Components/CartContext";
import ShopGallery from "../Components/ShopGallery";
import { toast } from "react-hot-toast";
import { PRINT_SALES_CONTACT_EMAIL } from "../utils/printCheckoutPolicy";

export default function ShopPage() {
    const location = useLocation();
    const { clearCart, setIsCartOpen } = useCart();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const status = params.get("status");
        const provider = params.get("provider");
        const orderId = params.get("orderId");

        const pendingStripeOrderId = (() => {
            try {
                return sessionStorage.getItem("pendingStripeOrderId");
            } catch {
                return null;
            }
        })();

        if (provider === "stripe" && status === "success") {
            toast.success("Payment received. We're confirming your order now.");
            if (pendingStripeOrderId && (!orderId || orderId === pendingStripeOrderId)) {
                clearCart();
                try {
                    sessionStorage.removeItem("pendingStripeOrderId");
                } catch {
                    // ignore session storage failures
                }
            }
        } else if (provider === "stripe" && status === "cancel") {
            toast.error("Stripe checkout cancelled. Your cart was preserved.");
            if (pendingStripeOrderId && (!orderId || orderId === pendingStripeOrderId)) {
                try {
                    sessionStorage.removeItem("pendingStripeOrderId");
                } catch {
                    // ignore session storage failures
                }
            }
        } else if (status === "success") {
            toast.success("Payment successful!");
        } else if (status === "cancel") {
            toast.error("Checkout canceled.");
        }

        if (location.state?.openCart) {
            setIsCartOpen(true);
            window.history.replaceState({}, document.title);
        }
    }, [clearCart, location, setIsCartOpen]);

    return (
        <div className="relative min-h-screen pt-24 px-4 text-white">
            {/* Background AIRBRUSH text */}
            <div aria-hidden="true" className="absolute
    top-[-1rem] sm:top-[0rem] md:top-[-3rem] lg:top-[-5rem]
    left-1/2 transform -translate-x-1/2
    text-[15vw] sm:text-[15vw] md:text-[15vw] lg:text-[15vw]
    max-w-[100vw] overflow-hidden whitespace-nowrap
    font-extrabold text-white opacity-5 tracking-widest
    pointer-events-none select-none z-0">
                AIRBRUSH
            </div>

            {/* Foreground content */}
            <div className="relative z-10 text-center">
                <h1 className="text-4xl font-bold mb-3">Shop Prints</h1>
                <p className="text-zinc-300 text-sm mb-4 max-w-xl mx-auto leading-relaxed">
                    You’re shopping made-to-order prints of my artwork. An original canvas is only
                    for sale when explicitly listed; sold originals can still have prints available.
                </p>
                <section
                    aria-labelledby="made-to-order-print-heading"
                    className="mb-10 max-w-2xl mx-auto border border-white/15 bg-black/30 px-5 py-4"
                >
                    <h2
                        id="made-to-order-print-heading"
                        className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-white"
                    >
                        Made-to-order prints
                    </h2>
                    <p className="text-zinc-300 text-sm leading-relaxed">
                        After payment, I submit your print order to a professional print production
                        partner using your shipping information. The partner produces and fulfills
                        the print, and production and shipping times may vary. Print sales are final
                        once submitted to production.
                    </p>
                    <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
                        Questions before ordering? <Link to="/contact?intent=print" className="underline underline-offset-4 text-zinc-200">Contact the artist</Link> or email{" "}
                        <a href={`mailto:${PRINT_SALES_CONTACT_EMAIL}`} className="underline underline-offset-4 text-zinc-200">
                            {PRINT_SALES_CONTACT_EMAIL}
                        </a>.
                    </p>
                </section>
                <ShopGallery onAddToCart={() => setIsCartOpen(true)} />
            </div>
        </div>
    );
}

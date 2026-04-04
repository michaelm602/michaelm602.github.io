import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCart } from "../Components/CartContext";
import ShopGallery from "../Components/ShopGallery";
import { toast } from "react-hot-toast";

export default function ShopPage() {
    const location = useLocation();
    const { setIsCartOpen } = useCart();

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
    }, [location, setIsCartOpen]);

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
                <h1 className="text-4xl font-bold mb-3">Shop</h1>
                <p className="text-zinc-400 text-sm mb-10 max-w-md mx-auto leading-relaxed">
                    Every print is made to order — hand-finished, limited in run.
                    No reprints. No restocks. Once it's gone, it's gone.
                </p>
                <ShopGallery onAddToCart={() => setIsCartOpen(true)} />
            </div>
        </div>
    );
}

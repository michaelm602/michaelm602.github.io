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

        if (status === "success") {
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
            <h1 className="absolute 
    top-[-1rem] sm:top-[0rem] md:top-[-3rem] lg:top-[-5rem] 
    left-1/2 transform -translate-x-1/2 
    text-[15vw] sm:text-[15vw] md:text-[15vw] lg:text-[15vw] 
    max-w-[100vw] overflow-hidden whitespace-nowrap
    font-extrabold text-white opacity-5 tracking-widest 
    pointer-events-none select-none z-0">
                AIRBRUSH
            </h1>

            {/* Foreground content */}
            <div className="relative z-10 text-center">
                <h1 className="text-4xl font-bold mb-4">Shop</h1>
                <ShopGallery onAddToCart={() => setIsCartOpen(true)} />
            </div>
        </div>
    );
}

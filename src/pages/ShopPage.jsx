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

        // If coming from checkout and should open cart
        if (location.state?.openCart) {
            setIsCartOpen(true);
            window.history.replaceState({}, document.title);
        }
    }, [location, setIsCartOpen]);

    return (
        <div className="min-h-screen pt-24 px-4 text-white">
            <h1 className="text-4xl font-bold text-center mb-12">Shop</h1>
            <ShopGallery onAddToCart={() => setIsCartOpen(true)} />
        </div>
    );
}

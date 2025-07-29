import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCart } from "../Components/CartContext";
import ShopGallery from "../components/ShopGallery";

export default function ShopPage() {
    const location = useLocation();
    const { setIsCartOpen } = useCart();

    useEffect(() => {
        if (location.state?.openCart) {
            setIsCartOpen(true);
            // clear the state so it doesn't reopen every time
            window.history.replaceState({}, document.title);
        }
    }, [location.state, setIsCartOpen]);

    return (
        <div className="min-h-screen pt-24 px-4 text-white">
            <h1 className="text-4xl font-bold text-center mb-12">Shop</h1>
            <ShopGallery onAddToCart={() => setIsCartOpen(true)} />
        </div>
    );
}

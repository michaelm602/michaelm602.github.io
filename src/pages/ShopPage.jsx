import React, { useState } from "react";
import ShopGallery from "../components/ShopGallery";
import "react-toastify/dist/ReactToastify.css";

export default function ShopPage() {
    const [setIsCartOpen] = useState(false);

    return (
        <div className="min-h-screen pt-24 px-4 text-white">
            <h1 className="text-4xl font-bold text-center mb-12">Shop</h1>

            <ShopGallery onAddToCart={() => setIsCartOpen(true)} />

            {/* If needed, you can move <ToastContainer /> here temporarily for testing:
          import { ToastContainer } from "react-toastify";
          <ToastContainer position="top-right" autoClose={2000} />
      */}
        </div>

    );
}

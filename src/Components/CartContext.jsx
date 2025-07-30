// src/context/CartContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { sizePriceMap } from "../utils/sizePricing";

export const CartContext = createContext();

export function useCart() {
    return useContext(CartContext);
}

export default function CartProvider({ children }) {
    const [cart, setCart] = useState(() => {
        const stored = localStorage.getItem("cart");
        return stored ? JSON.parse(stored) : [];
    });

    function updateCartItem(index, updatedFields) {
        setCart((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item;

                let updatedItem = { ...item, ...updatedFields };

                if (updatedFields.size) {
                    updatedItem.price = sizePriceMap[updatedFields.size] || item.price;
                }

                return updatedItem;
            })
        );
    }

    const [isCartOpen, setIsCartOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem("cart", JSON.stringify(cart));
    }, [cart]);

    function addToCart(item) {
        setCart((prev) => {
            const existing = prev.find(
                (i) => i.title === item.title && i.size === item.size
            );
            if (existing) {
                return prev.map((i) =>
                    i.title === item.title && i.size === item.size
                        ? { ...i, quantity: i.quantity + item.quantity }
                        : i
                );
            }
            return [...prev, item];
        });
    }

    function removeFromCart(index) {
        setCart((prev) => prev.filter((_, i) => i !== index));
    }

    function clearCart() {
        setCart([]);
    }

    return (
        // And include them in the provider value
        <CartContext.Provider
            value={{
                cartItems: cart,
                setCart,
                addToCart,
                removeFromCart,
                clearCart,
                updateCartItem,
                isCartOpen,       // 🆕
                setIsCartOpen,   // 🆕
            }}
        >
            {children}
        </CartContext.Provider>
    );
}
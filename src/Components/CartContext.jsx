// src/context/CartContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

export const CartContext = createContext();

export function useCart() {
    return useContext(CartContext);
}

export default function CartProvider({ children }) {
    const [cart, setCart] = useState(() => {
        const stored = localStorage.getItem("cart");
        return stored ? JSON.parse(stored) : [];
    });

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
        <CartContext.Provider
            value={{
                cartItems: cart,
                addToCart,
                removeFromCart,
                clearCart,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}
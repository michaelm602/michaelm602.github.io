import { createContext, useContext, useEffect, useState } from "react";
import { getProductPrice, resolveCartItemProduct } from "../data/products";

export const CartContext = createContext();

export function useCart() {
    return useContext(CartContext);
}

function normalizeCartItem(item) {
    const product = resolveCartItemProduct(item);

    return {
        ...item,
        productId: item.productId || product?.id || null,
        title: item.title || product?.title || "Untitled",
        image: item.image ?? null,
    };
}

function getCartIdentity(item) {
    return `${item.productId || item.title}::${item.size}`;
}

function readStoredCart() {
    try {
        const stored = localStorage.getItem("cart");
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
            localStorage.removeItem("cart");
            return [];
        }

        return parsed
            .map(normalizeCartItem)
            .filter((item) => item.title && item.size && Number(item.quantity) > 0);
    } catch {
        localStorage.removeItem("cart");
        return [];
    }
}

export default function CartProvider({ children }) {
    const [cart, setCart] = useState(() => readStoredCart());

    function updateCartItem(index, updatedFields) {
        setCart((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item;

                const updatedItem = normalizeCartItem({ ...item, ...updatedFields });
                const product = resolveCartItemProduct(updatedItem);

                if (updatedFields.size) {
                    updatedItem.price = getProductPrice(product, updatedFields.size) ?? item.price;
                }

                return updatedItem;
            })
        );
    }

    const [isCartOpen, setIsCartOpen] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem("cart", JSON.stringify(cart));
        } catch {
            // Keep cart usable in-memory if storage is unavailable or corrupted.
        }
    }, [cart]);

    function addToCart(item) {
        const normalizedItem = normalizeCartItem(item);

        setCart((prev) => {
            const existing = prev.find(
                (cartItem) => getCartIdentity(cartItem) === getCartIdentity(normalizedItem)
            );

            if (existing) {
                return prev.map((cartItem) =>
                    getCartIdentity(cartItem) === getCartIdentity(normalizedItem)
                        ? { ...cartItem, quantity: cartItem.quantity + normalizedItem.quantity }
                        : cartItem
                );
            }

            return [...prev, normalizedItem];
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
                setCart,
                addToCart,
                removeFromCart,
                clearCart,
                updateCartItem,
                isCartOpen,
                setIsCartOpen,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

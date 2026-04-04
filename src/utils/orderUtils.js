import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const saveOrderToFirestore = async (cartItems, buyerInfo = {}, orderMeta = {}) => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        throw new Error("Cart items missing or invalid");
    }

    const orderRef = await addDoc(collection(db, "orders"), {
        cartItems,
        buyerInfo,
        status: "pending",
        ...orderMeta,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return orderRef.id;
};

export function buildOrderItems(cartItems = []) {
    if (!Array.isArray(cartItems)) return [];

    return cartItems.map((item) => ({
        productId: item.productId || null,
        title: item.title,
        size: item.size,
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.price) || 0,
        image: item.image ?? null,
    }));
}

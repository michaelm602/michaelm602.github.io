import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export const saveOrderToFirestore = async (cartItems, buyerInfo = {}) => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        throw new Error("🛑 Cart items missing or invalid");
    }

    const orderRef = await addDoc(collection(db, "orders"), {
        cartItems,
        buyerInfo,
        status: "pending",
        createdAt: new Date(),
    });

    return orderRef.id;
};

export const markOrderPaid = async (orderId, transactionId, buyerInfo) => {
    const orderDoc = doc(db, "orders", orderId);
    await updateDoc(orderDoc, {
        status: "paid",
        paypalTransactionId: transactionId,
        buyerInfo,
    });
};

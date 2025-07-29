// FirestoreTest.jsx
import { useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase"; // make sure this path is right

export default function FirestoreTest() {
    useEffect(() => {
        const testFirestore = async () => {
            try {
                const colRef = collection(db, "shopImages"); // name must match Firestore exactly
                const snapshot = await getDocs(colRef);
                snapshot.forEach((doc) => {
                    console.log("🔥 DOC:", doc.id, doc.data());
                });
            } catch (err) {
                console.error("❌ Firestore Error:", err.message);
            }
        };

        testFirestore();
    }, []);

    return <div className="text-white">Testing Firestore connection...</div>;
}

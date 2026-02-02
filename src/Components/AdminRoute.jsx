// src/Components/AdminRoute.jsx
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";

// ✅ Replace this with YOUR Firebase Auth UID
// Firebase Console → Authentication → Users → click your user → UID
const ADMIN_UID = "1AWLkfAMgjgDSNiK9bRsIWRoGW73";

export default function AdminRoute({ children }) {
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setIsAdmin(!!u && u.uid === ADMIN_UID);
            setChecking(false);
        });
        return () => unsub();
    }, []);

    if (checking) return null;

    return isAdmin ? children : <Navigate to="/login" replace />;
}

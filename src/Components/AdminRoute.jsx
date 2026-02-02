import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

export default function AdminRoute({ children }) {
    const [user, setUser] = useState(undefined); // undefined = still checking

    const ADMIN_UID = "1AWLkfAMgjgDSNiK9bRsIWRoGW73";
    const ADMIN_EMAIL = "airbrushnink@gmail.com";

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    // still loading auth state
    if (user === undefined) return <p className="text-center mt-10">Checking admin…</p>;

    // not logged in → send to login
    if (!user) return <Navigate to="/login" replace />;

    // logged in but not you → kick them to home (or /shop)
    const isAdmin =
        user.uid === ADMIN_UID ||
        user.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

    if (!isAdmin) return <Navigate to="/" replace />;

    return children;
}

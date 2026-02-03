import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { isAdminUser } from "../utils/admin";

export default function AdminRoute({ children }) {
    const [user, setUser] = useState(undefined);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    if (user === undefined) return <p className="text-center mt-10">Checking admin…</p>;
    if (!user) return <Navigate to="/login" replace />;
    if (!isAdminUser(user)) return <Navigate to="/" replace />;

    return children;
}

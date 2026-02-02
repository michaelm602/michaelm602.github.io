// src/Components/ProtectedRoute.jsx
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";

const ADMIN_EMAIL = "airbrushnink@gmail.com";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const email = (user?.email || "").toLowerCase().trim();
      setAllowed(email === ADMIN_EMAIL.toLowerCase());
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <p className="text-center mt-10 text-white">Checking auth…</p>;

  return allowed ? children : <Navigate to="/" replace />;
}

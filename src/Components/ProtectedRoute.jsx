import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { isAdminUser } from "../utils/admin";

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return unsub;
  }, []);

  if (user === undefined) return <p className="text-center mt-10 text-white">Checking auth…</p>;

  return isAdminUser(user) ? children : <Navigate to="/" replace />;
}

import { Navigate } from "react-router-dom";
import useAdminAuth from "../hooks/useAdminAuth";

export default function ProtectedRoute({ children }) {
  const { user, isAdmin, loading, error } = useAdminAuth();

  if (loading) return <p className="text-center mt-10 text-white">Checking auth...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (error) return <p className="text-center mt-10 text-red-300">{error}</p>;

  return isAdmin ? children : <Navigate to="/" replace />;
}

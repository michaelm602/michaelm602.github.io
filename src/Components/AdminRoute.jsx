import { Navigate } from "react-router-dom";
import useAdminAuth from "../hooks/useAdminAuth";
import AdminNav from "./AdminNav";

export default function AdminRoute({ children }) {
    const { user, isAdmin, loading, error } = useAdminAuth();

    if (loading) return <p className="text-center mt-10">Checking admin...</p>;
    if (!user) return <Navigate to="/login" replace />;
    if (error) return <p className="text-center mt-10 text-red-300">{error}</p>;
    if (!isAdmin) return <Navigate to="/" replace />;

    return (
        <>
            <AdminNav />
            {children}
        </>
    );
}

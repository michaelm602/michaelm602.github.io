import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from './pages/Home';
import Airbrush from "./pages/Airbrush";
import Photoshop from "./pages/Photoshop";
import Navbar from "./Components/Navbar";
import GalleryPage from './pages/GalleryPage';
import LoginForm from "./Components/LoginForm";
import Footer from "./Components/Footer";
import Contact from "./pages/Contact";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminRoute from "./Components/AdminRoute";
import AdminHomeEditor from "./pages/AdminHomeEditor";
import Success from "./pages/Success";
import Cancel from "./pages/Cancel";

// auth & protected route
import { auth } from "./firebase"
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import ShopPage from "./pages/ShopPage";
// Trigger DigitalOcean redeploy


function App() {
  const [setUser] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow" >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/portfolio/airbrush" element={<Airbrush />} />
            <Route path="/portfolio/photoshop" element={<Photoshop />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/contact" element={<Contact />} />

            {/* If Stripe returns to these, send them back to shop */}
            <Route path="/success" element={<Navigate to="/shop" replace />} />
            <Route path="/cancel" element={<Navigate to="/shop" replace />} />

            {/* Login */}
            <Route path="/login" element={<LoginForm />} />

            {/* Admin Home Editor */}
            <Route
              path="/admin/home"
              element={
                <AdminRoute>
                  <AdminHomeEditor />
                </AdminRoute>
              }
            />

            {/* OPTIONAL: give /admin a real route so redirects don’t break */}
            <Route path="/admin" element={<Navigate to="/admin/home" replace />} />

            {/* OPTIONAL: if you still want /upload to exist */}
            <Route path="/upload" element={<Navigate to="/admin/home" replace />} />

            {/* Catch-all (optional but recommended) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

        </main>
        <Footer />
      </div>
      <ToastContainer position="top-right" autoClose={2000} />

    </Router>
  );
}

export default App;

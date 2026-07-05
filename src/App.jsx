import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from './pages/Home';
import Portfolio from "./pages/Portfolio";
import Airbrush from "./pages/Airbrush";
import Photoshop from "./pages/Photoshop";
import Tattoos from "./pages/Tattoos";
import Navbar from "./Components/Navbar";
import GalleryPage from './pages/GalleryPage';
import LoginForm from "./Components/LoginForm";
import Footer from "./Components/Footer";
import Contact from "./pages/Contact";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Toaster } from "react-hot-toast";
import AdminRoute from "./Components/AdminRoute";
import AdminHomeEditor from "./pages/AdminHomeEditor";
import AdminDashboard from "./pages/AdminDashboard";
import UploadImage from "./Components/UploadImage";
import ScrollToTop from "./Components/ScrollToTop";

import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import Success from "./pages/Success";
import Cancel from "./pages/Cancel";

function App() {

  return (
    <Router>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow" >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/portfolio/airbrush" element={<Airbrush />} />
            <Route path="/portfolio/photoshop" element={<Photoshop />} />
            <Route path="/portfolio/tattoos" element={<Tattoos />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/shop/:slug" element={<ProductDetailPage />} />
            <Route path="/contact" element={<Contact />} />

            <Route path="/success" element={<Success />} />
            <Route path="/cancel" element={<Cancel />} />

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
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />

            <Route
              path="/admin/artwork"
              element={
                <AdminRoute>
                  <UploadImage />
                </AdminRoute>
              }
            />

            {/* OPTIONAL: if you still want /upload to exist */}
            <Route path="/upload" element={<Navigate to="/admin/artwork" replace />} />

            {/* Catch-all (optional but recommended) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

        </main>
        <Footer />
      </div>
      <ToastContainer position="top-right" autoClose={2000} theme="dark" />
      <Toaster position="top-right" toastOptions={{ duration: 2000 }} />

    </Router>
  );
}

export default App;

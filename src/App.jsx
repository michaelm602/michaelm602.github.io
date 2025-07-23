import { HashRouter as Router, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./Components/ProtectedRoute"
import Home from './pages/Home';
import Portfolio from "./pages/Portfolio";
import Airbrush from "./pages/Airbrush";
import Tattoos from "./pages/Tattoos";
import Photoshop from "./pages/Photoshop";
import Navbar from "./Components/Navbar";
import GalleryPage from './pages/GalleryPage';
import UploadImage from "./components/UploadImage";
import LoginForm from "./components/LogInForm";
import Footer from "./Components/Footer";
import Contact from "./pages/Contact";

// auth & protected route
import { auth } from "./firebase"
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";


function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      console.log("Current User:", auth.currentUser);
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
            <Route path="/portfolio/tattoos" element={<Tattoos />} />
            <Route path="/portfolio/photoshop" element={<Photoshop />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/upload" element={
              <ProtectedRoute>
                <UploadImage />
              </ProtectedRoute>
            } />
            <Route path="/login" element={<LoginForm />} />
          </Routes>
        </main>
        <Footer />
      </div>

    </Router>
  );
}

export default App;

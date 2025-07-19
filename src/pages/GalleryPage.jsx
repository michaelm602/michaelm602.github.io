// src/pages/GalleryPage.jsx
import Gallery from '../components/Gallery';

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4">
      <h1 className="text-4xl font-bold text-center mb-12">Gallery</h1>

      <section className="mb-20">
        <h2 className="text-2xl font-semibold text-center mb-6">Tattoos</h2>
        <Gallery folder="tattoos" label="Tattoo" />
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-center mb-6">Airbrush</h2>
        <Gallery folder="airbrush" label="Airbrush" />
      </section>
    </div>
  );
}

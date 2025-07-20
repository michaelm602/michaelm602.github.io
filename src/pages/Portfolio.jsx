import { Link } from "react-router-dom";
import airbrushingVideo from '../assets/videos/airbrushing.mp4'

export default function Portfolio() {
  return (
    <div className="py-12 px-8 text-center text-white min-h-screen bg-gradient-to-r from-black to-[#222]">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">Portfolio</h2>
      <p className="text-lg mb-8">Select a category to see the work:</p>

      <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 animate-fadeSlideUp">
        <Link to="/portfolio/airbrush" className="group block bg-[#1c1c1c] p-6 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <video
            className="h-48 w-full object-cover rounded-md mb-4"
            src={airbrushingVideo}
            autoPlay
            muted
            loop
            playsInline
          />
          <span className="block text-xl font-medium text-white group-hover:text-[#ccc]">Airbrush</span>
        </Link>

        <Link to="/portfolio/photoshop" className="group block bg-[#1c1c1c] p-6 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="h-48 w-full bg-black rounded-md mb-4 flex items-center justify-center text-gray-400 text-sm">
            Photoshop Preview (video goes here)
          </div>
          <span className="block text-xl font-medium text-white group-hover:text-[#ccc]">Photoshop</span>
        </Link>

        <Link to="/portfolio/tattoos" className="group block bg-[#1c1c1c] p-6 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="h-48 w-full bg-black rounded-md mb-4 flex items-center justify-center text-gray-400 text-sm">
            Tattoos Preview (video goes here)
          </div>
          <span className="block text-xl font-medium text-white group-hover:text-[#ccc]">Tattoos</span>
        </Link>
      </div>
    </div>
  );
}

// src/pages/Portfolio.jsx
import { Link } from "react-router-dom";

export default function Portfolio() {
  return (
    <div className="py-12 px-8 text-center text-white min-h-screen bg-gradient-to-r from-black to-[#222]">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">Portfolio</h2>
      <p className="text-lg mb-8">Select a category to see the work:</p>

      <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 animate-fadeSlideUp">
        <Link to="/portfolio/airbrush" className="group block bg-[#1c1c1c] p-6 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <img
            src="https://firebasestorage.googleapis.com/v0/b/airbrushnink-9f735.firebasestorage.app/o/airbrush%2FAlterEgo.jpg?alt=media&token=00eff53c-5a88-4497-8e44-b497902e6ec0"
            alt="Airbrush preview"
            className="h-48 w-full object-cover rounded-md mb-4"
          />
          <span className="block text-xl font-medium text-white group-hover:text-[#ccc]">Airbrush</span>
        </Link>

        <Link to="/portfolio/photoshop" className="group block bg-[#1c1c1c] p-6 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <img
            src="https://firebasestorage.googleapis.com/v0/b/airbrushnink-9f735.firebasestorage.app/o/photoshop%2Fps1%20(9).jpg?alt=media&token=c96c99c3-7047-4b9f-bc6c-50862fc39c63"
            alt="Photoshop preview"
            className="w-full max-w-full h-48 object-cover object-center rounded-md mb-4"
          />
          <span className="block text-xl font-medium text-white group-hover:text-[#ccc]">Photoshop</span>
        </Link>

        <Link to="/portfolio/tattoos" className="group block bg-[#1c1c1c] p-6 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <img
            src="https://firebasestorage.googleapis.com/v0/b/airbrushnink-9f735.firebasestorage.app/o/tattoos%2Ftattoo12.jpg?alt=media&token=37c320ff-bc15-402a-a8ba-1b881fefe880"
            alt="Tattoos preview"
            className="h-48 w-full object-cover rounded-md mb-4"
          />
          <span className="block text-xl font-medium text-white group-hover:text-[#ccc]">Tattoos</span>
        </Link>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";

export default function Portfolio() {
  return (
    <div className="py-12 px-8 text-center text-white min-h-screen bg-gradient-to-r from-black to-[#222]">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">Portfolio</h2>
      <p className="text-lg mb-8">Select a category to see the work:</p>

      <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 animate-fadeSlideUp">

        {/* Airbrush */}
        <Link to="/portfolio/airbrush" className="group block bg-[#1c1c1c] p-6 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <video
            className="h-48 w-full object-cover rounded-md mb-4"
            src="https://firebasestorage.googleapis.com/v0/b/airbrushnink-9f735.firebasestorage.app/o/portfolio-videos%2Fairbrushing.mp4?alt=media&token=394baf69-0bbe-4111-9027-60c602a7f869"
            muted
            loop
            playsInline
            onMouseOver={(e) => e.currentTarget.play()}
            onMouseOut={(e) => e.currentTarget.pause()}
          />
          <span className="block text-xl font-medium text-white group-hover:text-[#ccc]">Airbrush</span>
        </Link>

        {/* Photoshop */}
        <Link to="/portfolio/photoshop" className="group block bg-[#1c1c1c] p-6 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <video
            className="h-48 w-full object-cover rounded-md mb-4"
            src="https://firebasestorage.googleapis.com/v0/b/airbrushnink-9f735.firebasestorage.app/o/portfolio-videos%2Fphotoshop.mp4?alt=media&token=3b3e2fdb-cb37-470e-9603-a477ee9a7b94"
            muted
            loop
            playsInline
            onMouseOver={(e) => e.currentTarget.play()}
            onMouseOut={(e) => e.currentTarget.pause()}
          />
          <span className="block text-xl font-medium text-white group-hover:text-[#ccc]">Photoshop</span>
        </Link>

        {/* Tattoos */}
        <Link to="/portfolio/tattoos" className="group block bg-[#1c1c1c] p-6 rounded-xl shadow-md hover:bg-[#333] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <video
            className="h-48 w-full object-cover rounded-md mb-4"
            src="https://firebasestorage.googleapis.com/v0/b/airbrushnink-9f735.firebasestorage.app/o/portfolio-videos%2Ftattoos.mp4?alt=media&token=428e6d43-941d-4245-9171-e182ad6c2b8a"
            muted
            loop
            playsInline
            onMouseOver={(e) => e.currentTarget.play()}
            onMouseOut={(e) => e.currentTarget.pause()}
          />
          <span className="block text-xl font-medium text-white group-hover:text-[#ccc]">Tattoos</span>
        </Link>
      </div>
    </div>
  );
}

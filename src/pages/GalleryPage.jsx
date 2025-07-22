import HeroParallaxVideo from '../Components/HeroParallaxVideo';

export default function GalleryPage() {
  return (
    <>
      <HeroParallaxVideo
        videoSrc="https://firebasestorage.googleapis.com/v0/b/airbrushnink-9f735.firebasestorage.app/o/portfolio-videos%2Fairbrushing.mp4?alt=media&token=394baf69-0bbe-4111-9027-60c602a7f869"
        title="AIRBRUSH & INK"
      />


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
    </>
  );
}

import React, { useEffect, useState, useRef } from "react";
import Hero from "../Components/Hero";
import Intro from "../Components/Intro";
import SectionLabel from "../Components/SectionLabel";
import ServiceCard from "../components/ServiceCard";
import airbrushingImg from "../assets/services/airbrushing.jpg";
import psLogoImg from "../assets/services/ps-logo.jpg";
import img1 from "../assets/images/hero-images/iwata.jpg";
import img2 from "../assets/images/hero-images/photoshop.jpg";

export default function Home() {
  const heroImages = [img1, img2];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const airbrushRef = useRef(null);
  const inkRef = useRef(null);
  const [showAirbrush, setShowAirbrush] = useState(false);
  const [showInk, setShowInk] = useState(false);

  // Hero image rotator
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Airbrush observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowAirbrush(entry.isIntersecting),
      { threshold: 0.2 }
    );
    const ref = airbrushRef.current;
    if (ref) observer.observe(ref);
    return () => ref && observer.unobserve(ref);
  }, []);

  // Ink observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowInk(entry.isIntersecting),
      { threshold: 0.05 }
    );
    const ref = inkRef.current;
    if (ref) observer.observe(ref);
    return () => ref && observer.unobserve(ref);
  }, []);

  // Scroll to services

  useEffect(() => {
    const shouldScroll = sessionStorage.getItem("scrollToServices");

    if (shouldScroll) {
      sessionStorage.removeItem("scrollToServices");

      const scrollToServices = () => {
        const section = document.getElementById("services");
        if (section) {
          const yOffset = -100; // adjust for navbar
          const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      };

      // Wait for DOM to settle
      setTimeout(scrollToServices, 500);
    }
  }, []);

  return (
    <div className="relative z-0">
      {/* HERO SECTION */}
      <Hero currentImage={heroImages[currentImageIndex]} />

      {/* AIRBRUSH LABEL BEHIND INTRO */}
      <section
        className="relative min-h-[30vh]" // 👈 removed overflow-hidden
        ref={airbrushRef}
      >
        <SectionLabel text="AIRBRUSH" show={showAirbrush} />
        <Intro />
      </section>

      {/* SERVICE CARDS */}
      <section id="services" className="relative z-10 mt-[2vh] px-8 pt-5 pb-12">
        <div className="flex flex-wrap justify-center gap-x-20 gap-y-12">
          <ServiceCard
            tag="AIRBRUSH"
            title="Custom Airbrush"
            description="Every airbrush project is a story told in paint. Whether it’s a wild concept or something close to home, I create custom visuals that speak louder than words."
            image={airbrushingImg}
            link="/portfolio/airbrush"
          />
          <ServiceCard
            tag="DIGITAL"
            title="Photoshop/Digital Art"
            description="This is where creativity gets surgical. I use Photoshop to craft visuals that feel real — layered, emotional, and built to connect. Every pixel tells a story."
            image={psLogoImg}
            link="/portfolio/photoshop"
          />
        </div>
      </section>

      {/* & INK LABEL BEHIND CTA */}
      <section
        className="relative min-h-[8vh] sm:min-h-[14vh] md:min-h-[22vh] lg:min-h-[18vh]
  flex flex-col justify-center items-center
  pt-[2vh] sm:pt-[3vh] md:pt-[2vh] lg:pt-[1vh]
  pb-[2vh] sm:pb-[3vh] md:pb-[2vh] lg:pb-[1vh]"
        ref={inkRef}
      >
        {/* 👇 This wrapper clips horizontal overflow but allows vertical overflow */}
        <div className="w-full overflow-x-hidden">
          <SectionLabel text="& INK" show={showInk} />
        </div>

      </section>


    </div>
  );
}
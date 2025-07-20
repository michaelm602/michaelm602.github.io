import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import Hero from "../Components/Hero";
import Intro from "../Components/Intro";
import SectionLabel from "../Components/SectionLabel";
import ServiceCard from "../components/ServiceCard";
import CTA from "../Components/CTA";
import airbrushingImg from "../assets/services/airbrushing.jpg";
import psLogoImg from "../assets/services/ps-logo.jpg";
import tattooingImg from "../assets/services/tattooing.jpg";
import img1 from "../assets/images/hero-images/iwata.jpg";
import img2 from "../assets/images/hero-images/photoshop.jpg";
import img3 from "../assets/images/hero-images/tattoomachine.jpg";

export default function Home() {
  const heroImages = [img1, img2, img3];
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

  return (
    <div className="relative z-0">
      {/* HERO SECTION */}
      <Hero currentImage={heroImages[currentImageIndex]} />

      {/* AIRBRUSH LABEL BEHIND INTRO */}
      <section
        className="relative min-h-[40vh] pt-10" // 👈 removed overflow-hidden
        ref={airbrushRef}
      >
        <SectionLabel text="AIRBRUSH" show={showAirbrush} />
        <Intro />
      </section>

      {/* SERVICE CARDS */}
      <section className="relative z-10 mt-[2vh] px-8 pt-0 pb-16">
        <div className="flex flex-wrap justify-center gap-8">
          <ServiceCard
            tag="AIRBRUSH"
            title="Custom Airbrush"
            description="Whether you have a specific concept in mind..."
            image={airbrushingImg}
            link="/portfolio/airbrush"
          />
          <ServiceCard
            tag="DIGITAL"
            title="Photoshop/Digital Art"
            description="Every tattoo and individual is unique..."
            image={psLogoImg}
            link="/portfolio/photoshop"
          />
          <ServiceCard
            tag="TATTOO"
            title="Custom Tattoo Design"
            description="Whether you envision a full sleeve or half sleeve..."
            image={tattooingImg}
            link="/portfolio/tattoos"
          />
        </div>
      </section>

      {/* & INK LABEL BEHIND CTA */}
<section
  className="relative min-h-[35vh] sm:min-h-[30vh] md:min-h-[25vh] lg:min-h-[20vh] flex flex-col justify-center items-center pt-[6vh] pb-[4vh] overflow-visible"
  ref={inkRef}
>
  {/* 👇 This wrapper clips horizontal overflow but allows vertical overflow */}
  <div className="w-full overflow-x-hidden">
    <SectionLabel text="& INK" show={showInk} />
  </div>

  <div className="relative z-10 flex justify-center items-center h-full">
    <CTA />
  </div>
</section>


    </div>
  );
}
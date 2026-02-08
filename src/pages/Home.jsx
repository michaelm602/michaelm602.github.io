import React, { useEffect, useState, useRef } from "react";
import Hero from "../Components/Hero";
import Intro from "../Components/Intro";
import SectionLabel from "../Components/SectionLabel";
import ServiceCard from "../Components/ServiceCard";
import CTA from "../Components/CTA";

import { homeContent } from "../content/homeContent";

export default function Home() {
  const heroImages = homeContent.heroImages;

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
  }, [heroImages.length]);

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
          const yOffset = -100;
          const y =
            section.getBoundingClientRect().top +
            window.pageYOffset +
            yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      };

      setTimeout(scrollToServices, 500);
    }
  }, []);

  return (
    <div className="relative z-0">
      {/* HERO SECTION */}
      <Hero currentImage={heroImages[currentImageIndex]} />

      {/* AIRBRUSH LABEL BEHIND INTRO */}
      <section className="relative min-h-[30vh]" ref={airbrushRef}>
        <SectionLabel text="AIRBRUSH" show={showAirbrush} />
        <Intro />
      </section>

      {/* SERVICE CARDS */}
      <section id="services" className="relative z-10 mt-[2vh] px-8 pt-5">
        <div className="flex flex-wrap justify-center gap-x-20 gap-y-12">
          {homeContent.services.map((s) => (
            <ServiceCard
              key={`${s.tag}-${s.title}`}
              tag={s.tag}
              title={s.title}
              description={s.description}
              image={s.image}
              link={s.link}
            />
          ))}
        </div>
      </section>

      {/* & INK LABEL BEHIND CTA */}
      <section
        ref={inkRef}
        className="relative flex flex-col items-center justify-center min-h-[20vh] overflow-hidden"
      >
        <div className="absolute top-1/2 -translate-y-1/2 z-0 w-full text-center">
          <SectionLabel text="& INK" show={showInk} />
        </div>

        <div className="relative z-10 mt-4">
          <CTA />
        </div>
      </section>
    </div>
  );
}

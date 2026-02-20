import React, { useEffect, useState, useRef } from "react";
import Hero from "../Components/Hero";
import Intro from "../Components/Intro";
import SectionLabel from "../Components/SectionLabel";
import ServiceCard from "../Components/ServiceCard";
import CTA from "../Components/CTA";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { homeContent as FALLBACK } from "../content/homeContent";

export default function Home() {
  // 🔥 Firestore-backed content with safe fallback
  const [content, setContent] = useState(FALLBACK);

  const heroImages = content.heroImages || [];

  const airbrushRef = useRef(null);
  const inkRef = useRef(null);
  const [showAirbrush, setShowAirbrush] = useState(false);
  const [showInk, setShowInk] = useState(false);

  // 🔥 Load Home content from Firestore (fallback silently)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "siteContent", "home"));
        if (!alive) return;

        if (snap.exists()) {
          const data = snap.data();
          setContent({
            heroImages:
              Array.isArray(data.heroImages) && data.heroImages.length
                ? data.heroImages
                : FALLBACK.heroImages,
            services:
              Array.isArray(data.services) && data.services.length
                ? data.services
                : FALLBACK.services,
          });

        }
      } catch {
        // fail silently → fallback content stays
      }
    })();

    return () => {
      alive = false;
    };
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
          const yOffset = -100;
          const y =
            section.getBoundingClientRect().top +
            window.scrollY +
            yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      };

      requestAnimationFrame(() => requestAnimationFrame(scrollToServices));
    }
  }, []);

  return (
    <div className="relative z-0">
      {/* HERO SECTION */}
      {heroImages.length > 0 && (
        <Hero images={heroImages} intervalMs={5000} />
      )}

      {/* AIRBRUSH LABEL BEHIND INTRO */}
      <section className="relative min-h-[30vh]" ref={airbrushRef}>
        <SectionLabel text="AIRBRUSH" show={showAirbrush} />
        <Intro />
      </section>

      {/* SERVICE CARDS */}
      <section id="services" className="relative z-10 mt-[2vh] px-8 pt-5">
        <div className="flex flex-wrap justify-center gap-x-20 gap-y-12">
          {content.services.map((s, i) => (
            <ServiceCard
              key={`${s.title}-${i}`}
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

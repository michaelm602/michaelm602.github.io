import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
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

  // Ink observer — one-shot: show once when section enters view, stay visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowInk(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    const ref = inkRef.current;
    if (ref) observer.observe(ref);
    return () => observer.disconnect();
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

      {/* TRUST / DIFFERENTIATION STRIP */}
      <section className="bg-zinc-900 border-y border-zinc-800 py-8 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-white">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-zinc-300 mb-1">Made to Order</p>
            <p className="text-xs text-zinc-500">Nothing sits in a warehouse. Every piece is made when you buy it.</p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-zinc-300 mb-1">Hand-Finished</p>
            <p className="text-xs text-zinc-500">Every print is touched before it ships. No assembly line, no shortcuts.</p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-zinc-300 mb-1">One Artist</p>
            <p className="text-xs text-zinc-500">You're buying directly from the person who made it. That's the whole point.</p>
          </div>
        </div>
      </section>

      {/* AIRBRUSH LABEL BEHIND INTRO */}
      <section className="relative min-h-[30vh]" ref={airbrushRef}>
        <SectionLabel text="AIRBRUSH" show={showAirbrush} />
        <Intro />
      </section>

      {/* FEATURED PIECES */}
      <section id="services" className="relative z-10 mt-[2vh] px-8 pt-5">
        <h2 className="text-center text-xs uppercase tracking-widest text-zinc-500 mb-8">
          Featured Pieces
        </h2>
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

      {/* CUSTOM ARTWORK + FINAL CTA — single section with & INK background */}
      <section
        ref={inkRef}
        className="relative flex flex-col items-center justify-center min-h-[60vh] overflow-hidden py-20 px-6 gap-16"
      >
        <SectionLabel text="& INK" show={showInk} />

        <div className="relative z-10 text-center text-white max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Want Something Made for You?</h2>
          <p className="text-zinc-400 text-base sm:text-lg mb-6 leading-relaxed">
            Bring your concept — a vision, a memory, a feeling you can't describe. I'll build it from scratch, made specifically for you.
          </p>
          <Link
            to="/contact"
            className="inline-block px-7 py-3 rounded bg-white text-black font-semibold hover:bg-zinc-200 transition text-sm uppercase tracking-wide"
          >
            Request Custom Piece
          </Link>
        </div>

        <div className="relative z-10 text-center">
          <p className="text-zinc-500 text-xs uppercase tracking-widest mb-4">Ready to own something real?</p>
          <CTA />
        </div>
      </section>
    </div>
  );
}

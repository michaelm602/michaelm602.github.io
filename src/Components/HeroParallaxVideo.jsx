import React from "react";

export default function HeroParallaxVideo({ videoSrc, title }) {
    return (
        <div className="relative w-full h-screen overflow-hidden">
            <video
                autoPlay
                muted
                loop
                playsInline
                className="absolute top-0 left-0 w-full h-full object-cover z-0"
                src={videoSrc}
            />

            <div className="relative z-10 flex items-center justify-center h-full w-full bg-black/40 text-center px-4">
                <h1 className="text-white text-4xl md:text-6xl font-fatwandals drop-shadow-lg">
                    {title}
                </h1>
            </div>
        </div>
    );
}

// src/content/homeContent.js

// IMPORTANT:
// - Do NOT import images from /src for production content.
// - Admin uploads + Firestore URLs should be the source of truth.
// - Keep fallbacks as EMPTY or simple text-only placeholders.

export const homeContent = {
    heroImages: [],

    services: [
        {
            tag: "AIRBRUSH",
            title: "Custom Airbrush",
            description:
                "Every airbrush project is a story told in paint. Whether it’s a wild concept or something close to home, I create custom visuals that speak louder than words.",
            image: "", // will be replaced by Firestore URL
            link: "/portfolio/airbrush",
        },
        {
            tag: "DIGITAL",
            title: "Photoshop/Digital Art",
            description:
                "This is where creativity gets surgical. I use Photoshop to craft visuals that feel real — layered, emotional, and built to connect. Every pixel tells a story.\n\nHave a special request or an image you’d like transformed? Reach out through my contact page and let’s bring your vision to life.",
            image: "", // will be replaced by Firestore URL
            link: "/portfolio/photoshop",
        },
    ],
};

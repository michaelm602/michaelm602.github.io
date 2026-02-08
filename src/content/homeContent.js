// src/content/homeContent.js
import airbrushingImg from "../assets/services/airbrushing.jpg";
import psLogoImg from "../assets/services/ps-logo.jpg";

import img1 from "../assets/images-webp/hero-images/iwata.webp";
import img2 from "../assets/images-webp/hero-images/photoshop.webp";

export const homeContent = {
    heroImages: [img1, img2],

    services: [
        {
            tag: "AIRBRUSH",
            title: "Custom Airbrush",
            description:
                "Every airbrush project is a story told in paint. Whether it’s a wild concept or something close to home, I create custom visuals that speak louder than words.",
            image: airbrushingImg,
            link: "/portfolio/airbrush",
        },
        {
            tag: "DIGITAL",
            title: "Photoshop/Digital Art",
            description:
                "This is where creativity gets surgical. I use Photoshop to craft visuals that feel real — layered, emotional, and built to connect. Every pixel tells a story.\n\nHave a special request or an image you’d like transformed? Reach out through my contact page and let’s bring your vision to life.",
            image: psLogoImg,
            link: "/portfolio/photoshop",
        },
    ],
};

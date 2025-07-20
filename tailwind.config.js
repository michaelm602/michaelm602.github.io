/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        fadeUp: "fadeUp 1s ease-out forwards",
        fadeSlideUp: "fadeSlideUp 0.8s ease-out forwards",
        slideInLeft: "slideInLeft 0.4s ease-out forwards", 
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeSlideUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: { // 👈 NEW
      "0%": { opacity: "0", transform: "translateX(-50px)" },
      "100%": { opacity: "1", transform: "translateX(0)" },
    },
      },
    },
  },
  plugins: [],
}

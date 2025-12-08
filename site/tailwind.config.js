/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      screens: {
        retina: {
          raw: "(min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)",
        },
      },
    },
  },
  plugins: [],
};

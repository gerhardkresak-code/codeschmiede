/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "media",
  theme: { extend: { fontFamily: { body: ["Barlow", "system-ui", "sans-serif"], display: ["Barlow Semi Condensed", "Barlow", "system-ui", "sans-serif"] } } },
  plugins: [],
};

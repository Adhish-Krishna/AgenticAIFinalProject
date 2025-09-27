module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          300: "#8ab4f8",
          400: "#669df6", 
          500: "#4285f4",
          600: "#1a73e8",
          700: "#1557b0",
        },
        gemini: {
          bg: "#131314",
          surface: "#1f1f1f",
          border: "#2d2d30",
          text: "#e8eaed",
          textSoft: "#9aa0a6",
          accent: "#8ab4f8",
        },
      },
      fontFamily: {
        'display': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

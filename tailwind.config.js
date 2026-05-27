/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        azisto: {
          primary: "#1E3A8A",
          primaryHover: "#273F7A",
          accent: "#2563EB",
          gold: "#C8A96B",
          background: "#FAFAF8",
          card: "#FFFFFF",
          border: "#E5E7EB",
          text: "#111111",
          muted: "#6B7280",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
        },
      },
    },
  },
  plugins: [],
};

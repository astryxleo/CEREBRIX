/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cerebrix: {
          black: "#000000",
          panel: "#11131B",
          blue: "#0066FF",
          cyan: "#00CFFF",
          ice: "#F5FAFF",
          silver: "#DCE6F2",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neon: "0 0 20px rgba(0,102,255,0.4)",
        cyan: "0 0 22px rgba(0,207,255,0.22)",
        glass: "0 18px 60px rgba(0,0,0,0.42), inset 0 1px 0 rgba(245,250,255,0.04)",
      },
      keyframes: {
        "neon-pulse": { "0%,100%": { boxShadow: "0 0 12px rgba(0,102,255,.18)" }, "50%": { boxShadow: "0 0 26px rgba(0,102,255,.45)" } },
        "rise-in": { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: { "neon-pulse": "neon-pulse 2.8s ease-in-out infinite", "rise-in": "rise-in .45s ease-out both" },
    },
  },
  plugins: [],
};

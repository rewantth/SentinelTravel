/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        void: "#020408",
        chrome: "#1A2332",
        line: "#243044",
        cyan: "#00F5FF",
        amber: "#FFB800",
        orange: "#FF6B00",
        crimson: "#FF0040",
        tacticalLight: "#EDF2F5",
        tacticalInk: "#07111F",
      },
      fontFamily: {
        display: ["Orbitron", "Share Tech Mono", "monospace"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        cyan: "0 0 22px rgba(0,245,255,.35)",
        crimson: "0 0 26px rgba(255,0,64,.48)",
        amber: "0 0 22px rgba(255,184,0,.35)",
        panel: "inset 0 0 0 1px rgba(36,48,68,.9), 0 18px 60px rgba(0,0,0,.45)",
      },
      dropShadow: {
        cyan: "0 0 14px rgba(0,245,255,.75)",
        crimson: "0 0 16px rgba(255,0,64,.75)",
        amber: "0 0 14px rgba(255,184,0,.75)",
      },
      keyframes: {
        dash: {
          "0%": { strokeDashoffset: "36" },
          "100%": { strokeDashoffset: "0" },
        },
        radar: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        breathe: {
          "0%, 100%": { opacity: ".32" },
          "50%": { opacity: ".58" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "12%": { opacity: ".54" },
          "18%": { opacity: "1" },
          "42%": { opacity: ".72" },
          "48%": { opacity: "1" },
        },
        criticalPulse: {
          "0%": { transform: "scale(1)", opacity: ".72" },
          "70%": { transform: "scale(1.75)", opacity: "0" },
          "100%": { transform: "scale(1.75)", opacity: "0" },
        },
        rise: {
          "0%": { transform: "translateY(18px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        cursorBlink: {
          "0%, 45%": { opacity: "1" },
          "46%, 100%": { opacity: "0" },
        },
      },
      animation: {
        dash: "dash 1.4s linear infinite",
        radar: "radar 9s linear infinite",
        breathe: "breathe 4.8s ease-in-out infinite",
        flicker: "flicker 2.2s linear infinite",
        criticalPulse: "criticalPulse 1.6s ease-out infinite",
        rise: "rise .45s ease-out both",
        scan: "scan 4.5s linear infinite",
        cursorBlink: "cursorBlink 1s step-end infinite",
      },
    },
  },
  plugins: [],
};


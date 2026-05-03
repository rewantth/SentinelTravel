/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        void: "var(--bg-void)",
        panel: "var(--bg-panel)",
        card: "var(--bg-card)",
        borderDefault: "var(--border-default)",
        cyan: "var(--cyan)",
        amber: "var(--amber)",
        orange: "var(--orange)",
        crimson: "var(--crimson)",
        textPrimary: "var(--text-primary)",
        textMuted: "var(--text-muted)",
      },
      fontFamily: {
        orbitron: ["Orbitron", "Share Tech Mono", "monospace"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        cyan: "0 0 22px rgba(0, 245, 255, 0.34)",
        crimson: "0 0 28px rgba(255, 0, 64, 0.46)",
        panel: "inset 0 0 0 1px rgba(36, 48, 68, 0.88), 0 18px 60px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  plugins: [],
};

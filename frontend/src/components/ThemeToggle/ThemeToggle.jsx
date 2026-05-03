import React from "react";
export default function ThemeToggle({ theme = "dark", onToggle }) {
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="h-10 border border-cyan/50 bg-cyan/10 px-4 font-mono text-xs uppercase text-cyan shadow-cyan transition hover:bg-cyan hover:text-black"
      title="Toggle tactical theme"
    >
      {isLight ? "LIGHT OPS" : "DARK OPS"}
    </button>
  );
}

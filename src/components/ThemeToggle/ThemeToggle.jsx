import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ theme, onToggle }) {
  const light = theme === "light";
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Toggle tactical theme"
      className="grid h-10 w-10 place-items-center border border-cyan/40 bg-chrome/75 text-cyan shadow-cyan transition hover:bg-cyan hover:text-black"
    >
      {light ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}


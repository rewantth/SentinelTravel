const severityStyles = {
  critical: "bg-crimson text-white shadow-crimson border-crimson",
  high: "bg-orange text-black shadow-[0_0_18px_rgba(255,107,0,.45)] border-orange",
  medium: "bg-amber text-black shadow-amber border-amber",
  low: "bg-cyan text-black shadow-cyan border-cyan",
};

export default function SeverityStamp({ severity = "low", className = "" }) {
  const normalized = severity.toLowerCase();
  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 font-display text-[10px] font-black uppercase ${severityStyles[normalized] || severityStyles.low} ${className}`}
    >
      [{normalized}]
    </span>
  );
}

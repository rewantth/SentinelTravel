import React from "react";
function tooltipText(breakdown = {}) {
  const entries = Object.entries(breakdown);
  if (!entries.length) {
    return "No confidence breakdown supplied";
  }
  return entries.map(([key, value]) => `${key}: ${Number(value).toFixed(2)}`).join("\n");
}

export default function ConfidenceSignal({ confidence = 0, breakdown = {} }) {
  const normalized = Math.max(0, Math.min(1, Number(confidence) || 0));
  const activeBars = Math.ceil(normalized * 5);

  return (
    <div className="flex items-end gap-2" title={tooltipText(breakdown)}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <span
          key={bar}
          className={`w-4 border border-cyan/40 transition ${bar <= activeBars ? "bg-cyan shadow-cyan" : "bg-borderDefault"}`}
          style={{ height: 12 + bar * 8 }}
        />
      ))}
      <span className="ml-2 font-mono text-sm text-cyan">{Math.round(normalized * 100)}%</span>
    </div>
  );
}

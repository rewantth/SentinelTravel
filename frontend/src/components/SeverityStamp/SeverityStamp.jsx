import React from "react";
const severityStyles = {
  critical: "border-crimson bg-crimson text-white shadow-crimson",
  high: "border-orange bg-orange text-black",
  medium: "border-amber bg-amber text-black",
  low: "border-cyan bg-cyan text-black",
};

export default function SeverityStamp({ severity = "low", className = "" }) {
  const normalized = String(severity || "low").toLowerCase();

  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 font-orbitron text-[10px] font-black uppercase ${severityStyles[normalized] || severityStyles.low} ${className}`}
    >
      [{normalized}]
    </span>
  );
}

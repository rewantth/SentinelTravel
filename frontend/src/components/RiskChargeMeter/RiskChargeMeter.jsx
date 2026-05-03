import React from "react";
const severityColor = {
  critical: "#FF0040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "#00F5FF",
};

export default function RiskChargeMeter({ score = 0, severity = "low", size = 58 }) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.max(0, Math.min(100, Number(score) || 0));
  const dashOffset = circumference - (normalizedScore / 100) * circumference;
  const color = severityColor[String(severity).toLowerCase()] || severityColor.low;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#243044" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            filter: `drop-shadow(0 0 8px ${color})`,
            transition: "stroke-dashoffset 700ms ease",
          }}
        />
      </svg>
      <span className="absolute font-orbitron text-sm font-black" style={{ color }}>
        {Math.round(normalizedScore)}
      </span>
    </div>
  );
}

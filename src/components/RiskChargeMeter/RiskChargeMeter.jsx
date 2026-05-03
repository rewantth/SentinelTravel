const colors = {
  critical: "#FF0040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "#00F5FF",
};

export default function RiskChargeMeter({ score = 0, severity = "low", size = 154 }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;
  const color = colors[severity] || colors.low;

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(36,48,68,.95)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
          style={{ filter: `drop-shadow(0 0 12px ${color})` }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-4xl font-black text-white">{Math.round(score)}</div>
        <div className="font-mono text-[10px] uppercase text-cyan">risk charge</div>
      </div>
    </div>
  );
}

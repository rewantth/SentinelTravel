import { useEffect, useMemo, useState } from "react";

const panelColor = {
  total: "border-l-cyan text-cyan",
  critical: "border-l-crimson text-crimson",
  high: "border-l-orange text-orange",
  confidence: "border-l-amber text-amber",
};

function CountUp({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value || 0);
    const started = performance.now();
    const duration = 820;
    let frame;
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      setDisplay(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const formatted = Number.isInteger(value) ? Math.round(display) : display.toFixed(2);
  return (
    <span>
      {formatted}
      {suffix}
    </span>
  );
}

function Sparkline({ values = [], color = "#00F5FF" }) {
  const points = useMemo(() => {
    const data = values.length ? values : [1, 3, 2, 5, 4, 6];
    const max = Math.max(...data, 1);
    return data
      .map((value, index) => {
        const x = (index / Math.max(1, data.length - 1)) * 100;
        const y = 32 - (value / max) * 28;
        return `${x},${y}`;
      })
      .join(" ");
  }, [values]);

  return (
    <svg viewBox="0 0 100 36" className="h-9 w-full overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2.4" points={points} className="drop-shadow-cyan" />
    </svg>
  );
}

function InterceptPanel({ label, value, suffix, tone, values }) {
  const color = tone === "critical" ? "#FF0040" : tone === "high" ? "#FF6B00" : tone === "confidence" ? "#FFB800" : "#00F5FF";
  return (
    <section
      className={`relative min-h-[118px] border border-line bg-chrome/75 p-4 shadow-panel backdrop-blur-md [clip-path:polygon(18px_0,100%_0,100%_100%,0_100%,0_18px)] ${panelColor[tone] || panelColor.total}`}
    >
      <div className="absolute left-0 top-0 h-full border-l-4" />
      <div className="font-display text-[11px] uppercase text-slate-300">{label}</div>
      <div className="mt-2 font-display text-4xl font-black text-white">
        <CountUp value={value} suffix={suffix} />
      </div>
      <div className="mt-3 opacity-80">
        <Sparkline values={values} color={color} />
      </div>
    </section>
  );
}

export default function SignalIntercepts({ summary }) {
  const trendValues = summary?.risk_trend?.map((item) => item.avg_risk) || [];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <InterceptPanel label="SIGINT total alerts" value={summary?.total_alerts || 0} tone="total" values={trendValues} />
      <InterceptPanel label="Critical breach vectors" value={summary?.critical_alerts || 0} tone="critical" values={trendValues.slice(-6)} />
      <InterceptPanel label="High-risk identities" value={summary?.high_alerts || 0} tone="high" values={trendValues.slice(-5)} />
      <InterceptPanel label="Average confidence" value={summary?.average_confidence || 0} suffix="" tone="confidence" values={trendValues} />
    </div>
  );
}


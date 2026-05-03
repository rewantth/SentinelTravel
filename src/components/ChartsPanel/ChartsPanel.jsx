import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const severityColors = {
  critical: "#FF0040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "#00F5FF",
};

function TerminalTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="border border-cyan/50 bg-void px-3 py-2 font-mono text-xs text-cyan shadow-cyan">
      <div>{">"} SIGNAL: {label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="text-white">
          {">"} {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  );
}

export default function ChartsPanel({ summary }) {
  const severityData = Object.entries(summary?.severity_counts || {}).map(([name, value]) => ({ name, value }));
  const countries = summary?.country_counts?.slice(0, 7) || [];
  const trend = summary?.risk_trend || [];

  return (
    <section className="grid gap-3 xl:grid-cols-3">
      <div className="min-h-[280px] border border-line bg-void/70 p-4 shadow-panel">
        <h2 className="font-display text-sm font-black uppercase text-white">Severity Spectrum</h2>
        <div className="mt-5 h-[210px]">
          <ResponsiveContainer>
            <BarChart data={severityData}>
              <CartesianGrid stroke="rgba(36,48,68,.55)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TerminalTooltip />} cursor={{ fill: "rgba(0,245,255,.08)" }} />
              <Bar dataKey="value" radius={[0, 0, 0, 0]} isAnimationActive animationDuration={900}>
                {severityData.map((entry) => (
                  <Cell key={entry.name} fill={severityColors[entry.name] || "#00F5FF"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="min-h-[280px] border border-line bg-void/70 p-4 shadow-panel">
        <h2 className="font-display text-sm font-black uppercase text-white">Risk Draw Over Time</h2>
        <div className="mt-5 h-[210px]">
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid stroke="rgba(36,48,68,.55)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TerminalTooltip />} />
              <Line
                type="monotone"
                dataKey="avg_risk"
                stroke="#00F5FF"
                strokeWidth={3}
                dot={{ r: 4, fill: "#020408", stroke: "#00F5FF", strokeWidth: 2 }}
                isAnimationActive
                animationDuration={950}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="min-h-[280px] border border-line bg-void/70 p-4 shadow-panel">
        <h2 className="font-display text-sm font-black uppercase text-white">Country Hit Count</h2>
        <div className="mt-5 h-[210px]">
          <ResponsiveContainer>
            <BarChart data={countries} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="rgba(36,48,68,.55)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="country"
                width={92}
                tick={{ fill: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<TerminalTooltip />} cursor={{ fill: "rgba(255,184,0,.08)" }} />
              <Bar dataKey="count" fill="#FFB800" isAnimationActive animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}


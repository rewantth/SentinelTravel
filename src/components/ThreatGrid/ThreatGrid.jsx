import SeverityStamp from "../SeverityStamp/SeverityStamp.jsx";

const severityColor = {
  critical: "#FF0040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "#00F5FF",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function project(location = {}) {
  const lon = Number(location.longitude ?? 0);
  const lat = Number(location.latitude ?? 0);
  return {
    x: clamp(((lon + 180) / 360) * 100, 7, 93),
    y: clamp(((90 - lat) / 180) * 100, 9, 91),
  };
}

export default function ThreatGrid({ alerts = [], selectedId, onSelect }) {
  const visible = alerts.slice(0, 24);
  return (
    <section className="relative min-h-[560px] overflow-hidden border border-line bg-void/75 shadow-panel backdrop-blur-md">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,245,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,245,255,.08)_1px,transparent_1px)] bg-[size:44px_44px] opacity-70 animate-breathe" />
      <div className="absolute left-1/2 top-1/2 h-[92rem] w-[92rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(0,245,255,.18)_34deg,transparent_72deg)] opacity-70 animate-radar" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan/10 to-transparent" />
      <svg className="absolute inset-0 h-full w-full">
        {visible.map((alert) => {
          const previous = project(alert.previous_login_location);
          const current = project(alert.current_login_location);
          const color = severityColor[alert.severity] || severityColor.low;
          return (
            <line
              key={`${alert.alert_id}-line`}
              x1={`${previous.x}%`}
              y1={`${previous.y}%`}
              x2={`${current.x}%`}
              y2={`${current.y}%`}
              stroke={color}
              strokeWidth={alert.severity === "critical" ? 2.8 : 1.8}
              strokeDasharray="8 10"
              className="animate-dash"
              opacity={selectedId && selectedId !== alert.alert_id ? 0.14 : 0.82}
            />
          );
        })}
      </svg>

      <div className="absolute left-5 top-5 z-10 max-w-[480px]">
        <div className="font-display text-3xl font-black uppercase text-white drop-shadow-cyan">SentinelTravel</div>
        <div className="mt-2 font-mono text-xs uppercase text-cyan">Neural Threat Grid // live identity telemetry</div>
      </div>

      {visible.map((alert) => {
        const current = project(alert.current_login_location);
        const color = severityColor[alert.severity] || severityColor.low;
        const size = 34 + alert.risk_score * 0.42;
        const dimmed = selectedId && selectedId !== alert.alert_id;
        return (
          <button
            key={alert.alert_id}
            type="button"
            onClick={() => onSelect(alert)}
            className={`absolute z-20 grid place-items-center transition duration-300 ${dimmed ? "opacity-25 blur-[1px]" : "opacity-100"}`}
            style={{
              left: `${current.x}%`,
              top: `${current.y}%`,
              width: size,
              height: size,
              transform: "translate(-50%, -50%)",
            }}
            title={`${alert.severity.toUpperCase()} ${alert.user_email}`}
          >
            {alert.severity === "critical" && (
              <span
                className="absolute inset-0 animate-criticalPulse border"
                style={{
                  borderColor: color,
                  clipPath: "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)",
                  filter: `drop-shadow(0 0 18px ${color})`,
                }}
              />
            )}
            <span
              className="absolute inset-0 border bg-void/90"
              style={{
                borderColor: color,
                boxShadow: `0 0 28px ${color}`,
                clipPath: "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)",
              }}
            />
            <span className="relative font-display text-sm font-black text-white">{alert.risk_score}</span>
          </button>
        );
      })}

      <div className="absolute bottom-5 left-5 z-20 grid max-w-[520px] grid-cols-2 gap-3 text-xs md:grid-cols-4">
        {["critical", "high", "medium", "low"].map((severity) => (
          <div key={severity} className="border border-line bg-void/80 p-3">
            <SeverityStamp severity={severity} />
            <div className="mt-2 font-mono text-slate-400">
              {alerts.filter((alert) => alert.severity === severity).length} nodes
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


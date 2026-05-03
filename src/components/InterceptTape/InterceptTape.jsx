import { useEffect, useState } from "react";

const tone = {
  critical: "text-crimson border-crimson shadow-crimson",
  high: "text-orange border-orange",
  medium: "text-amber border-amber",
  low: "text-cyan border-cyan",
};

export default function InterceptTape({ feed = [], onSelect }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (feed[0]?.severity === "critical") {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [feed]);

  return (
    <aside
      className={`fixed bottom-0 right-0 top-0 z-40 hidden w-[310px] border-l bg-void/88 shadow-panel backdrop-blur-xl transition xl:block ${
        flash ? "border-crimson shadow-crimson" : "border-line"
      }`}
    >
      <div className="border-b border-line px-4 py-4">
        <h2 className="font-display text-sm font-black uppercase text-white">Signal Intercept Tape</h2>
        <p className="mt-1 font-mono text-xs text-cyan">WebSocket stream /ws/alerts</p>
      </div>
      <div className="flex h-[calc(100%-74px)] flex-col-reverse overflow-hidden px-3 py-4">
        {feed.slice(0, 24).map((alert, index) => (
          <button
            key={`${alert.alert_id}-${index}`}
            type="button"
            onClick={() => onSelect(alert)}
            className={`mb-2 w-full border-l-2 bg-chrome/55 px-3 py-2 text-left font-mono text-xs transition hover:bg-cyan/10 ${
              tone[alert.severity] || tone.low
            }`}
          >
            <div className="text-[10px] text-slate-400">{new Date(alert.current_login_time || alert.created_at).toLocaleTimeString()}</div>
            <div className="mt-1 uppercase">
              {alert.severity} // {alert.user_email}
            </div>
            <div className="mt-1 line-clamp-2 text-slate-300">{alert.reasons?.[0]?.detail || "New identity signal"}</div>
          </button>
        ))}
        {!feed.length && (
          <div className="mt-auto border border-line bg-chrome/45 p-4 font-mono text-xs uppercase text-slate-500">
            Awaiting intercept telemetry
          </div>
        )}
      </div>
    </aside>
  );
}


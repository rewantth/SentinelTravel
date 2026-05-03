import { useEffect, useState } from "react";
import { Crosshair, Eye, ShieldCheck } from "lucide-react";

import SeverityStamp from "../SeverityStamp/SeverityStamp.jsx";

const severityDot = {
  critical: "bg-crimson shadow-crimson",
  high: "bg-orange shadow-[0_0_16px_rgba(255,107,0,.65)]",
  medium: "bg-amber shadow-amber",
  low: "bg-cyan shadow-cyan",
};

function DecodedText({ text }) {
  const [visible, setVisible] = useState("");
  useEffect(() => {
    setVisible("");
    let index = 0;
    const timer = setInterval(() => {
      index += 2;
      setVisible(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(timer);
      }
    }, 12);
    return () => clearInterval(timer);
  }, [text]);
  return <span>{visible}</span>;
}

function reasonLine(alert) {
  const primary = alert.reasons?.find((reason) => reason.points > 0);
  return primary?.detail || "Behavioral anomaly requires analyst review.";
}

export default function AlertsBriefingList({ alerts = [], selectedId, onSelect }) {
  return (
    <section className="border border-line bg-void/70 shadow-panel backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-black uppercase text-white">Tactical Briefing List</h2>
          <p className="mt-1 font-mono text-xs text-slate-400">Decoded identity-threat sequence</p>
        </div>
        <div className="font-mono text-xs text-cyan">{alerts.length} records</div>
      </div>
      <div className="max-h-[430px] overflow-auto">
        {alerts.map((alert) => {
          const active = selectedId === alert.alert_id;
          return (
            <button
              key={alert.alert_id}
              type="button"
              onClick={() => onSelect(alert)}
              className={`group grid w-full grid-cols-[auto_minmax(0,1.2fr)_auto] items-center gap-4 border-b border-line/80 px-4 py-3 text-left transition hover:bg-cyan/10 ${
                active ? "bg-cyan/15" : "bg-transparent"
              }`}
            >
              <span className={`h-3 w-3 rounded-full ${severityDot[alert.severity]} ${alert.severity === "critical" ? "animate-flicker" : ""}`} />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <SeverityStamp severity={alert.severity} />
                  <span className="font-mono text-xs text-slate-400">{alert.alert_id}</span>
                </span>
                <span className="mt-2 block truncate font-display text-sm uppercase text-white">
                  <DecodedText text={`${alert.user_email} :: ${reasonLine(alert)}`} />
                </span>
                <span className="mt-1 block font-mono text-xs text-slate-400">
                  {alert.previous_login_location?.city || "Unknown"} -> {alert.current_login_location?.city || "Unknown"} |
                  {" "}
                  {Math.round(alert.required_speed_kmh).toLocaleString()} km/h
                </span>
              </span>
              <span className="flex translate-x-2 items-center gap-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
                <span title="Classify" className="grid h-8 w-8 place-items-center border border-cyan/40 text-cyan">
                  <ShieldCheck size={15} />
                </span>
                <span title="Investigate" className="grid h-8 w-8 place-items-center border border-amber/50 text-amber">
                  <Eye size={15} />
                </span>
                <span title="Confirm" className="grid h-8 w-8 place-items-center border border-crimson/50 text-crimson">
                  <Crosshair size={15} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

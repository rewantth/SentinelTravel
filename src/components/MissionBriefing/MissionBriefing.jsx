import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { api } from "../../api.js";
import AnalystTerminal from "../AnalystTerminal/AnalystTerminal.jsx";
import AuditTape from "../AuditTape/AuditTape.jsx";
import CommandActions from "../CommandActions/CommandActions.jsx";
import ConfidenceSignal from "../ConfidenceSignal/ConfidenceSignal.jsx";
import MitreTags from "../MitreTags/MitreTags.jsx";
import RiskChargeMeter from "../RiskChargeMeter/RiskChargeMeter.jsx";
import SeverityStamp from "../SeverityStamp/SeverityStamp.jsx";
import UserMissionLog from "../UserMissionLog/UserMissionLog.jsx";

function TravelTrace({ alert }) {
  const color = alert.severity === "critical" ? "#FF0040" : alert.severity === "high" ? "#FF6B00" : alert.severity === "medium" ? "#FFB800" : "#00F5FF";
  return (
    <div className="relative h-36 overflow-hidden border border-line bg-void/80">
      <svg viewBox="0 0 520 140" className="h-full w-full">
        <defs>
          <filter id="traceGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="64" cy="74" r="10" fill="#020408" stroke={color} strokeWidth="3" filter="url(#traceGlow)" />
        <circle cx="456" cy="64" r="13" fill="#020408" stroke={color} strokeWidth="3" filter="url(#traceGlow)" />
        <path d="M74 72 C 170 16, 326 116, 444 66" fill="none" stroke={color} strokeWidth="3" strokeDasharray="10 12" className="animate-dash" />
        <text x="208" y="54" fill={color} className="font-mono text-[13px]">
          {Math.round(alert.required_speed_kmh).toLocaleString()} KM/H
        </text>
      </svg>
      <div className="absolute bottom-3 left-4 font-mono text-xs text-slate-300">
        {alert.previous_login_location?.city || "Unknown"} / {alert.previous_login_location?.country || "Unknown"}
      </div>
      <div className="absolute bottom-3 right-4 text-right font-mono text-xs text-slate-300">
        {alert.current_login_location?.city || "Unknown"} / {alert.current_login_location?.country || "Unknown"}
      </div>
    </div>
  );
}

function WhyPanel({ reasons = [], visibleCount }) {
  return (
    <section className="border border-line bg-void/70 p-4 shadow-panel">
      <h3 className="font-display text-xs font-black uppercase text-white">Why This Alert Fired</h3>
      <div className="mt-3 space-y-2">
        {reasons.slice(0, visibleCount).map((reason) => (
          <div key={`${reason.code}-${reason.detail}`} className="font-mono text-sm text-slate-200 animate-rise">
            <span className="text-cyan">{">"}</span> {reason.detail}
            <span className={reason.points >= 25 ? "ml-2 text-crimson" : reason.points > 0 ? "ml-2 text-amber" : "ml-2 text-slate-500"}>
              {reason.points > 0 ? `+${reason.points}` : reason.points}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MissionBriefing({ alert, onClose, onUpdated }) {
  const [notes, setNotes] = useState([]);
  const [audit, setAudit] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [visibleReasons, setVisibleReasons] = useState(0);
  const [error, setError] = useState("");

  const title = useMemo(() => `THREAT ACTOR: ${alert?.user_email || "unknown"}`, [alert]);

  useEffect(() => {
    if (!alert) {
      return;
    }
    setVisibleReasons(0);
    setError("");
    api.notes(alert.alert_id).then(setNotes).catch(() => setNotes([]));
    api.audit(alert.alert_id).then(setAudit).catch(() => setAudit([]));
    api.timeline(alert.user_email).then(setTimeline).catch(() => setTimeline([]));
  }, [alert]);

  useEffect(() => {
    if (!alert) {
      return;
    }
    const timer = setInterval(() => {
      setVisibleReasons((current) => {
        if (current >= alert.reasons.length) {
          clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 170);
    return () => clearInterval(timer);
  }, [alert]);

  if (!alert) {
    return null;
  }

  const triage = async (status) => {
    try {
      setError("");
      const updated = await api.triage(alert.alert_id, status, "mission-control");
      onUpdated(updated);
      setAudit(await api.audit(alert.alert_id));
    } catch (err) {
      setError("Transition denied by triage workflow.");
    }
  };

  const addNote = async (note) => {
    await api.addNote(alert.alert_id, note, "mission-control");
    setNotes(await api.notes(alert.alert_id));
    setAudit(await api.audit(alert.alert_id));
  };

  return (
    <section className="fixed inset-0 z-50 overflow-auto bg-void/96 p-4 text-white backdrop-blur-xl md:p-6">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,0,64,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,245,255,.07)_1px,transparent_1px)] bg-[size:38px_38px] opacity-60" />
      <div className="relative mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <SeverityStamp severity={alert.severity} />
              <span className="font-mono text-xs uppercase text-cyan">{alert.alert_id}</span>
              <span className="font-mono text-xs uppercase text-slate-400">triage: {alert.triage_status}</span>
            </div>
            <h1 className="mt-4 font-display text-3xl font-black uppercase text-white md:text-5xl">{title}</h1>
            <p className="mt-3 max-w-3xl font-mono text-sm text-slate-300">
              {alert.previous_login_location?.city || "Unknown"} -> {alert.current_login_location?.city || "Unknown"} / distance{" "}
              {Math.round(alert.distance_km).toLocaleString()} km / confidence {Math.round(alert.confidence * 100)}%
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close briefing"
            className="grid h-11 w-11 place-items-center border border-cyan/45 bg-cyan/10 text-cyan transition hover:bg-cyan hover:text-black"
          >
            <X size={20} />
          </button>
        </header>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-4">
            <TravelTrace alert={alert} />
            <WhyPanel reasons={alert.reasons} visibleCount={visibleReasons} />
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="border border-line bg-void/70 p-4 shadow-panel">
                <h3 className="font-display text-xs font-black uppercase text-white">MITRE ATT&CK Mapping</h3>
                <div className="mt-3">
                  <MitreTags techniques={alert.mitre_techniques} />
                </div>
              </div>
              <div className="border border-line bg-void/70 p-4 shadow-panel">
                <h3 className="font-display text-xs font-black uppercase text-white">Confidence Breakdown</h3>
                <div className="mt-3 grid gap-2 font-mono text-xs text-slate-300">
                  {Object.entries(alert.confidence_breakdown || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between border-b border-line/70 pb-1">
                      <span>{key}</span>
                      <span className="text-cyan">{value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <UserMissionLog timeline={timeline} />
          </div>

          <aside className="space-y-4">
            <div className="grid gap-4 border border-line bg-void/70 p-4 shadow-panel md:grid-cols-[auto_1fr]">
              <RiskChargeMeter score={alert.risk_score} severity={alert.severity} />
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-xs font-black uppercase text-white">Confidence Signal</h3>
                  <div className="mt-4">
                    <ConfidenceSignal confidence={alert.confidence} />
                  </div>
                </div>
                <div className="font-mono text-xs text-slate-300">
                  Legitimate travel model:{" "}
                  <span className={alert.possible_legitimate_travel ? "text-amber" : "text-crimson"}>
                    {alert.possible_legitimate_travel ? "possible" : "unlikely"}
                  </span>
                </div>
              </div>
            </div>
            <div className="border border-line bg-void/70 p-4 shadow-panel">
              <CommandActions actions={alert.recommended_actions} currentStatus={alert.triage_status} onTriage={triage} />
              {error && <div className="mt-3 border border-crimson/60 bg-crimson/10 p-2 font-mono text-xs text-crimson">{error}</div>}
            </div>
            <AnalystTerminal notes={notes} onAddNote={addNote} />
            <AuditTape logs={audit} />
          </aside>
        </div>
      </div>
    </section>
  );
}


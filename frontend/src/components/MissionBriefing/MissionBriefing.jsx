import React from "react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";

import AnalystTerminal from "../AnalystTerminal/AnalystTerminal.jsx";
import AuditTape from "../AuditTape/AuditTape.jsx";
import ConfidenceSignal from "../ConfidenceSignal/ConfidenceSignal.jsx";
import { recordDecision } from "../DecisionLog/DecisionLog.jsx";
import MitreTags from "../MitreTags/MitreTags.jsx";
import RiskChargeMeter from "../RiskChargeMeter/RiskChargeMeter.jsx";
import SeverityStamp from "../SeverityStamp/SeverityStamp.jsx";
import { copyToClipboard, formatDualTime, formatIpContext } from "../../utils/formatters.js";

const API_BASE = "http://localhost:8000";

const severityColors = {
  critical: "#FF0040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "#00F5FF",
};

const actionTone = {
  critical: "border-crimson/60 bg-crimson/10 text-crimson hover:bg-crimson hover:text-white",
  high: "border-orange/60 bg-orange/10 text-orange hover:bg-orange hover:text-black",
  medium: "border-amber/60 bg-amber/10 text-amber hover:bg-amber hover:text-black",
  low: "border-cyan/60 bg-cyan/10 text-cyan hover:bg-cyan hover:text-black",
};

function normalize(value) {
  return String(value || "").toLowerCase();
}

function hasCoordinates(location = {}) {
  return Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));
}

function locationLabel(location = {}) {
  return [location.city, location.country].filter(Boolean).join(", ") || "Unknown location";
}

function formatTimestamp(value) {
  return value ? formatDualTime(value) : "unknown timestamp";
}

function commandLabel(action) {
  return String(action.code || action.label || "review_activity").replaceAll("_", " ").toUpperCase();
}

function reasonIcon(reasonCode = "") {
  const code = reasonCode.toLowerCase();
  if (code.includes("travel")) {
    return "VEL";
  }
  if (code.includes("mfa")) {
    return "MFA";
  }
  if (code.includes("vpn") || code.includes("tor") || code.includes("proxy")) {
    return "VPN";
  }
  if (code.includes("ip")) {
    return "IP";
  }
  if (code.includes("device")) {
    return "DEV";
  }
  if (code.includes("country") || code.includes("city")) {
    return "GEO";
  }
  if (code.includes("asn")) {
    return "ASN";
  }
  return "SIG";
}

function TravelMap({ alert, severity }) {
  const previous = alert.previous_login_location || {};
  const current = alert.current_login_location || {};
  const color = severityColors[severity] || severityColors.low;

  if (!hasCoordinates(previous) || !hasCoordinates(current)) {
    return (
      <div className="grid h-[320px] place-items-center border border-borderDefault bg-void/70 font-mono text-sm uppercase text-textMuted">
        Coordinate set unavailable
      </div>
    );
  }

  const previousPoint = [Number(previous.latitude), Number(previous.longitude)];
  const currentPoint = [Number(current.latitude), Number(current.longitude)];
  const center = [(previousPoint[0] + currentPoint[0]) / 2, (previousPoint[1] + currentPoint[1]) / 2];

  return (
    <div className="relative h-[320px] overflow-hidden border border-borderDefault bg-void shadow-panel">
      <MapContainer
        key={alert.alert_id}
        center={center}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <Polyline
          positions={[previousPoint, currentPoint]}
          pathOptions={{
            color,
            weight: 3,
            opacity: 0.95,
            dashArray: "10 10",
            className: "travel-line-dash",
          }}
        />
        <CircleMarker center={previousPoint} radius={10} pathOptions={{ color, fillColor: "#020408", fillOpacity: 0.9, weight: 3 }}>
          <Tooltip permanent direction="top" className="sentinel-map-tooltip">
            PREVIOUS
          </Tooltip>
        </CircleMarker>
        <CircleMarker center={currentPoint} radius={13} pathOptions={{ color, fillColor: "#020408", fillOpacity: 0.9, weight: 3 }}>
          <Tooltip permanent direction="top" className="sentinel-map-tooltip">
            CURRENT
          </Tooltip>
        </CircleMarker>
      </MapContainer>

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2 border bg-void/90 px-3 py-2 font-orbitron text-xs font-black uppercase shadow-panel"
        style={{ borderColor: color, color }}
      >
        {Math.round(alert.required_speed_kmh || 0).toLocaleString()} KM/H
      </div>
    </div>
  );
}

function TravelMetric({ label, value }) {
  return (
    <div className="border border-borderDefault bg-card/55 p-3">
      <div className="font-mono text-[10px] uppercase text-textMuted">{label}</div>
      <div className="mt-2 font-mono text-sm text-textPrimary">{value}</div>
    </div>
  );
}

function WhyPanel({ reasons = [] }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!reasons.length) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setVisibleCount((current) => {
        if (current >= reasons.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 150);

    return () => window.clearInterval(timer);
  }, [reasons]);

  return (
    <section className="border border-borderDefault bg-void/74 p-4 shadow-panel">
      <h3 className="font-orbitron text-sm font-black uppercase text-amber">Why This Alert Fired</h3>
      <div className="mt-4 grid gap-3">
        {reasons.slice(0, visibleCount).map((reason) => (
          <div key={`${reason.code}-${reason.detail}`} className="flex gap-3 font-mono text-sm text-textPrimary decode-row-in">
            <span className="grid h-7 min-w-9 place-items-center border border-amber/50 bg-amber/10 text-[10px] font-bold text-amber">
              {reasonIcon(reason.code)}
            </span>
            <span>
              {reason.detail}{" "}
              <span className={reason.points >= 25 ? "text-crimson" : reason.points > 0 ? "text-amber" : "text-textMuted"}>
                {reason.points > 0 ? `+${reason.points}` : reason.points}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecommendedActions({ actions = [], severity }) {
  return (
    <section className="border border-borderDefault bg-panel/80 p-4 shadow-panel">
      <h3 className="font-orbitron text-xs font-black uppercase text-textPrimary">Recommended Actions</h3>
      <div className="mt-3 grid gap-2">
        {actions.map((action) => {
          const tone = actionTone[normalize(action.severity)] || actionTone[severity] || actionTone.low;
          return (
            <button
              key={action.code || action.label}
              type="button"
              title={action.description}
              className={`border px-3 py-3 text-left font-mono text-xs uppercase transition ${tone}`}
            >
              {">"} {commandLabel(action)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = async (event) => {
    event.stopPropagation();
    const ok = await copyToClipboard(value);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 1300);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="border border-cyan/35 bg-cyan/10 px-2 py-1 font-mono text-[10px] uppercase text-cyan transition hover:bg-cyan hover:text-black"
    >
      {copied ? "[> COPIED]" : "[> COPY]"}
    </button>
  );
}

function FieldLine({ label, value, copyValue }) {
  return (
    <div className="border border-borderDefault bg-void/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase text-textMuted">{label}</span>
        {copyValue && <CopyButton value={copyValue} />}
      </div>
      <div className="mt-2 break-all font-mono text-xs text-textPrimary">{value}</div>
    </div>
  );
}

function RawUserAgent({ event }) {
  const [open, setOpen] = useState(false);
  const raw = event?.user_agent || "Raw user agent not linked to this alert event.";

  return (
    <section className="border border-borderDefault bg-panel/80 p-4 shadow-panel">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between font-orbitron text-xs font-black uppercase text-textPrimary"
      >
        <span>Raw User Agent</span>
        <span className="font-mono text-cyan">{open ? "COLLAPSE" : "EXPAND"}</span>
      </button>
      {open && (
        <pre className="mt-3 max-h-36 overflow-auto border border-cyan/25 bg-void p-3 font-mono text-[11px] leading-5 text-cyan">
          {raw}
        </pre>
      )}
    </section>
  );
}

function KillSwitchPanel({ alert }) {
  const [statuses, setStatuses] = useState({});

  const actions = [
    { code: "revoke_sessions", label: "⚡ TERMINATE SESSION", log: "TERMINATED SESSION" },
    { code: "lock_account", label: "🔒 LOCK ACCOUNT", log: "LOCKED ACCOUNT" },
    { code: "notify_soc", label: "📡 ALERT SOC TEAM", log: "ALERTED SOC TEAM" },
    { code: "force_mfa", label: "🛡 FORCE MFA NOW", log: "FORCED MFA" },
  ];

  const execute = (action) => {
    setStatuses((current) => ({ ...current, [action.code]: "EXECUTING RESPONSE..." }));
    window.setTimeout(() => {
      const utc = new Date().toISOString().slice(11, 19);
      setStatuses((current) => ({ ...current, [action.code]: `RESPONSE LOGGED - ${utc} UTC` }));
      recordDecision(action.log, alert.user_email, { alert_id: alert.alert_id, code: action.code });
    }, 700);
  };

  return (
    <section className="border border-crimson/60 bg-crimson/10 p-4 shadow-crimson">
      <h3 className="font-orbitron text-xs font-black uppercase text-crimson">Immediate Response</h3>
      <div className="mt-3 grid gap-2">
        {actions.map((action) => (
          <button
            key={action.code}
            type="button"
            onClick={() => execute(action)}
            className="border border-crimson bg-crimson/20 px-3 py-3 text-left font-mono text-xs uppercase text-crimson shadow-crimson transition hover:bg-crimson hover:text-white"
          >
            <span>{action.label}</span>
            {statuses[action.code] && <span className="mt-1 block text-[10px] text-textPrimary">{statuses[action.code]}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function TriageControls({ alert, currentStatus, onUpdated, onAuditRefresh }) {
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState("");

  const patchTriage = async (status) => {
    try {
      setLoadingStatus(status);
      setError("");
      const response = await fetch(`${API_BASE}/alerts/${alert.alert_id}/triage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          actor: "SOC-OPERATOR-01",
        }),
      });
      if (!response.ok) {
        throw new Error(`triage failed: ${response.status}`);
      }
      const updated = await response.json();
      onUpdated?.(updated);
      onAuditRefresh?.();
      recordDecision(`MARKED ${status.replace("_", " ").toUpperCase()}`, alert.user_email, { alert_id: alert.alert_id });
    } catch {
      setError("TRIAGE TRANSITION DENIED");
    } finally {
      setLoadingStatus("");
    }
  };

  const buttons = [
    ["investigating", "MARK INVESTIGATING"],
    ["false_positive", "MARK FALSE POSITIVE"],
    ["confirmed", "MARK CONFIRMED"],
  ];

  return (
    <section className="border border-borderDefault bg-panel/80 p-4 shadow-panel">
      <h3 className="font-orbitron text-xs font-black uppercase text-textPrimary">Triage Controls</h3>
      <div className="mt-3 grid gap-2">
        {buttons.map(([status, label]) => (
          <button
            key={status}
            type="button"
            disabled={currentStatus === status || loadingStatus === status}
            onClick={() => patchTriage(status)}
            className="border border-cyan/45 bg-cyan/10 px-3 py-3 text-left font-mono text-xs uppercase text-cyan transition hover:bg-cyan hover:text-black disabled:border-borderDefault disabled:bg-card disabled:text-textMuted"
          >
            {loadingStatus === status ? "> UPDATING" : `> ${label}`}
          </button>
        ))}
      </div>
      {error && <div className="mt-3 border border-crimson/50 bg-crimson/10 p-2 font-mono text-xs text-crimson">{error}</div>}
    </section>
  );
}

export default function MissionBriefing({ alert, onClose, onUpdated }) {
  const [activeAlert, setActiveAlert] = useState(alert);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [linkedEvent, setLinkedEvent] = useState(null);

  useEffect(() => {
    setActiveAlert(alert);
    setAuditRefreshKey((current) => current + 1);
  }, [alert]);

  useEffect(() => {
    if (!activeAlert?.user_email) {
      setLinkedEvent(null);
      return undefined;
    }

    const controller = new AbortController();
    async function loadEventContext() {
      try {
        const response = await fetch(`${API_BASE}/login-events?user_email=${encodeURIComponent(activeAlert.user_email)}&limit=5000`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        const events = await response.json();
        const currentIp = activeAlert.current_login_location?.ip_address;
        const currentTime = activeAlert.current_login_time;
        const match =
          events.find((item) => item.ip_address === currentIp && item.timestamp === currentTime) ||
          events.find((item) => item.ip_address === currentIp) ||
          events[0];
        setLinkedEvent(match || null);
      } catch {
        setLinkedEvent(null);
      }
    }
    loadEventContext();
    return () => controller.abort();
  }, [activeAlert]);

  useEffect(() => {
    if (!activeAlert) {
      return undefined;
    }
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeAlert, onClose]);

  const severity = normalize(activeAlert?.severity || "low");
  const severityColor = severityColors[severity] || severityColors.low;

  const previous = activeAlert?.previous_login_location || {};
  const current = activeAlert?.current_login_location || {};

  const detailMetrics = useMemo(() => {
    if (!activeAlert) {
      return [];
    }

    return [
      ["PREVIOUS LOCATION", `${locationLabel(previous)} - ${formatTimestamp(activeAlert.previous_login_time)}`],
      ["CURRENT LOCATION", `${locationLabel(current)} - ${formatTimestamp(activeAlert.current_login_time)}`],
      ["DISTANCE", `${Math.round(activeAlert.distance_km || 0).toLocaleString()} km`],
      ["TIME DIFFERENCE", `${Math.round(activeAlert.time_difference_minutes || 0).toLocaleString()} minutes`],
      ["REQUIRED SPEED", `${Math.round(activeAlert.required_speed_kmh || 0).toLocaleString()} km/h`],
    ];
  }, [activeAlert, current, previous]);

  if (!activeAlert) {
    return null;
  }

  const updateActiveAlert = (updated) => {
    setActiveAlert(updated);
    onUpdated?.(updated);
  };

  return (
    <section className="fixed inset-0 z-50 overflow-auto bg-void/96 p-4 text-textPrimary backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-void/80" />
      <div className="scanline-grid opacity-35" />
      <div className="noise-layer" />

      <div className="relative z-10 mx-auto max-w-[1700px]">
        <button
          type="button"
          onClick={onClose}
          className="mb-4 border border-cyan/50 bg-cyan/10 px-4 py-2 font-mono text-xs uppercase text-cyan shadow-cyan transition hover:bg-cyan hover:text-black"
        >
          &lt; BACK TO BRIEFINGS
        </button>

        <div className="grid gap-4 xl:grid-cols-[330px_minmax(460px,1fr)_370px]">
          <aside className="space-y-4 border border-borderDefault bg-panel/82 p-4 shadow-panel">
            <div>
              <div className="flex items-center justify-between gap-3 font-mono text-xs uppercase text-textMuted">
                <span>{activeAlert.alert_id}</span>
                <CopyButton value={activeAlert.alert_id} />
              </div>
              <h2 className="mt-3 font-orbitron text-3xl font-black uppercase" style={{ color: severityColor, textShadow: `0 0 18px ${severityColor}` }}>
                THREAT ACTOR: <span className="break-all">{activeAlert.user_email}</span>
              </h2>
              <div className="mt-3 flex justify-end">
                <CopyButton value={activeAlert.user_email} />
              </div>
            </div>

            <SeverityStamp severity={severity} className="text-sm" />

            <div className="flex justify-center border border-borderDefault bg-void/60 p-5">
              <RiskChargeMeter score={activeAlert.risk_score} severity={severity} size={176} />
            </div>

            <div className="border border-borderDefault bg-void/60 p-4">
              <div className="mb-3 font-mono text-xs uppercase text-textMuted">Confidence score</div>
              <ConfidenceSignal confidence={activeAlert.confidence} breakdown={activeAlert.confidence_breakdown} />
            </div>

            <div className="border border-borderDefault bg-void/60 p-4">
              <div className="mb-3 font-mono text-xs uppercase text-textMuted">MITRE ATT&CK</div>
              <MitreTags techniques={activeAlert.mitre_techniques} />
            </div>

            <div className="border border-borderDefault bg-void/60 p-4 font-mono text-xs uppercase text-textMuted">
              possible legitimate travel
              <div className={`mt-2 text-lg ${activeAlert.possible_legitimate_travel ? "text-amber" : "text-crimson"}`}>
                {activeAlert.possible_legitimate_travel ? "POSSIBLE" : "UNLIKELY"}
              </div>
            </div>

            <div className="grid gap-3">
              <FieldLine label="Previous source" value={formatIpContext(previous)} copyValue={previous.ip_address} />
              <FieldLine label="Current source" value={formatIpContext(current)} copyValue={current.ip_address} />
            </div>
          </aside>

          <main className="space-y-4">
            <section className="border border-borderDefault bg-panel/82 p-4 shadow-panel">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-orbitron text-sm font-black uppercase text-textPrimary">Travel Analysis</h3>
                <div className="font-mono text-xs uppercase text-cyan">
                  {locationLabel(previous)} -&gt; {locationLabel(current)}
                </div>
              </div>

              <TravelMap alert={activeAlert} severity={severity} />

              <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
                {detailMetrics.map(([label, value]) => (
                  <TravelMetric key={label} label={label} value={value} />
                ))}
              </div>
            </section>

            <WhyPanel reasons={activeAlert.reasons || []} />
          </main>

          <aside className="space-y-4">
            <KillSwitchPanel alert={activeAlert} />
            <RecommendedActions actions={activeAlert.recommended_actions || []} severity={severity} />
            <TriageControls
              alert={activeAlert}
              currentStatus={activeAlert.triage_status}
              onUpdated={updateActiveAlert}
              onAuditRefresh={() => setAuditRefreshKey((current) => current + 1)}
            />
            <RawUserAgent event={linkedEvent} />
            <AnalystTerminal alertId={activeAlert.alert_id} onNoteAdded={() => setAuditRefreshKey((current) => current + 1)} />
            <AuditTape alertId={activeAlert.alert_id} refreshKey={auditRefreshKey} />
          </aside>
        </div>
      </div>
    </section>
  );
}

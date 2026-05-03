import React from "react";
import { useEffect, useMemo, useState } from "react";

import MissionBriefing from "../MissionBriefing/MissionBriefing.jsx";
import SeverityStamp from "../SeverityStamp/SeverityStamp.jsx";

const ALERTS_URL = "http://localhost:8000/alerts";
const ALERTS_WS = "ws://localhost:8000/ws/alerts";

const severityColors = {
  critical: "#FF0040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "#00F5FF",
};

function normalize(value) {
  return String(value || "low").toLowerCase();
}

function hasCoordinates(location = {}) {
  return Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));
}

function project(location = {}) {
  const longitude = Number(location.longitude || 0);
  const latitude = Number(location.latitude || 0);
  const x = Math.min(94, Math.max(6, ((longitude + 180) / 360) * 100));
  const y = Math.min(90, Math.max(10, ((90 - latitude) / 180) * 100));
  return { x, y };
}

function locationLabel(location = {}) {
  return [location.city, location.country].filter(Boolean).join(", ") || "Unknown";
}

function ThreatNode({ alert, selected, pulseActive, onSelect }) {
  const severity = normalize(alert.severity);
  const color = severityColors[severity] || severityColors.low;
  const point = project(alert.current_login_location);
  const size = 42 + Math.min(100, Number(alert.risk_score) || 0) * 0.48;
  const dimmed = selected && selected.alert_id !== alert.alert_id;

  return (
    <button
      type="button"
      onClick={() => onSelect(alert)}
      className={`pointer-events-auto absolute z-20 grid place-items-center transition duration-300 ${dimmed ? "opacity-25 blur-[1px]" : "opacity-100"}`}
      style={{
        left: `${point.x}%`,
        top: `${point.y}%`,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
      }}
      title={`${alert.user_email} / ${severity}`}
    >
      {severity === "critical" && (
        <>
          <span className="threat-node-pulse" style={{ "--node-color": color }} />
          <span className="threat-node-pulse threat-node-pulse-delay" style={{ "--node-color": color }} />
        </>
      )}
      {pulseActive && <span className="threat-heatmap-shockwave" style={{ "--node-color": color }} />}
      <span className="absolute inset-0 bg-void/92" style={{ clipPath: "polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)", border: `2px solid ${color}`, boxShadow: `0 0 26px ${color}` }} />
      <span className="relative font-mono text-[10px] font-black text-textPrimary">{Math.round(alert.risk_score || 0)}</span>
      <span className="absolute top-full mt-1 max-w-[160px] truncate font-mono text-[10px] uppercase" style={{ color }}>
        {alert.user_email}
      </span>
    </button>
  );
}

export default function ThreatGrid() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [pulseAlertIds, setPulseAlertIds] = useState(() => new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadAlerts() {
      try {
        setError("");
        const response = await fetch(ALERTS_URL, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`alerts request failed: ${response.status}`);
        }
        setAlerts(await response.json());
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("THREAT GRID FEED OFFLINE");
        }
      }
    }

    loadAlerts();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const socket = new WebSocket(ALERTS_WS);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== "alert" || !message.payload?.alert_id) {
          return;
        }
        const incoming = message.payload;
        setAlerts((current) => [incoming, ...current.filter((alert) => alert.alert_id !== incoming.alert_id)]);
        setPulseAlertIds((current) => new Set(current).add(incoming.alert_id));
        window.setTimeout(() => {
          setPulseAlertIds((current) => {
            const next = new Set(current);
            next.delete(incoming.alert_id);
            return next;
          });
        }, 2600);
      } catch {
        setError("THREAT GRID STREAM DECODE FAILURE");
      }
    };
    socket.onerror = () => setError("THREAT GRID STREAM OFFLINE");
    return () => socket.close();
  }, []);

  const drawableAlerts = useMemo(
    () => alerts.filter((alert) => hasCoordinates(alert.current_login_location) && hasCoordinates(alert.previous_login_location)),
    [alerts],
  );

  const severityCounts = useMemo(
    () =>
      ["critical", "high", "medium", "low"].map((severity) => ({
        severity,
        count: alerts.filter((alert) => normalize(alert.severity) === severity).length,
      })),
    [alerts],
  );

  return (
    <section className="relative min-h-[calc(100vh-180px)] overflow-hidden border border-borderDefault bg-void shadow-panel">
      <div className="scanline-grid" />
      <div className="radar-sweep" />
      <div className="noise-layer" />

      <svg className="absolute inset-0 z-10 h-full w-full">
        {drawableAlerts.map((alert) => {
          const previous = project(alert.previous_login_location);
          const current = project(alert.current_login_location);
          const severity = normalize(alert.severity);
          const color = severityColors[severity] || severityColors.low;
          const dimmed = selectedAlert && selectedAlert.alert_id !== alert.alert_id;

          return (
            <line
              key={`${alert.alert_id}-path`}
              x1={`${previous.x}%`}
              y1={`${previous.y}%`}
              x2={`${current.x}%`}
              y2={`${current.y}%`}
              stroke={color}
              strokeWidth={severity === "critical" ? 2.8 : 1.8}
              strokeDasharray="9 11"
              className="travel-line-dash"
              opacity={dimmed ? 0.15 : 0.78}
            />
          );
        })}
      </svg>

      <header className="relative z-20 flex flex-wrap items-start justify-between gap-4 border-b border-borderDefault bg-panel/60 p-5 backdrop-blur">
        <div>
          <h2 className="font-orbitron text-3xl font-black uppercase text-textPrimary">Neural Threat Grid</h2>
          <div className={`mt-2 font-mono text-xs uppercase ${error ? "text-crimson" : "text-cyan"}`}>
            {error || `${drawableAlerts.length} geospatial identity nodes`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {severityCounts.map((item) => (
            <div key={item.severity} className="border border-borderDefault bg-void/70 px-3 py-2">
              <SeverityStamp severity={item.severity} />
              <div className="mt-2 font-mono text-xs text-textMuted">{item.count} nodes</div>
            </div>
          ))}
        </div>
      </header>

      <div className="pointer-events-none absolute inset-0 z-20">
        {drawableAlerts.map((alert) => (
          <ThreatNode key={alert.alert_id} alert={alert} selected={selectedAlert} pulseActive={pulseAlertIds.has(alert.alert_id)} onSelect={setSelectedAlert} />
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-30 max-w-xl border border-cyan/30 bg-panel/72 p-4 shadow-panel backdrop-blur">
        <div className="font-mono text-xs uppercase text-cyan">selected vectors dim surrounding nodes</div>
        <div className="mt-2 font-mono text-xs text-textMuted">
          Longitude and latitude are projected into the grid field. Risk controls node mass. Severity controls glow signature.
        </div>
      </div>

      <MissionBriefing alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </section>
  );
}

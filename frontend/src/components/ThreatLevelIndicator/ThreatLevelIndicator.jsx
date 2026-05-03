import React from "react";
import { useEffect, useMemo, useState } from "react";

const ALERTS_URL = "http://localhost:8000/alerts";
const ALERTS_WS = "ws://localhost:8000/ws/alerts";

function isLast24Hours(alert) {
  const value = alert.created_at || alert.current_login_time;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return true;
  }
  return Date.now() - date.getTime() <= 24 * 60 * 60 * 1000;
}

function levelFor(percent) {
  if (percent >= 55) {
    return { label: "SEVERE", color: "text-crimson", fill: "bg-crimson", pulse: true };
  }
  if (percent >= 35) {
    return { label: "HIGH", color: "text-crimson", fill: "bg-crimson", pulse: false };
  }
  if (percent >= 18) {
    return { label: "ELEVATED", color: "text-orange", fill: "bg-orange", pulse: false };
  }
  if (percent > 0) {
    return { label: "GUARDED", color: "text-amber", fill: "bg-amber", pulse: false };
  }
  return { label: "LOW", color: "text-emerald-400", fill: "bg-emerald-400", pulse: false };
}

export default function ThreatLevelIndicator({ onCritical }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAlerts() {
      try {
        const response = await fetch(ALERTS_URL, { signal: controller.signal });
        if (response.ok) {
          setAlerts(await response.json());
        }
      } catch {
        setAlerts([]);
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
        if (String(incoming.severity).toLowerCase() === "critical") {
          onCritical?.(incoming);
        }
      } catch {
        // Keep the meter stable if a malformed message appears.
      }
    };
    return () => socket.close();
  }, [onCritical]);

  const threat = useMemo(() => {
    const recent = alerts.filter(isLast24Hours);
    const total = recent.length || alerts.length;
    const critical = (recent.length ? recent : alerts).filter((alert) => String(alert.severity).toLowerCase() === "critical").length;
    const percent = total ? (critical / total) * 100 : 0;
    const active = Math.max(1, Math.min(10, Math.round(percent / 10)));
    return { percent, active, ...levelFor(percent) };
  }, [alerts]);

  return (
    <div className={`hidden min-w-[250px] border border-borderDefault bg-panel px-3 py-2 font-mono text-[11px] uppercase lg:block ${threat.pulse ? "severity-critical-pulse" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-textMuted">THREAT LEVEL</span>
        <span className={threat.color}>{threat.label}</span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} className={`h-2 flex-1 ${index < threat.active ? threat.fill : "bg-borderDefault"}`} />
        ))}
      </div>
    </div>
  );
}

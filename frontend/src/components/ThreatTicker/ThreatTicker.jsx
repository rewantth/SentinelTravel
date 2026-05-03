import React from "react";
import { useEffect, useMemo, useState } from "react";

import SeverityStamp from "../SeverityStamp/SeverityStamp.jsx";

const ALERTS_URL = "http://localhost:8000/alerts";
const ALERTS_WS = "ws://localhost:8000/ws/alerts";

function route(alert) {
  const previous = alert.previous_login_location || {};
  const current = alert.current_login_location || {};
  const from = previous.city || previous.country || "UNKNOWN";
  const to = current.city || current.country || "UNKNOWN";
  return `${from}->${to}`;
}

function reason(alert) {
  return alert?.reasons?.find((item) => item.points > 0)?.detail || alert?.reasons?.[0]?.detail || "Identity anomaly detected";
}

function markerFor(alert) {
  const severity = String(alert.severity || "").toLowerCase();
  if (severity === "critical") {
    return "⚠";
  }
  if (String(alert.triage_status).toLowerCase() === "confirmed") {
    return "●";
  }
  if (severity === "high") {
    return "▲";
  }
  return "●";
}

export default function ThreatTicker() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAlerts() {
      try {
        const response = await fetch(ALERTS_URL, { signal: controller.signal });
        if (response.ok) {
          const payload = await response.json();
          setAlerts(payload.slice(0, 24));
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
        if (message.type === "alert" && message.payload?.alert_id) {
          setAlerts((current) => [message.payload, ...current.filter((alert) => alert.alert_id !== message.payload.alert_id)].slice(0, 24));
        }
      } catch {
        // Ticker should never take down the operations surface.
      }
    };
    return () => socket.close();
  }, []);

  const tickerItems = useMemo(() => {
    const source = alerts.length ? alerts : [{ alert_id: "standby", severity: "low", user_email: "monitoring@nexuscorp.io", reasons: [{ detail: "No active intercepts in current view" }] }];
    return [...source, ...source].map((alert, index) => ({ ...alert, tickerKey: `${alert.alert_id}-${index}` }));
  }, [alerts]);

  return (
    <div className="relative z-40 h-9 overflow-hidden border-b border-borderDefault bg-panel/95 pr-[300px] shadow-panel">
      <div className="threat-ticker-track flex h-full min-w-max items-center gap-8 whitespace-nowrap font-mono text-xs uppercase">
        {tickerItems.map((alert) => {
          const severity = String(alert.severity || "low").toLowerCase();
          const critical = severity === "critical";
          return (
            <span key={alert.tickerKey} className={`flex items-center gap-2 ${critical ? "ticker-critical text-crimson" : "text-textPrimary"}`}>
              <span>{markerFor(alert)}</span>
              <SeverityStamp severity={alert.severity} />
              <span className="text-cyan">{alert.user_email}</span>
              <span className="text-textMuted">{route(alert)}</span>
              <span>{reason(alert)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

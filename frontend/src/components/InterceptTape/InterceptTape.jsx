import React from "react";
import { useEffect, useState } from "react";

import SeverityStamp from "../SeverityStamp/SeverityStamp.jsx";
import { formatDualTime } from "../../utils/formatters.js";

const ALERTS_URL = "http://localhost:8000/alerts";
const ALERTS_WS = "ws://localhost:8000/ws/alerts";

function reasonLine(alert) {
  return alert?.reasons?.find((reason) => reason.points > 0)?.detail || alert?.reasons?.[0]?.detail || "Identity signal received";
}

export default function InterceptTape() {
  const [feed, setFeed] = useState([]);
  const [flashCritical, setFlashCritical] = useState(false);
  const [status, setStatus] = useState("CONNECTING");

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialFeed() {
      try {
        const response = await fetch(ALERTS_URL, { signal: controller.signal });
        if (response.ok) {
          const alerts = await response.json();
          setFeed(alerts.slice(0, 50));
        }
      } catch {
        setStatus("REST OFFLINE");
      }
    }

    loadInitialFeed();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const socket = new WebSocket(ALERTS_WS);

    socket.onopen = () => setStatus("FEED ACTIVE");
    socket.onclose = () => setStatus("FEED OFFLINE");
    socket.onerror = () => setStatus("FEED OFFLINE");
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== "alert" || !message.payload?.alert_id) {
          return;
        }

        const incoming = message.payload;
        setFeed((current) => [incoming, ...current.filter((alert) => alert.alert_id !== incoming.alert_id)].slice(0, 50));

        if (String(incoming.severity).toLowerCase() === "critical") {
          setFlashCritical(true);
          window.setTimeout(() => setFlashCritical(false), 2000);
        }
      } catch {
        setStatus("DECODE ERROR");
      }
    };

    return () => socket.close();
  }, []);

  return (
    <aside
      className={`fixed bottom-0 right-0 top-0 z-40 w-[280px] border-l bg-panel shadow-panel backdrop-blur-xl transition ${
        flashCritical ? "border-crimson shadow-crimson" : "border-cyan"
      }`}
    >
      <div className="border-b border-borderDefault px-4 py-4">
        <h2 className="font-orbitron text-sm font-black uppercase text-textPrimary">SIGNAL INTERCEPT</h2>
        <div className={`mt-2 flex items-center gap-2 font-mono text-xs uppercase ${status === "FEED ACTIVE" ? "text-emerald-400" : "text-crimson"}`}>
          <span className={`h-2 w-2 rounded-full ${status === "FEED ACTIVE" ? "bg-emerald-400 feed-status-dot" : "bg-crimson"}`} />
          {status}
        </div>
      </div>

      <div className="flex h-[calc(100%-73px)] flex-col-reverse overflow-hidden px-3 py-4">
        {feed.map((alert, index) => (
          <article
            key={`${alert.alert_id}-${index}`}
            className="mb-3 border border-borderDefault bg-card/48 p-3 font-mono text-xs decode-row-in"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-textMuted">{formatDualTime(alert.current_login_time || alert.created_at)}</span>
              <SeverityStamp severity={alert.severity} />
            </div>
            <div className="mt-2 break-all text-cyan">{alert.user_email}</div>
            <div className="mt-1 line-clamp-2 text-textPrimary">{reasonLine(alert)}</div>
          </article>
        ))}

        {!feed.length && <div className="font-mono text-xs uppercase text-textMuted">Awaiting alert intercepts</div>}
      </div>
    </aside>
  );
}

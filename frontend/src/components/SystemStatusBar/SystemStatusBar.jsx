import React from "react";
import { useEffect, useMemo, useState } from "react";

import { formatDualTime } from "../../utils/formatters.js";

const SUMMARY_URL = "http://localhost:8000/dashboard/summary";
const LOGIN_EVENTS_URL = "http://localhost:8000/login-events?limit=5000";
const ALERTS_WS = "ws://localhost:8000/ws/alerts";

function pickNumber(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

export default function SystemStatusBar() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [summary, setSummary] = useState(null);
  const [eventCount, setEventCount] = useState(0);
  const [lastScan, setLastScan] = useState(() => new Date());

  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      try {
        const response = await fetch(SUMMARY_URL, { signal: controller.signal });
        setBackendOnline(response.ok);
        if (response.ok) {
          setSummary(await response.json());
          const eventsResponse = await fetch(LOGIN_EVENTS_URL, { signal: controller.signal });
          if (eventsResponse.ok) {
            const events = await eventsResponse.json();
            setEventCount(Array.isArray(events) ? events.length : 0);
          }
          setLastScan(new Date());
        }
      } catch {
        setBackendOnline(false);
      }
    }

    loadSummary();
    const timer = window.setInterval(loadSummary, 30000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const socket = new WebSocket(ALERTS_WS);
    socket.onopen = () => setWsConnected(true);
    socket.onclose = () => setWsConnected(false);
    socket.onerror = () => setWsConnected(false);
    return () => socket.close();
  }, []);

  const summaryEventFallback = useMemo(() => pickNumber(summary, ["total_logins", "totalLoginEvents", "login_events", "total_events"]), [summary]);
  const dbEvents = eventCount || summaryEventFallback;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 flex h-8 items-center gap-4 overflow-hidden border-t border-borderDefault bg-void/95 px-4 pr-[300px] font-mono text-[10px] uppercase text-textMuted backdrop-blur-xl">
      <span>
        BACKEND: <span className={backendOnline ? "text-emerald-400" : "text-crimson"}>{backendOnline ? "ONLINE" : "OFFLINE"} ●</span>
      </span>
      <span>
        WS: <span className={wsConnected ? "text-emerald-400" : "text-crimson"}>{wsConnected ? "CONNECTED" : "DISCONNECTED"} ●</span>
      </span>
      <span>
        DB: <span className="text-cyan">{dbEvents.toLocaleString()} EVENTS</span>
      </span>
      <span>
        DETECTION ENGINE: <span className="text-emerald-400">ACTIVE ●</span>
      </span>
      <span>
        LAST SCAN: <span className="text-cyan">{formatDualTime(lastScan)}</span>
      </span>
    </footer>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from "react";

import AnalystIdentity from "./components/AnalystIdentity/AnalystIdentity.jsx";
import AlertsBriefingList from "./components/AlertsBriefingList/AlertsBriefingList.jsx";
import BootSequence from "./components/BootSequence/BootSequence.jsx";
import ChartsPanel from "./components/ChartsPanel/ChartsPanel.jsx";
import DecisionLog from "./components/DecisionLog/DecisionLog.jsx";
import InterceptTape from "./components/InterceptTape/InterceptTape.jsx";
import SignalIntercepts from "./components/SignalIntercepts/SignalIntercepts.jsx";
import SystemStatusBar from "./components/SystemStatusBar/SystemStatusBar.jsx";
import ThemeToggle from "./components/ThemeToggle/ThemeToggle.jsx";
import ThreatLevelIndicator from "./components/ThreatLevelIndicator/ThreatLevelIndicator.jsx";
import ThreatTicker from "./components/ThreatTicker/ThreatTicker.jsx";
import ThreatGrid from "./components/ThreatGrid/ThreatGrid.jsx";
import UserMissionLog from "./components/UserMissionLog/UserMissionLog.jsx";
import WorldMap from "./components/WorldMap/WorldMap.jsx";
import { formatDualTime } from "./utils/formatters.js";

const navItems = ["THREAT GRID", "ALERTS", "MAP", "ANALYTICS", "TIMELINE"];
const ALERTS_URL = "http://localhost:8000/alerts";
const ALERTS_WS = "ws://localhost:8000/ws/alerts";

function formatClock(date) {
  return formatDualTime(date);
}

function ActivePage({ active }) {
  if (active === "THREAT GRID") {
    return <ThreatGrid />;
  }

  if (active === "ALERTS") {
    return <AlertsBriefingList />;
  }

  if (active === "MAP") {
    return <WorldMap />;
  }

  if (active === "ANALYTICS") {
    return <ChartsPanel />;
  }

  if (active === "TIMELINE") {
    return <UserMissionLog />;
  }

  return <ThreatGrid />;
}

export default function App() {
  const [activeNav, setActiveNav] = useState(navItems[0]);
  const [clock, setClock] = useState(() => new Date());
  const [theme, setTheme] = useState("dark");
  const [bootComplete, setBootComplete] = useState(false);
  const [criticalCount, setCriticalCount] = useState(0);
  const [alertFxEnabled, setAlertFxEnabled] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const handleCriticalAlert = useCallback(
    (alert) => {
      setScreenFlash(true);
      window.setTimeout(() => setScreenFlash(false), 1000);

      if (!alertFxEnabled) {
        return;
      }

      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(620, context.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(240, context.currentTime + 0.22);
          gain.gain.setValueAtTime(0.0001, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.36);
        }
      } catch {
        // Audio is a progressive enhancement for the SOC console.
      }

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("SentinelTravel critical alert", {
          body: `${alert.user_email || "Unknown identity"} - ${alert.reasons?.[0]?.detail || "Critical identity signal"}`,
        });
      }
    },
    [alertFxEnabled],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function loadCriticalCount() {
      try {
        const response = await fetch(ALERTS_URL, { signal: controller.signal });
        if (response.ok) {
          const alerts = await response.json();
          setCriticalCount(alerts.filter((alert) => String(alert.severity).toLowerCase() === "critical").length);
        }
      } catch {
        setCriticalCount(0);
      }
    }
    loadCriticalCount();
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
        if (String(message.payload.severity).toLowerCase() === "critical") {
          setCriticalCount((count) => count + 1);
          handleCriticalAlert(message.payload);
        }
      } catch {
        // Keep title/status updates isolated from malformed feed messages.
      }
    };
    return () => socket.close();
  }, [handleCriticalAlert]);

  useEffect(() => {
    document.title = criticalCount > 0 ? `⚠ ${criticalCount} CRITICAL - SentinelTravel` : "● MONITORING - SentinelTravel";
  }, [criticalCount]);

  useEffect(() => {
    const shortcuts = {
      g: "THREAT GRID",
      a: "ALERTS",
      m: "MAP",
      c: "ANALYTICS",
      t: "TIMELINE",
    };
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const destination = shortcuts[event.key.toLowerCase()];
      if (destination) {
        setActiveNav(destination);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const clockLabel = useMemo(() => formatClock(clock), [clock]);

  const toggleAlertFx = async () => {
    const nextEnabled = !alertFxEnabled;
    setAlertFxEnabled(nextEnabled);
    if (nextEnabled && "Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // Notification permission is optional.
      }
    }
  };

  if (!bootComplete) {
    return <BootSequence onComplete={() => setBootComplete(true)} />;
  }

  return (
    <main className={`relative min-h-screen overflow-x-hidden bg-void pb-10 font-mono text-textPrimary ${screenFlash ? "critical-screen-flash" : ""}`}>
      <div className="crt-overlay" />
      <div className="scanline-grid" />
      <div className="noise-layer" />

      <ThreatTicker />

      <nav className="relative z-20 flex min-h-20 items-center justify-between gap-4 border-b border-borderDefault bg-void/88 px-5 pr-[300px] shadow-panel backdrop-blur-xl">
        <button type="button" onClick={() => setActiveNav("THREAT GRID")} className="font-orbitron text-xl font-black uppercase cyan-glow">
          SENTINELTRAVEL
        </button>

        <div className="hidden items-center gap-2 xl:flex">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveNav(item)}
              className={`border px-3 py-2 font-orbitron text-xs font-bold uppercase transition ${
                activeNav === item
                  ? "border-cyan bg-cyan text-black shadow-cyan"
                  : "border-borderDefault bg-card/40 text-textMuted hover:border-cyan hover:text-cyan"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <ThreatLevelIndicator />
          <AnalystIdentity />
          <div className="hidden border border-borderDefault bg-panel px-4 py-2 font-mono text-xs text-cyan md:block">
            {clockLabel}
          </div>
          <button
            type="button"
            onClick={toggleAlertFx}
            className={`border px-3 py-2 font-mono text-[10px] uppercase transition ${
              alertFxEnabled ? "border-crimson bg-crimson/15 text-crimson shadow-crimson" : "border-borderDefault bg-panel text-textMuted hover:border-cyan hover:text-cyan"
            }`}
          >
            Alert FX {alertFxEnabled ? "On" : "Off"}
          </button>
          <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} />
        </div>
      </nav>

      <div className="relative z-10 px-5 py-5 pr-[300px]">
        <SignalIntercepts />

        <div className="mb-4 flex gap-2 overflow-x-auto xl:hidden">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveNav(item)}
              className={`shrink-0 border px-3 py-2 font-orbitron text-xs font-bold uppercase ${
                activeNav === item ? "border-cyan bg-cyan text-black" : "border-borderDefault bg-card/60 text-textMuted"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <ActivePage active={activeNav} />
      </div>

      <InterceptTape />
      <DecisionLog />
      <SystemStatusBar />
    </main>
  );
}

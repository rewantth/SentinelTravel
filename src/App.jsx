import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, DatabaseZap, Radar, RefreshCw } from "lucide-react";

import { api, WS_BASE } from "./api.js";
import AlertsBriefingList from "./components/AlertsBriefingList/AlertsBriefingList.jsx";
import ChartsPanel from "./components/ChartsPanel/ChartsPanel.jsx";
import InterceptTape from "./components/InterceptTape/InterceptTape.jsx";
import MissionBriefing from "./components/MissionBriefing/MissionBriefing.jsx";
import SignalIntercepts from "./components/SignalIntercepts/SignalIntercepts.jsx";
import ThemeToggle from "./components/ThemeToggle/ThemeToggle.jsx";
import ThreatGrid from "./components/ThreatGrid/ThreatGrid.jsx";
import WorldMap from "./components/WorldMap/WorldMap.jsx";

function commandButtonClass(tone = "cyan") {
  const tones = {
    cyan: "border-cyan/55 bg-cyan/10 text-cyan hover:bg-cyan hover:text-black",
    amber: "border-amber/60 bg-amber/10 text-amber hover:bg-amber hover:text-black",
  };
  return `inline-flex h-10 items-center gap-2 border px-3 font-mono text-xs uppercase transition ${tones[tone]}`;
}

export default function App() {
  const [theme, setTheme] = useState("dark");
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [feed, setFeed] = useState([]);
  const [status, setStatus] = useState("booting telemetry");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async ({ seedIfEmpty = false } = {}) => {
    setLoading(true);
    try {
      let [nextAlerts, nextSummary] = await Promise.all([api.alerts(), api.summary()]);
      if (seedIfEmpty && nextAlerts.length === 0) {
        setStatus("generating synthetic auth stream");
        const seeded = await api.generateSampleData();
        nextAlerts = seeded.alerts || [];
        nextSummary = await api.summary();
      }
      setAlerts(nextAlerts);
      setSummary(nextSummary);
      setFeed((current) => {
        const merged = [...nextAlerts.slice(0, 12), ...current];
        const seen = new Set();
        return merged.filter((alert) => {
          if (seen.has(alert.alert_id)) {
            return false;
          }
          seen.add(alert.alert_id);
          return true;
        });
      });
      setStatus("live monitoring active");
    } catch (error) {
      setStatus("backend offline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh({ seedIfEmpty: true });
  }, [refresh]);

  useEffect(() => {
    const socket = new WebSocket(`${WS_BASE}/ws/alerts`);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "alert") {
          setFeed((current) => [message.payload, ...current].slice(0, 40));
          setAlerts((current) => {
            const filtered = current.filter((alert) => alert.alert_id !== message.payload.alert_id);
            return [message.payload, ...filtered];
          });
        }
      } catch {
        setStatus("intercept stream decode failure");
      }
    };
    socket.onopen = () => setStatus("websocket intercept online");
    socket.onerror = () => setStatus("websocket awaiting backend");
    return () => socket.close();
  }, []);

  const selectedId = selectedAlert?.alert_id;
  const criticalPulse = useMemo(() => alerts.some((alert) => alert.severity === "critical" && alert.triage_status === "open"), [alerts]);

  const runDetection = async () => {
    setLoading(true);
    setStatus("rerunning detection engine");
    try {
      const result = await api.runDetection();
      const nextSummary = await api.summary();
      setAlerts(result.alerts || []);
      setSummary(nextSummary);
      setFeed(result.alerts || []);
      setStatus("detection cycle complete");
    } catch {
      setStatus("detection cycle failed");
    } finally {
      setLoading(false);
    }
  };

  const generateSamples = async () => {
    setLoading(true);
    setStatus("resetting synthetic data");
    try {
      const result = await api.generateSampleData();
      const nextSummary = await api.summary();
      setAlerts(result.alerts || []);
      setSummary(nextSummary);
      setFeed(result.alerts || []);
      setSelectedAlert(null);
      setStatus("synthetic scenario deck loaded");
    } catch {
      setStatus("sample generation failed");
    } finally {
      setLoading(false);
    }
  };

  const updateSelected = (updated) => {
    setSelectedAlert(updated);
    setAlerts((current) => current.map((alert) => (alert.alert_id === updated.alert_id ? updated : alert)));
    refresh();
  };

  return (
    <main
      className={`min-h-screen overflow-x-hidden font-mono ${
        theme === "light" ? "bg-tacticalLight text-tacticalInk" : "bg-void text-white"
      }`}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,245,255,.14),transparent_28%),radial-gradient(circle_at_75%_12%,rgba(255,0,64,.12),transparent_24%),linear-gradient(rgba(0,245,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,245,255,.06)_1px,transparent_1px)] bg-[size:100%_100%,100%_100%,52px_52px,52px_52px] animate-breathe" />
      <div className="pointer-events-none fixed inset-0 opacity-[.07] [background-image:url('data:image/svg+xml,%3Csvg_viewBox=%220_0_120_120%22_xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter_id=%22n%22%3E%3CfeTurbulence_type=%22fractalNoise%22_baseFrequency=%22.85%22_numOctaves=%222%22/%3E%3C/filter%3E%3Crect_width=%22120%22_height=%22120%22_filter=%22url(%23n)%22_opacity=%22.65%22/%3E%3C/svg%3E')]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-24 -translate-y-full bg-gradient-to-b from-transparent via-cyan/20 to-transparent animate-scan" />

      <div className="relative z-10 px-4 py-4 xl:pr-[330px]">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 border border-cyan/40 bg-cyan/10 px-3 py-2 font-display text-xs font-black uppercase text-cyan shadow-cyan">
              <Radar size={15} />
              Identity Threat Operations
            </div>
            <div className="mt-2 font-mono text-xs uppercase text-slate-400">{status}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={generateSamples} disabled={loading} className={commandButtonClass("amber")}>
              <DatabaseZap size={15} />
              Generate samples
            </button>
            <button type="button" onClick={runDetection} disabled={loading} className={commandButtonClass("cyan")}>
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <Activity size={15} />}
              Run detection
            </button>
            <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} />
          </div>
        </header>

        <div className="mb-4 animate-rise">
          <SignalIntercepts summary={summary} />
        </div>

        <div className={`${criticalPulse ? "shadow-crimson" : ""}`}>
          <ThreatGrid alerts={alerts} selectedId={selectedId} onSelect={setSelectedAlert} />
        </div>

        <div className="mt-4 grid gap-4 2xl:grid-cols-[1fr_.95fr]">
          <AlertsBriefingList alerts={alerts} selectedId={selectedId} onSelect={setSelectedAlert} />
          <ChartsPanel summary={summary} />
        </div>

        <div className="mt-4">
          <WorldMap alerts={alerts} onSelect={setSelectedAlert} />
        </div>

        <div className="mt-4 xl:hidden">
          <div className="border border-line bg-void/80 p-4 shadow-panel">
            <h2 className="font-display text-sm font-black uppercase text-white">Signal Intercept Tape</h2>
            <div className="mt-3 grid gap-2">
              {feed.slice(0, 6).map((alert) => (
                <button
                  key={alert.alert_id}
                  type="button"
                  onClick={() => setSelectedAlert(alert)}
                  className="border border-line bg-chrome/60 p-3 text-left font-mono text-xs text-cyan"
                >
                  {alert.severity} / {alert.user_email} / {alert.reasons?.[0]?.code || "identity_signal"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <InterceptTape feed={feed} onSelect={setSelectedAlert} />
      <MissionBriefing alert={selectedAlert} onClose={() => setSelectedAlert(null)} onUpdated={updateSelected} />
    </main>
  );
}

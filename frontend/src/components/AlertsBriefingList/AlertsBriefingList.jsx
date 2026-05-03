import React from "react";
import { useEffect, useMemo, useState } from "react";

import MissionBriefing from "../MissionBriefing/MissionBriefing.jsx";
import RiskChargeMeter from "../RiskChargeMeter/RiskChargeMeter.jsx";
import SeverityStamp from "../SeverityStamp/SeverityStamp.jsx";
import { formatDualTime } from "../../utils/formatters.js";

const ALERTS_URL = "http://localhost:8000/alerts";
const ALERTS_WS = "ws://localhost:8000/ws/alerts";

const severityTone = {
  critical: {
    dot: "bg-crimson shadow-crimson",
    risk: "text-crimson",
    row: "hover:border-crimson/60 hover:bg-crimson/5",
  },
  high: {
    dot: "bg-orange shadow-[0_0_18px_rgba(255,107,0,0.55)]",
    risk: "text-orange",
    row: "hover:border-orange/60 hover:bg-orange/5",
  },
  medium: {
    dot: "bg-amber shadow-[0_0_18px_rgba(255,184,0,0.48)]",
    risk: "text-amber",
    row: "hover:border-amber/60 hover:bg-amber/5",
  },
  low: {
    dot: "bg-cyan shadow-cyan",
    risk: "text-cyan",
    row: "hover:border-cyan/60 hover:bg-cyan/5",
  },
};

function normalize(value) {
  return String(value || "").toLowerCase();
}

function locationLabel(location = {}) {
  return [location.city, location.country].filter(Boolean).join(", ") || "Unknown location";
}

function parseTime(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function timeAgo(value) {
  const date = parseTime(value);
  if (!date) {
    return "unknown time";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

function DecodeText({ text, active }) {
  const [visible, setVisible] = useState(active ? "" : text);

  useEffect(() => {
    if (!active) {
      setVisible(text);
      return undefined;
    }

    let index = 0;
    const timer = window.setInterval(() => {
      index += 2;
      setVisible(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [active, text]);

  return <span>{visible}</span>;
}

function ConfidenceBars({ confidence = 0 }) {
  const bars = Math.ceil(Math.max(0, Math.min(1, Number(confidence) || 0)) * 5);

  return (
    <div className="flex items-end gap-1" title={`Confidence ${Math.round(confidence * 100)}%`}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <span
          key={bar}
          className={`w-1.5 border border-cyan/40 ${bar <= bars ? "bg-cyan shadow-cyan" : "bg-borderDefault"}`}
          style={{ height: 7 + bar * 4 }}
        />
      ))}
    </div>
  );
}

function useCountUp(value) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const target = Number(value || 0);
    const duration = 620;

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return display;
}

function MitreTags({ techniques = [] }) {
  if (!techniques.length) {
    return <span className="font-mono text-[11px] uppercase text-textMuted">MITRE: none</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {techniques.slice(0, 3).map((technique) => (
        <a
          key={technique.id}
          href={technique.url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="border border-cyan/35 bg-cyan/10 px-2 py-1 font-mono text-[10px] uppercase text-cyan transition hover:bg-cyan hover:text-black"
        >
          {technique.id}
        </a>
      ))}
    </div>
  );
}

function TriageChip({ status }) {
  const normalized = normalize(status || "open");
  const className =
    normalized === "confirmed"
      ? "border-crimson/60 bg-crimson/15 text-crimson"
      : normalized === "false_positive"
        ? "border-textMuted bg-card text-textMuted"
        : normalized === "investigating"
          ? "border-orange/60 bg-orange/15 text-orange"
          : normalized === "suppressed" || normalized === "duplicate"
            ? "border-textMuted bg-panel text-textMuted"
            : "border-cyan/50 bg-cyan/10 text-cyan";

  return <span className={`border px-2 py-1 font-mono text-[10px] uppercase ${className}`}>{normalized.replace("_", " ")}</span>;
}

function filterAlerts(alerts, filters) {
  const query = filters.search.trim().toLowerCase();
  const start = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
  const end = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;

  return alerts.filter((alert) => {
    const severity = normalize(alert.severity);
    const status = normalize(alert.triage_status);
    const current = alert.current_login_location || {};
    const previous = alert.previous_login_location || {};
    const alertDate = parseTime(alert.current_login_time || alert.created_at);

    if (filters.severity !== "all" && severity !== filters.severity) {
      return false;
    }
    if (filters.status !== "all" && status !== filters.status) {
      return false;
    }
    if (filters.country !== "all" && current.country !== filters.country) {
      return false;
    }
    if (start && alertDate && alertDate < start) {
      return false;
    }
    if (end && alertDate && alertDate > end) {
      return false;
    }
    if (!query) {
      return true;
    }

    const haystack = [
      alert.user_email,
      alert.alert_id,
      severity,
      status,
      current.city,
      current.country,
      previous.city,
      previous.country,
      ...(alert.reasons || []).map((reason) => `${reason.code} ${reason.detail}`),
      ...(alert.mitre_techniques || []).map((technique) => `${technique.id} ${technique.name}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function LoadingRows() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-20 animate-pulse border border-borderDefault bg-card/70" style={{ animationDelay: `${index * 80}ms` }} />
      ))}
    </div>
  );
}

function AlertsRow({ alert, isNew, onSelect }) {
  const severity = normalize(alert.severity || "low");
  const tone = severityTone[severity] || severityTone.low;
  const current = alert.current_login_location || {};
  const previous = alert.previous_login_location || {};
  const riskDisplay = useCountUp(alert.risk_score);
  const pulseClass = Number(alert.risk_score || 0) >= 90 ? "risk-pulse-red" : Number(alert.risk_score || 0) >= 70 ? "risk-pulse-amber" : "";

  const stopAction = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(alert)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(alert);
        }
      }}
      className={`group relative grid w-full grid-cols-[24px_minmax(190px,1.25fr)_120px_96px_84px_minmax(210px,1fr)_minmax(120px,.7fr)_120px_150px] items-center gap-4 border border-borderDefault bg-panel/88 px-4 py-3 text-left transition ${tone.row} ${
        isNew ? "decode-row-in" : ""
      }`}
    >
      <span className={`h-3.5 w-3.5 rounded-full ${tone.dot} ${severity === "critical" ? "severity-critical-pulse" : ""}`} />

      <span className="min-w-0">
        <span className="block truncate font-mono text-sm text-cyan">
          <DecodeText text={alert.user_email || "identity@nexuscorp.io"} active={isNew} />
        </span>
        <span className="mt-1 block truncate font-mono text-[11px] uppercase text-textMuted">{alert.alert_id}</span>
      </span>

      <SeverityStamp severity={severity} />

      <span className="flex items-center gap-2">
        <RiskChargeMeter score={alert.risk_score} severity={severity} size={44} />
        <span className={`font-orbitron text-2xl font-black ${tone.risk} ${pulseClass}`}>{Math.round(riskDisplay)}</span>
      </span>

      <ConfidenceBars confidence={alert.confidence} />

      <span className="min-w-0 font-mono text-xs text-textPrimary">
        <span className="block truncate text-textMuted">{locationLabel(previous)}</span>
        <span className="block truncate text-cyan">-&gt; {locationLabel(current)}</span>
      </span>

      <MitreTags techniques={alert.mitre_techniques} />

      <TriageChip status={alert.triage_status} />

      <span className="font-mono text-[10px] text-textMuted">
        <span className="block text-xs">{timeAgo(alert.current_login_time || alert.created_at)}</span>
        <span className="block">{formatDualTime(alert.current_login_time || alert.created_at)}</span>
      </span>

      <span className="absolute bottom-2 right-3 flex translate-y-2 gap-1 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
        {["INVESTIGATE", "FALSE POSITIVE", "CONFIRM"].map((action) => (
          <span
            key={action}
            role="button"
            tabIndex={-1}
            onClick={stopAction}
            className="border border-cyan/35 bg-void px-2 py-1 font-mono text-[10px] uppercase text-cyan shadow-cyan"
          >
            {action}
          </span>
        ))}
      </span>
    </div>
  );
}

export default function AlertsBriefingList() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [newAlertIds, setNewAlertIds] = useState(() => new Set());
  const [filters, setFilters] = useState({
    search: "",
    severity: "all",
    status: "all",
    country: "all",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadAlerts() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(ALERTS_URL, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`alerts request failed: ${response.status}`);
        }
        setAlerts(await response.json());
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("ALERT FEED OFFLINE");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
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
        setNewAlertIds((current) => new Set(current).add(incoming.alert_id));

        window.setTimeout(() => {
          setNewAlertIds((current) => {
            const next = new Set(current);
            next.delete(incoming.alert_id);
            return next;
          });
        }, 3600);
      } catch {
        setError("WEBSOCKET DECODE FAILURE");
      }
    };

    socket.onerror = () => setError("WEBSOCKET ALERT CHANNEL OFFLINE");
    return () => socket.close();
  }, []);

  const countries = useMemo(() => {
    const unique = new Set(alerts.map((alert) => alert.current_login_location?.country).filter(Boolean));
    return Array.from(unique).sort();
  }, [alerts]);

  const visibleAlerts = useMemo(() => filterAlerts(alerts, filters), [alerts, filters]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleAlertUpdated = (updatedAlert) => {
    setSelectedAlert(updatedAlert);
    setAlerts((current) => current.map((alert) => (alert.alert_id === updatedAlert.alert_id ? updatedAlert : alert)));
  };

  return (
    <section className="relative overflow-hidden border border-borderDefault bg-panel/76 shadow-panel">
      <div className="noise-layer" />

      <div className="relative z-10 border-b border-borderDefault p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-orbitron text-xl font-black uppercase text-textPrimary">Alerts Briefing List</h2>
            <div className={`mt-1 font-mono text-xs uppercase ${error ? "text-crimson" : "text-cyan"}`}>
              {error || `${visibleAlerts.length} visible / ${alerts.length} total`}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(240px,1.4fr)_160px_190px_190px_160px_160px]">
          <label className="flex h-11 items-center border border-borderDefault bg-void/80 px-3 focus-within:border-cyan">
            <span className="font-mono text-sm text-cyan">&gt;</span>
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="search identity, location, MITRE..."
              className="ml-2 min-w-0 flex-1 bg-transparent font-mono text-sm text-cyan outline-none placeholder:text-textMuted"
            />
          </label>

          <select value={filters.severity} onChange={(event) => updateFilter("severity", event.target.value)} className="h-11 border border-borderDefault bg-void px-3 font-mono text-xs uppercase text-textPrimary outline-none focus:border-cyan">
            <option value="all">All severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="h-11 border border-borderDefault bg-void px-3 font-mono text-xs uppercase text-textPrimary outline-none focus:border-cyan">
            <option value="all">All triage</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="confirmed">Confirmed</option>
            <option value="false_positive">False positive</option>
            <option value="suppressed">Suppressed</option>
            <option value="duplicate">Duplicate</option>
          </select>

          <select value={filters.country} onChange={(event) => updateFilter("country", event.target.value)} className="h-11 border border-borderDefault bg-void px-3 font-mono text-xs uppercase text-textPrimary outline-none focus:border-cyan">
            <option value="all">All countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => updateFilter("startDate", event.target.value)}
            className="h-11 border border-borderDefault bg-void px-3 font-mono text-xs uppercase text-textPrimary outline-none focus:border-cyan"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => updateFilter("endDate", event.target.value)}
            className="h-11 border border-borderDefault bg-void px-3 font-mono text-xs uppercase text-textPrimary outline-none focus:border-cyan"
          />
        </div>
      </div>

      <div className="relative z-10 overflow-x-auto p-4">
        <div className="min-w-[1270px]">
          <div className="grid grid-cols-[24px_minmax(190px,1.25fr)_120px_96px_84px_minmax(210px,1fr)_minmax(120px,.7fr)_120px_150px] gap-4 border-b border-borderDefault px-4 pb-3 font-mono text-[10px] uppercase text-textMuted">
            <span />
            <span>User</span>
            <span>Severity</span>
            <span>Risk</span>
            <span>Confidence</span>
            <span>Travel path</span>
            <span>MITRE</span>
            <span>Triage</span>
            <span>Age</span>
          </div>

          <div className="mt-3 grid gap-2">
            {loading ? (
              <LoadingRows />
            ) : visibleAlerts.length ? (
              visibleAlerts.map((alert) => (
                <AlertsRow key={alert.alert_id} alert={alert} isNew={newAlertIds.has(alert.alert_id)} onSelect={setSelectedAlert} />
              ))
            ) : (
              <div className="border border-borderDefault bg-card/60 p-8 text-center font-mono text-sm uppercase text-textMuted">
                No alerts match current filters
              </div>
            )}
          </div>
        </div>
      </div>

      <MissionBriefing alert={selectedAlert} onClose={() => setSelectedAlert(null)} onUpdated={handleAlertUpdated} />
    </section>
  );
}

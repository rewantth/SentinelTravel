import React from "react";
import { useEffect, useMemo, useState } from "react";

const SUMMARY_URL = "http://localhost:8000/dashboard/summary";
const LOGIN_EVENTS_URL = "http://localhost:8000/login-events?limit=5000";

const STAT_CONFIG = [
  {
    label: "TOTAL LOGINS",
    tone: "cyan",
    keys: ["total_logins", "totalLoginEvents", "login_events", "loginEvents", "total_events"],
  },
  {
    label: "ACTIVE ALERTS",
    tone: "amber",
    keys: ["active_alerts", "activeAlerts", "open_alerts", "openAlerts"],
  },
  {
    label: "CRITICAL ALERTS",
    tone: "crimson",
    keys: ["critical_alerts", "criticalAlerts"],
    glow: true,
  },
  {
    label: "AFFECTED USERS",
    tone: "orange",
    keys: ["affected_users", "affectedUsers"],
    derive: (summary) => summary?.top_users?.length || distinctUsers(summary?.recent_alerts),
  },
  {
    label: "DETECTION RATE",
    tone: "cyan",
    keys: ["detection_rate", "detectionRate"],
    suffix: "%",
    derive: (summary) => {
      const direct = pickNumber(summary, ["detection_rate", "detectionRate"]);
      if (direct !== null) {
        return direct <= 1 ? direct * 100 : direct;
      }

      const totalLogins = pickNumber(summary, ["total_logins", "totalLoginEvents", "login_events", "loginEvents", "total_events"]);
      const totalAlerts = pickNumber(summary, ["total_alerts", "totalAlerts"]);
      if (totalLogins && totalAlerts !== null) {
        return (totalAlerts / totalLogins) * 100;
      }

      const confidence = pickNumber(summary, ["average_confidence", "averageConfidence"]);
      return confidence !== null ? confidence * 100 : 0;
    },
  },
  {
    label: "CONFIRMED INCIDENTS",
    tone: "crimson",
    keys: ["confirmed_incidents", "confirmedIncidents", "confirmed_alerts", "confirmedAlerts"],
  },
  {
    label: "FALSE POSITIVES",
    tone: "muted",
    keys: ["false_positives", "falsePositives", "false_positive_alerts", "falsePositiveAlerts"],
  },
  {
    label: "SYSTEM CONFIDENCE",
    tone: "cyan",
    keys: ["average_confidence", "averageConfidence"],
    suffix: "%",
    confidencePanel: true,
    derive: (summary) => {
      const confidence = pickNumber(summary, ["average_confidence", "averageConfidence"]);
      return confidence !== null ? confidence * 100 : 0;
    },
  },
];

const toneStyles = {
  cyan: {
    border: "border-l-cyan",
    text: "text-cyan",
    glow: "shadow-cyan",
    svg: "#00F5FF",
  },
  amber: {
    border: "border-l-amber",
    text: "text-amber",
    glow: "shadow-[0_0_22px_rgba(255,184,0,0.28)]",
    svg: "#FFB800",
  },
  orange: {
    border: "border-l-orange",
    text: "text-orange",
    glow: "shadow-[0_0_22px_rgba(255,107,0,0.28)]",
    svg: "#FF6B00",
  },
  crimson: {
    border: "border-l-crimson",
    text: "text-crimson",
    glow: "shadow-crimson",
    svg: "#FF0040",
  },
  muted: {
    border: "border-l-textMuted",
    text: "text-textMuted",
    glow: "shadow-panel",
    svg: "#6B7A99",
  },
};

function distinctUsers(alerts = []) {
  return new Set(alerts.map((alert) => alert.user_email).filter(Boolean)).size;
}

function pickNumber(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function buildStats(summary) {
  return STAT_CONFIG.map((config) => {
    const direct = pickNumber(summary, config.keys);
    const value = config.confidencePanel ? (direct !== null ? direct * 100 : config.derive?.(summary) ?? 0) : direct ?? config.derive?.(summary) ?? 0;
    return {
      ...config,
      value: Number.isFinite(value) ? value : 0,
    };
  });
}

function useCountUp(value) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const target = Number(value || 0);
    const startedAt = performance.now();
    const duration = 900;

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

function formatValue(value, suffix) {
  if (suffix === "%") {
    return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
  }
  return Math.round(value).toLocaleString();
}

function SparkBars({ values, color }) {
  const max = Math.max(...values, 1);
  const width = 96;
  const height = 24;
  const gap = 3;
  const barWidth = (width - gap * (values.length - 1)) / values.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="micro sparkline bar graph" className="h-7 w-full">
      {values.map((value, index) => {
        const barHeight = Math.max(3, (value / max) * (height - 3));
        const x = index * (barWidth + gap);
        const y = height - barHeight;
        return (
          <rect
            key={`${value}-${index}`}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={color}
            opacity={0.38 + index / values.length / 1.8}
            rx="1"
          />
        );
      })}
    </svg>
  );
}

function confidenceColor(value) {
  if (value >= 90) {
    return "#22C55E";
  }
  if (value >= 75) {
    return "#00F5FF";
  }
  if (value >= 55) {
    return "#FFB800";
  }
  if (value >= 35) {
    return "#FF6B00";
  }
  return "#FF0040";
}

function sparkValuesFor(summary, stat, index) {
  const trend = summary?.risk_trend || summary?.riskTrend || [];
  const trendValues = trend
    .map((item) => item.count ?? item.avg_risk ?? item.value)
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  if (trendValues.length >= 6) {
    return trendValues.slice(-8);
  }

  const base = Math.max(1, Math.round(stat.value || 1));
  return Array.from({ length: 8 }, (_, offset) => {
    const wave = ((offset + 2) * (index + 3)) % 9;
    return Math.max(1, Math.round(base * (0.28 + wave / 12)));
  });
}

function LoadingPanel({ index }) {
  return (
    <div
      className="min-w-[190px] flex-1 animate-pulse border border-l-4 border-borderDefault border-l-borderDefault bg-card p-4 shadow-panel [clip-path:polygon(18px_0,100%_0,100%_100%,0_100%,0_18px)]"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="h-3 w-28 bg-borderDefault" />
      <div className="mt-5 h-9 w-20 bg-borderDefault" />
      <div className="mt-5 flex items-end gap-1">
        {Array.from({ length: 8 }, (_, barIndex) => (
          <div key={barIndex} className="w-full bg-borderDefault" style={{ height: 7 + ((barIndex + index) % 5) * 3 }} />
        ))}
      </div>
    </div>
  );
}

function StatPanel({ stat, summary, index }) {
  const styles = toneStyles[stat.tone];
  const animated = useCountUp(stat.value);
  const sparkValues = useMemo(() => sparkValuesFor(summary, stat, index), [summary, stat, index]);
  const activeColor = stat.confidencePanel ? confidenceColor(stat.value) : styles.svg;

  return (
    <section
      className={`relative min-w-[190px] flex-1 border border-l-4 border-borderDefault ${styles.border} bg-card p-4 ${
        stat.glow ? styles.glow : "shadow-panel"
      } [clip-path:polygon(18px_0,100%_0,100%_100%,0_100%,0_18px)]`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent" />
      <div className="relative z-10">
        <div className="font-mono text-[11px] font-semibold uppercase text-textMuted">{stat.label}</div>
        <div className={`mt-3 font-orbitron text-3xl font-black ${styles.text}`} style={stat.confidencePanel ? { color: activeColor } : undefined}>
          {formatValue(animated, stat.suffix)}
        </div>
        <div className="mt-4 border-t border-borderDefault/80 pt-3">
          {stat.confidencePanel ? (
            <div className="h-7 border border-borderDefault bg-void/70 p-1">
              <div className="h-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, animated))}%`, background: activeColor, boxShadow: `0 0 16px ${activeColor}` }} />
            </div>
          ) : (
            <SparkBars values={sparkValues} color={activeColor} />
          )}
        </div>
      </div>
    </section>
  );
}

export default function SignalIntercepts() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(SUMMARY_URL, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`summary request failed: ${response.status}`);
        }
        const summaryPayload = await response.json();
        const eventsResponse = await fetch(LOGIN_EVENTS_URL, { signal: controller.signal });
        if (eventsResponse.ok) {
          const events = await eventsResponse.json();
          setSummary({ ...summaryPayload, total_logins: Array.isArray(events) ? events.length : summaryPayload.total_logins });
        } else {
          setSummary(summaryPayload);
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("SUMMARY FEED OFFLINE");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSummary();
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => buildStats(summary), [summary]);

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-orbitron text-sm font-black uppercase text-textPrimary">Signal Intercepts</h2>
        <div className={`font-mono text-xs uppercase ${error ? "text-crimson" : "text-cyan"}`}>
          {error || "SUMMARY FEED LOCKED"}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {loading
          ? Array.from({ length: 8 }, (_, index) => <LoadingPanel key={index} index={index} />)
          : stats.map((stat, index) => <StatPanel key={stat.label} stat={stat} summary={summary} index={index} />)}
      </div>
    </section>
  );
}

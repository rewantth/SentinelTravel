import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ALERTS_URL = "http://localhost:8000/alerts";
const SUMMARY_URL = "http://localhost:8000/dashboard/summary";
const LOGIN_EVENTS_URL = "http://localhost:8000/login-events?limit=5000";

const severityColors = {
  critical: "#FF0040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "#00F5FF",
  open: "#00F5FF",
  investigating: "#FFB800",
  confirmed: "#FF0040",
  false_positive: "#6B7A99",
  suppressed: "#6B7A99",
  duplicate: "#243044",
};

function normalize(value) {
  return String(value || "unknown").toLowerCase();
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item) || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toChartRows(counts, keyName = "label") {
  return Object.entries(counts)
    .map(([label, value]) => ({ [keyName]: label, value }))
    .sort((a, b) => b.value - a.value);
}

function TerminalTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  const displayLabel = label || payload[0]?.name || payload[0]?.payload?.status || payload[0]?.payload?.country || "SIGNAL";

  return (
    <div className="border border-cyan/50 bg-void px-3 py-2 font-mono text-xs text-cyan shadow-cyan">
      <div>{">"} {displayLabel}</div>
      {payload.map((item) => (
        <div key={item.dataKey || item.name} className="text-textPrimary">
          {">"} {item.name || item.dataKey}: {item.value}
        </div>
      ))}
    </div>
  );
}

function ChartShell({ title, children }) {
  return (
    <section className="min-h-[330px] bg-panel/72 p-4 shadow-panel">
      <h3 className="font-orbitron text-sm font-black uppercase text-textPrimary">{title}</h3>
      <div className="mt-4 h-[260px]">{children}</div>
    </section>
  );
}

export default function ChartsPanel() {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loginEvents, setLoginEvents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        setError("");
        const [alertsResponse, summaryResponse, loginResponse] = await Promise.all([
          fetch(ALERTS_URL, { signal: controller.signal }),
          fetch(SUMMARY_URL, { signal: controller.signal }),
          fetch(LOGIN_EVENTS_URL, { signal: controller.signal }),
        ]);

        if (!alertsResponse.ok || !summaryResponse.ok || !loginResponse.ok) {
          throw new Error("analytics request failed");
        }

        setAlerts(await alertsResponse.json());
        setSummary(await summaryResponse.json());
        setLoginEvents(await loginResponse.json());
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("ANALYTICS FEED OFFLINE");
        }
      }
    }

    loadData();
    return () => controller.abort();
  }, []);

  const datasets = useMemo(() => {
    const severityRows = ["critical", "high", "medium", "low"].map((severity) => ({
      severity,
      value: alerts.filter((alert) => normalize(alert.severity) === severity).length,
    }));

    const countryRows = toChartRows(countBy(loginEvents, (event) => event.country), "country").slice(0, 8);

    const riskBuckets = [
      { bucket: "0-29", value: alerts.filter((alert) => alert.risk_score < 30).length },
      { bucket: "30-59", value: alerts.filter((alert) => alert.risk_score >= 30 && alert.risk_score < 60).length },
      { bucket: "60-79", value: alerts.filter((alert) => alert.risk_score >= 60 && alert.risk_score < 80).length },
      { bucket: "80-100", value: alerts.filter((alert) => alert.risk_score >= 80).length },
    ];

    const overTime =
      summary?.risk_trend?.length
        ? summary.risk_trend.map((item) => ({ date: item.date, value: item.count }))
        : toChartRows(
            countBy(alerts, (alert) => String(alert.current_login_time || alert.created_at || "").slice(0, 10)),
            "date",
          ).sort((a, b) => a.date.localeCompare(b.date));

    const triageRows = toChartRows(countBy(alerts, (alert) => normalize(alert.triage_status)), "status");

    return { severityRows, countryRows, riskBuckets, overTime, triageRows };
  }, [alerts, loginEvents, summary]);

  return (
    <section className="border border-borderDefault bg-void/60 p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-orbitron text-xl font-black uppercase text-textPrimary">Charts Panel</h2>
          <div className={`mt-1 font-mono text-xs uppercase ${error ? "text-crimson" : "text-cyan"}`}>
            {error || "THREAT ANALYTICS ONLINE"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartShell title="Alerts by Severity">
          <ResponsiveContainer>
            <BarChart data={datasets.severityRows} layout="vertical">
              <CartesianGrid stroke="rgba(36,48,68,.55)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#6B7A99", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="severity" tick={{ fill: "#E0E6F0", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<TerminalTooltip />} cursor={{ fill: "rgba(0,245,255,.06)" }} />
              <Bar dataKey="value" isAnimationActive animationDuration={900}>
                {datasets.severityRows.map((row) => (
                  <Cell key={row.severity} fill={severityColors[row.severity]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title="Logins by Country">
          <ResponsiveContainer>
            <BarChart data={datasets.countryRows} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="rgba(36,48,68,.55)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#6B7A99", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="country" tick={{ fill: "#E0E6F0", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} width={116} />
              <Tooltip content={<TerminalTooltip />} cursor={{ fill: "rgba(0,245,255,.06)" }} />
              <Bar dataKey="value" fill="#00F5FF" isAnimationActive animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title="Risk Score Distribution">
          <ResponsiveContainer>
            <AreaChart data={datasets.riskBuckets}>
              <defs>
                <linearGradient id="riskGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.72} />
                  <stop offset="95%" stopColor="#00F5FF" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(36,48,68,.55)" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fill: "#6B7A99", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6B7A99", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TerminalTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#00F5FF" strokeWidth={3} fill="url(#riskGradient)" isAnimationActive animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title="Alerts Over Time">
          <ResponsiveContainer>
            <LineChart data={datasets.overTime}>
              <CartesianGrid stroke="rgba(36,48,68,.55)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#6B7A99", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6B7A99", fontFamily: "JetBrains Mono", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TerminalTooltip />} />
              <Line type="monotone" dataKey="value" stroke="#FFB800" strokeWidth={3} dot={{ r: 4, fill: "#020408", stroke: "#FFB800", strokeWidth: 2 }} isAnimationActive animationDuration={900} />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title="Triage Status Distribution">
          <ResponsiveContainer>
            <PieChart>
              <Tooltip content={<TerminalTooltip />} />
              <Pie data={datasets.triageRows} dataKey="value" nameKey="status" innerRadius={56} outerRadius={102} paddingAngle={2} isAnimationActive animationDuration={900}>
                {datasets.triageRows.map((row) => (
                  <Cell key={row.status} fill={severityColors[row.status] || "#00F5FF"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>
    </section>
  );
}

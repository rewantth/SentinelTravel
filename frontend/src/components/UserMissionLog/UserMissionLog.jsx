import React from "react";
import { useEffect, useMemo, useState } from "react";

import { formatDualTime } from "../../utils/formatters.js";

const LOGIN_EVENTS_URL = "http://localhost:8000/login-events?limit=5000";
const API_BASE = "http://localhost:8000";

function formatTimestamp(value) {
  return value ? formatDualTime(value) : "unknown time";
}

function eventFlags(event, previousEvent) {
  const mfaStatus = event.details?.mfa_status || "";
  return {
    failedLogin: event.kind === "login" && event.status === "failed",
    successLogin: event.kind === "login" && event.status === "success",
    countryChange: Boolean(previousEvent?.country && event.country && previousEvent.country !== event.country),
    deviceChange: Boolean(previousEvent?.device && event.device && previousEvent.device !== event.device),
    mfaFailure: mfaStatus === "failed" || mfaStatus === "not_completed",
    suspicious: event.kind === "alert" || event.details?.risk_score >= 60,
  };
}

function TimelineMarker({ flags }) {
  if (flags.failedLogin) {
    return <span className="grid h-6 w-6 place-items-center rounded-full bg-crimson font-mono text-xs font-black text-white shadow-crimson">X</span>;
  }
  if (flags.mfaFailure) {
    return <span className="h-5 w-5 rounded-full bg-crimson shadow-crimson severity-critical-pulse" />;
  }
  if (flags.successLogin) {
    return <span className="h-5 w-5 rounded-full bg-cyan shadow-cyan" />;
  }
  return <span className="h-5 w-5 rounded-full bg-amber shadow-[0_0_18px_rgba(255,184,0,.45)]" />;
}

function IndicatorStrip({ flags }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase">
      {flags.countryChange && <span className="border border-amber/50 bg-amber/10 px-2 py-1 text-amber">Country branch</span>}
      {flags.deviceChange && <span className="border border-orange/50 bg-orange/10 px-2 py-1 text-orange">Device change</span>}
      {flags.mfaFailure && <span className="border border-crimson/50 bg-crimson/10 px-2 py-1 text-crimson">MFA failure</span>}
      {flags.suspicious && <span className="border border-amber/50 bg-amber/10 px-2 py-1 text-amber">Suspicious</span>}
    </div>
  );
}

export default function UserMissionLog() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadUsers() {
      try {
        setError("");
        const response = await fetch(LOGIN_EVENTS_URL, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`users request failed: ${response.status}`);
        }
        const events = await response.json();
        const uniqueUsers = Array.from(new Set(events.map((event) => event.user_email).filter(Boolean))).sort();
        setUsers(uniqueUsers);
        setSelectedUser((current) => current || uniqueUsers[0] || "");
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("USER INDEX OFFLINE");
        }
      }
    }

    loadUsers();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedUser) {
      return undefined;
    }

    const controller = new AbortController();

    async function loadTimeline() {
      try {
        setError("");
        const response = await fetch(`${API_BASE}/users/${encodeURIComponent(selectedUser)}/timeline`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`timeline request failed: ${response.status}`);
        }
        setTimeline(await response.json());
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("MISSION LOG OFFLINE");
        }
      }
    }

    loadTimeline();
    return () => controller.abort();
  }, [selectedUser]);

  const enrichedTimeline = useMemo(
    () =>
      timeline.map((event, index) => ({
        event,
        flags: eventFlags(event, timeline[index - 1]),
      })),
    [timeline],
  );

  return (
    <section className="border border-borderDefault bg-panel/76 p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borderDefault pb-4">
        <div>
          <h2 className="font-orbitron text-xl font-black uppercase text-textPrimary">User Mission Log</h2>
          <div className={`mt-1 font-mono text-xs uppercase ${error ? "text-crimson" : "text-cyan"}`}>
            {error || `${timeline.length} timeline events`}
          </div>
        </div>

        <select
          value={selectedUser}
          onChange={(event) => setSelectedUser(event.target.value)}
          className="h-11 min-w-[260px] border border-cyan/45 bg-void px-3 font-mono text-sm text-cyan outline-none focus:border-cyan"
        >
          {users.map((email) => (
            <option key={email} value={email}>
              {email}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 max-h-[calc(100vh-300px)] overflow-auto pr-2">
        {enrichedTimeline.map(({ event, flags }, index) => (
          <article key={`${event.kind}-${event.timestamp}-${index}`} className="relative grid grid-cols-[38px_minmax(0,1fr)] gap-4 pb-6 font-mono">
            {index !== enrichedTimeline.length - 1 && <div className="absolute left-[11px] top-7 h-full w-px bg-borderDefault" />}
            <div className="relative z-10 pt-1">
              <TimelineMarker flags={flags} />
            </div>
            <div className={`border bg-void/70 p-4 ${flags.suspicious ? "border-amber/70 mission-log-blink" : "border-borderDefault"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-orbitron text-sm font-black uppercase text-textPrimary">{event.title}</div>
                <div className="text-xs text-textMuted">{formatTimestamp(event.timestamp)}</div>
              </div>
              <div className="mt-2 text-sm text-cyan">
                {[event.city, event.country, event.device].filter(Boolean).join(" / ") || "No location context"}
              </div>
              <IndicatorStrip flags={flags} />
            </div>
          </article>
        ))}

        {!timeline.length && <div className="border border-borderDefault bg-card/60 p-8 text-center font-mono text-sm uppercase text-textMuted">No mission events loaded</div>}
      </div>
    </section>
  );
}

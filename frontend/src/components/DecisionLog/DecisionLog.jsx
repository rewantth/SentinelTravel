import React from "react";
import { useEffect, useState } from "react";

import { formatDualTime } from "../../utils/formatters.js";

const STORAGE_KEY = "sentineltravel.decisionLog";

function loadEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function recordDecision(action, identity = "unknown", details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    analyst: "SOC-OPERATOR-01",
    action,
    identity,
    details,
  };
  window.dispatchEvent(new CustomEvent("sentinel:decision-log", { detail: entry }));
  return entry;
}

export default function DecisionLog() {
  const [entries, setEntries] = useState(loadEntries);

  useEffect(() => {
    const onDecision = (event) => {
      const entry = event.detail;
      setEntries((current) => {
        const next = [entry, ...current].slice(0, 40);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener("sentinel:decision-log", onDecision);
    return () => window.removeEventListener("sentinel:decision-log", onDecision);
  }, []);

  return (
    <section className="fixed bottom-8 left-0 right-[280px] z-30 hidden h-24 border-t border-cyan/35 bg-panel/92 shadow-panel backdrop-blur-xl xl:block">
      <div className="grid h-full grid-cols-[180px_1fr]">
        <div className="border-r border-borderDefault p-3">
          <div className="font-orbitron text-xs font-black uppercase text-cyan">Decision Log</div>
          <div className="mt-2 font-mono text-[10px] uppercase text-textMuted">{entries.length} session entries</div>
        </div>
        <div className="overflow-hidden px-3 py-2 font-mono text-[11px] uppercase">
          {entries.length ? (
            <div className="grid gap-1">
              {entries.slice(0, 4).map((entry) => (
                <div key={entry.id} className="flex gap-3 text-textPrimary">
                  <span className="text-textMuted">{formatDualTime(entry.timestamp)}</span>
                  <span className="text-cyan">{entry.analyst}</span>
                  <span className="text-amber">{entry.action}</span>
                  <span className="truncate text-textMuted">{entry.identity}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="pt-6 text-textMuted">Awaiting analyst decisions</div>
          )}
        </div>
      </div>
    </section>
  );
}

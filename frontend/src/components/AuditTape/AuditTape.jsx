import React from "react";
import { useEffect, useState } from "react";

import { formatDualTime } from "../../utils/formatters.js";

const API_BASE = "http://localhost:8000";

function formatTimestamp(value) {
  return value ? formatDualTime(value) : "unknown time";
}

export default function AuditTape({ alertId, refreshKey = 0 }) {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!alertId) {
      return undefined;
    }

    const controller = new AbortController();

    async function loadLogs() {
      try {
        setError("");
        const response = await fetch(`${API_BASE}/alerts/${alertId}/audit-logs`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`audit request failed: ${response.status}`);
        }
        setLogs(await response.json());
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("AUDIT TAPE OFFLINE");
        }
      }
    }

    loadLogs();
    return () => controller.abort();
  }, [alertId, refreshKey]);

  return (
    <section className="border border-borderDefault bg-panel/82 shadow-panel">
      <div className="border-b border-borderDefault px-4 py-3">
        <h3 className="font-orbitron text-xs font-black uppercase text-textPrimary">Audit Tape</h3>
        {error && <div className="mt-1 font-mono text-xs text-crimson">{error}</div>}
      </div>

      <div className="max-h-52 overflow-auto px-4 py-3">
        {logs.length ? (
          logs.map((log) => (
            <article key={log.id} className="mb-3 border-l-2 border-amber/60 pl-3 font-mono text-xs">
              <div className="text-amber">{formatTimestamp(log.timestamp)}</div>
              <div className="mt-1 uppercase text-textPrimary">
                {log.actor} / {log.action}
              </div>
              <div className="mt-1 break-words text-textMuted">{JSON.stringify(log.new_value || log.old_value || {})}</div>
            </article>
          ))
        ) : (
          <div className="font-mono text-xs uppercase text-textMuted">No audit events recorded</div>
        )}
      </div>
    </section>
  );
}

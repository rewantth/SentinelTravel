import React from "react";
import { useEffect, useMemo, useState } from "react";

function formatSession(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export default function AnalystIdentity() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sessionLabel = useMemo(() => formatSession(elapsed), [elapsed]);

  return (
    <div className="hidden border border-borderDefault bg-panel px-3 py-2 font-mono text-[10px] uppercase leading-4 text-textMuted 2xl:block">
      <div>
        ANALYST: <span className="text-cyan">SOC-OPERATOR-01</span>
      </div>
      <div>
        SESSION: <span className="text-textPrimary">{sessionLabel}</span>
      </div>
      <div>
        CLEARANCE: <span className="text-amber">LEVEL 3</span>
      </div>
    </div>
  );
}

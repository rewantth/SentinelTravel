import React from "react";
import { useEffect, useMemo, useState } from "react";

const BOOT_LINES = [
  "> SENTINELTRAVEL THREAT INTELLIGENCE PLATFORM v2.4.1",
  "> INITIALIZING NEURAL DETECTION ENGINE...........OK",
  "> LOADING USER BASELINE PROFILES................OK",
  "> CONNECTING TO THREAT FEED.....................OK",
  "> CALIBRATING HAVERSINE ENGINE.................OK",
  "> ESTABLISHING SECURE WEBSOCKET................OK",
  "> SYSTEM READY. THREAT LEVEL: ELEVATED",
];

export default function BootSequence({ onComplete }) {
  const [visibleChars, setVisibleChars] = useState(0);
  const [exiting, setExiting] = useState(false);
  const fullText = useMemo(() => BOOT_LINES.join("\n"), []);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const duration = 3000;

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setVisibleChars(Math.floor(progress * fullText.length));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setExiting(true);
        window.setTimeout(onComplete, 420);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [fullText.length, onComplete]);

  useEffect(() => {
    const skip = () => {
      setExiting(true);
      window.setTimeout(onComplete, 180);
    };
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [onComplete]);

  const lines = fullText.slice(0, visibleChars).split("\n");

  return (
    <div className={`fixed inset-0 z-[90] grid place-items-center bg-void transition duration-500 ${exiting ? "opacity-0" : "opacity-100"}`}>
      <div className="scanline-grid" />
      <div className="noise-layer" />
      <div className="relative w-[92vw] max-w-4xl border border-cyan/35 bg-panel/82 p-6 shadow-cyan backdrop-blur-xl sm:p-10">
        <div className="mb-5 flex items-center justify-between border-b border-borderDefault pb-3 font-mono text-xs uppercase text-textMuted">
          <span>NexusCorp secure console</span>
          <span>PRESS ANY KEY TO SKIP</span>
        </div>
        <pre className="min-h-[288px] whitespace-pre-wrap font-mono text-sm leading-7 text-cyan sm:text-base">
          {lines.join("\n")}
          <span className="ml-1 inline-block h-5 w-2 translate-y-1 bg-cyan boot-cursor" />
        </pre>
      </div>
    </div>
  );
}

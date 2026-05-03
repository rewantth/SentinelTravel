const statusColor = {
  success: "bg-cyan shadow-cyan",
  failed: "bg-crimson shadow-crimson",
  open: "bg-amber shadow-amber",
  investigating: "bg-orange",
  confirmed: "bg-crimson shadow-crimson",
  false_positive: "bg-slate-500",
  suppressed: "bg-slate-500",
  duplicate: "bg-slate-500",
};

export default function UserMissionLog({ timeline = [] }) {
  return (
    <section className="border border-line bg-void/70 shadow-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-sm font-black uppercase text-white">User Mission Log</h2>
        <p className="mt-1 font-mono text-xs text-slate-400">Login and alert sequence for selected identity</p>
      </div>
      <div className="max-h-[360px] overflow-auto px-5 py-4">
        {!timeline.length && <div className="font-mono text-xs uppercase text-slate-500">Awaiting identity telemetry</div>}
        {timeline.map((item, index) => (
          <div key={`${item.kind}-${item.timestamp}-${index}`} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-5">
            {index !== timeline.length - 1 && <div className="absolute left-[9px] top-5 h-full w-px bg-line" />}
            <div className={`relative z-10 mt-1 grid h-5 w-5 place-items-center rounded-full ${statusColor[item.status] || "bg-cyan"}`}>
              {item.status === "failed" && <span className="font-mono text-[10px] font-bold text-white">X</span>}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm uppercase text-white">{item.title}</span>
                {item.kind === "alert" && <span className="animate-flicker font-mono text-xs uppercase text-amber">anomaly</span>}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</div>
              <div className="mt-1 font-mono text-xs text-cyan">
                {[item.city, item.country, item.device].filter(Boolean).join(" / ")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

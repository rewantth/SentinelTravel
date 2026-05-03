export default function AuditTape({ logs = [] }) {
  return (
    <section className="border border-line bg-void/70 shadow-panel">
      <div className="border-b border-line px-4 py-3">
        <h3 className="font-display text-xs font-black uppercase text-white">Audit Tape</h3>
      </div>
      <div className="max-h-48 overflow-auto px-4 py-3">
        {!logs.length && <div className="font-mono text-xs uppercase text-slate-600">No audit events recorded</div>}
        {logs.map((log) => (
          <div key={log.id} className="mb-3 border-l-2 border-cyan/50 pl-3 font-mono text-xs">
            <div className="text-cyan">{new Date(log.timestamp).toLocaleString()}</div>
            <div className="mt-1 text-white">
              {log.actor} / {log.action}
            </div>
            <div className="mt-1 text-slate-400">{JSON.stringify(log.new_value || log.old_value || {})}</div>
          </div>
        ))}
      </div>
    </section>
  );
}


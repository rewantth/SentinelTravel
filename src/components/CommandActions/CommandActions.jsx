import { CheckCircle2, CircleSlash, Loader2, ShieldAlert } from "lucide-react";

const triageOptions = [
  { status: "investigating", label: "> INVESTIGATE", icon: Loader2 },
  { status: "confirmed", label: "> CONFIRM", icon: ShieldAlert },
  { status: "false_positive", label: "> FALSE POSITIVE", icon: CircleSlash },
  { status: "open", label: "> REOPEN", icon: CheckCircle2 },
];

export default function CommandActions({ actions = [], currentStatus, onTriage }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-xs font-black uppercase text-white">Recommended Commands</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {actions.map((action) => (
            <button
              key={action.code}
              type="button"
              title={action.description}
              className="border border-cyan/35 bg-cyan/10 px-3 py-3 text-left font-mono text-xs uppercase text-cyan shadow-cyan transition hover:bg-cyan hover:text-black"
            >
              {">"} {action.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-display text-xs font-black uppercase text-white">Triage State</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {triageOptions.map(({ status, label, icon: Icon }) => (
            <button
              key={status}
              type="button"
              disabled={status === currentStatus}
              onClick={() => onTriage(status)}
              className={`inline-flex items-center gap-2 border px-3 py-2 font-mono text-xs uppercase transition ${
                status === currentStatus
                  ? "border-line bg-line text-slate-400"
                  : "border-amber/50 bg-amber/10 text-amber hover:bg-amber hover:text-black"
              }`}
            >
              <Icon size={14} className={status === "investigating" && status !== currentStatus ? "animate-spin" : ""} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


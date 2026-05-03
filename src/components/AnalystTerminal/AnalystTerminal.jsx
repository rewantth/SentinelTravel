import { useState } from "react";
import { SendHorizontal } from "lucide-react";

export default function AnalystTerminal({ notes = [], onAddNote }) {
  const [note, setNote] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!note.trim()) {
      return;
    }
    await onAddNote(note.trim());
    setNote("");
  };

  return (
    <section className="border border-line bg-black/70 p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xs font-black uppercase text-white">Analyst Terminal</h3>
        <span className="h-3 w-2 animate-cursorBlink bg-cyan" />
      </div>
      <form onSubmit={submit} className="mt-3">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="> append analyst note..."
          className="h-28 w-full resize-none border border-cyan/25 bg-void p-3 font-mono text-sm text-cyan outline-none transition placeholder:text-slate-600 focus:border-cyan focus:shadow-cyan"
        />
        <button
          type="submit"
          className="mt-2 inline-flex items-center gap-2 border border-cyan bg-cyan px-3 py-2 font-mono text-xs uppercase text-black transition hover:bg-white"
        >
          <SendHorizontal size={14} />
          Commit note
        </button>
      </form>
      <div className="mt-4 max-h-40 overflow-auto border-t border-line pt-3">
        {notes.map((item) => (
          <div key={item.id} className="mb-3 font-mono text-xs text-slate-300">
            <div className="text-cyan">
              {">"} {item.analyst_name} // {new Date(item.created_at).toLocaleString()}
            </div>
            <div className="mt-1 text-slate-200">{item.note}</div>
          </div>
        ))}
        {!notes.length && <div className="font-mono text-xs uppercase text-slate-600">No notes committed</div>}
      </div>
    </section>
  );
}


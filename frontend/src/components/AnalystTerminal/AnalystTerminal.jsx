import React from "react";
import { useEffect, useState } from "react";

import { formatDualTime } from "../../utils/formatters.js";

const API_BASE = "http://localhost:8000";

function formatTimestamp(value) {
  return value ? formatDualTime(value) : "unknown time";
}

export default function AnalystTerminal({ alertId, onNoteAdded }) {
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadNotes(signal) {
    if (!alertId) {
      return;
    }

    try {
      setError("");
      const response = await fetch(`${API_BASE}/alerts/${alertId}/notes`, { signal });
      if (!response.ok) {
        throw new Error(`notes request failed: ${response.status}`);
      }
      setNotes(await response.json());
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError("NOTES CHANNEL OFFLINE");
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadNotes(controller.signal);
    return () => controller.abort();
  }, [alertId]);

  const submitNote = async (event) => {
    event.preventDefault();
    const cleanNote = note.trim();
    if (!cleanNote || !alertId) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE}/alerts/${alertId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyst_name: "SOC-OPERATOR-01",
          note: cleanNote,
        }),
      });
      if (!response.ok) {
        throw new Error(`note submit failed: ${response.status}`);
      }
      setNote("");
      await loadNotes();
      onNoteAdded?.();
    } catch {
      setError("NOTE COMMIT FAILED");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="border border-borderDefault bg-black/70 p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <h3 className="font-orbitron text-xs font-black uppercase text-textPrimary">Analyst Terminal</h3>
        <span className="h-4 w-2 animate-[cursor-blink_1s_step-end_infinite] bg-cyan" />
      </div>

      <form onSubmit={submitNote} className="mt-3">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="> append analyst note..."
          className="h-28 w-full resize-none border border-cyan/25 bg-void p-3 font-mono text-sm text-cyan outline-none placeholder:text-textMuted focus:border-cyan focus:shadow-cyan"
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-2 border border-cyan bg-cyan px-3 py-2 font-mono text-xs uppercase text-black transition hover:bg-textPrimary disabled:opacity-50"
        >
          {loading ? "> COMMITTING" : "> SUBMIT NOTE"}
        </button>
      </form>

      {error && <div className="mt-3 border border-crimson/50 bg-crimson/10 p-2 font-mono text-xs text-crimson">{error}</div>}

      <div className="mt-4 max-h-48 overflow-auto border-t border-borderDefault pt-3">
        {notes.length ? (
          notes.map((item) => (
            <article key={item.id} className="mb-3 border-l-2 border-cyan/50 pl-3 font-mono text-xs">
              <div className="text-cyan">
                {">"} {item.analyst_name} / {formatTimestamp(item.created_at)}
              </div>
              <div className="mt-1 text-textPrimary">{item.note}</div>
            </article>
          ))
        ) : (
          <div className="font-mono text-xs uppercase text-textMuted">No analyst notes recorded</div>
        )}
      </div>
    </section>
  );
}

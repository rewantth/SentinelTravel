export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_BASE = API_BASE.replace(/^http/, "ws");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export const api = {
  alerts: () => request("/alerts?include_suppressed=true&limit=250"),
  alert: (id) => request(`/alerts/${id}`),
  summary: () => request("/dashboard/summary"),
  timeline: (email) => request(`/users/${encodeURIComponent(email)}/timeline`),
  runDetection: () => request("/run-detection", { method: "POST" }),
  generateSampleData: () => request("/generate-sample-data", { method: "POST" }),
  triage: (id, status, actor = "analyst") =>
    request(`/alerts/${id}/triage`, {
      method: "PATCH",
      body: JSON.stringify({ status, actor }),
    }),
  notes: (id) => request(`/alerts/${id}/notes`),
  addNote: (id, note, analyst_name = "analyst") =>
    request(`/alerts/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ analyst_name, note }),
    }),
  audit: (id) => request(`/alerts/${id}/audit-logs`),
};


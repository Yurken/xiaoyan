/**
 * API client — thin wrapper around fetch pointing to the backend.
 * The Next.js rewrite rule proxies /api/* to the backend, so no CORS issues.
 */

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Planner ──────────────────────────────────────────────────────
export const plannerApi = {
  generate: (topic: string, keywords: string[]) =>
    request("/planner/generate", {
      method: "POST",
      body: JSON.stringify({ topic, keywords }),
    }),
};

// ── Survey ───────────────────────────────────────────────────────
export const surveyApi = {
  generate: (query: string, max_papers = 20) =>
    request("/survey/generate", {
      method: "POST",
      body: JSON.stringify({ query, max_papers }),
    }),
  search: (query: string, limit = 20) =>
    request(`/survey/search?query=${encodeURIComponent(query)}&limit=${limit}`),
};

// ── Papers ───────────────────────────────────────────────────────
export const papersApi = {
  list: (offset = 0, limit = 20) =>
    request(`/papers?offset=${offset}&limit=${limit}`),
  get: (id: string) => request(`/papers/${id}`),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/papers/upload`, { method: "POST", body: form }).then(
      (r) => {
        if (!r.ok) return r.text().then((t) => Promise.reject(new Error(t)));
        return r.json();
      }
    );
  },
  analyze: (id: string) =>
    request(`/papers/${id}/analyze`, { method: "POST" }),
  reproduce: (id: string) =>
    request(`/papers/${id}/reproduce`, { method: "POST" }),
  delete: (id: string) =>
    request(`/papers/${id}`, { method: "DELETE" }),
};

// ── Knowledge ────────────────────────────────────────────────────
export const knowledgeApi = {
  listInterests: () => request("/knowledge/interests"),
  createInterest: (topic: string, keywords: string[]) =>
    request("/knowledge/interests", {
      method: "POST",
      body: JSON.stringify({ topic, keywords }),
    }),
  generatePlan: (id: string) =>
    request(`/knowledge/interests/${id}/plan`, { method: "POST" }),
  listNotes: (search?: string) =>
    request(`/knowledge/notes${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createNote: (data: {
    title: string;
    content: string;
    tags?: string[];
    research_interest_id?: string;
  }) => request("/knowledge/notes", { method: "POST", body: JSON.stringify(data) }),
  updateNote: (id: string, data: { title?: string; content?: string; tags?: string[] }) =>
    request(`/knowledge/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNote: (id: string) =>
    request(`/knowledge/notes/${id}`, { method: "DELETE" }),
  search: (q: string, top_k = 5) =>
    request(`/knowledge/search?q=${encodeURIComponent(q)}&top_k=${top_k}`),
};

// ── Chat ─────────────────────────────────────────────────────────
export const chatApi = {
  listSessions: () => request("/chat/sessions"),
  getSession: (id: string) => request(`/chat/sessions/${id}`),
  deleteSession: (id: string) =>
    request(`/chat/sessions/${id}`, { method: "DELETE" }),
  send: (data: {
    session_id?: string;
    message: string;
    context_type?: string;
    context_id?: string;
  }) => request("/chat/send", { method: "POST", body: JSON.stringify(data) }),
};

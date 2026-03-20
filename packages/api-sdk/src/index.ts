import type {
  Paper,
  ChatSession,
  ChatMessage,
  ResearchInterest,
  KnowledgeNote,
  Job,
  AppSettings,
} from "@research-copilot/types";

export interface ClientConfig {
  baseURL: string;
  getToken?: () => string | null;
}

async function request<T>(config: ClientConfig, path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (config.getToken) {
    const token = config.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${config.baseURL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Stream helper ────────────────────────────────────────────────
export async function* streamChat(
  config: ClientConfig,
  body: {
    session_id?: string;
    message: string;
    context_type?: string;
    context_id?: string;
  }
): AsyncGenerator<{ type: "session_id"; value: string } | { type: "delta"; value: string } | { type: "done" }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.getToken) {
    const token = config.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${config.baseURL}/api/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(line.slice(6));
        if (json.session_id) yield { type: "session_id", value: json.session_id };
        else if (json.delta) yield { type: "delta", value: json.delta.replace(/\\n/g, "\n") };
        else if (json.done) yield { type: "done" };
      } catch {}
    }
  }
}

// ── Job polling helper ───────────────────────────────────────────
export async function* pollJob(
  config: ClientConfig,
  jobId: string,
  intervalMs = 1500
): AsyncGenerator<Job> {
  while (true) {
    const job = await request<Job>(config, `/api/jobs/${jobId}`);
    yield job;
    if (job.status === "done" || job.status === "failed") break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// ── API factory ──────────────────────────────────────────────────
export function createClient(config: ClientConfig) {
  const r = <T>(path: string, options?: RequestInit) => request<T>(config, path, options);

  return {
    jobs: {
      get: (jobId: string) => r<Job>(`/api/jobs/${jobId}`),
      poll: (jobId: string, intervalMs?: number) => pollJob(config, jobId, intervalMs),
    },

    auth: {
      login: (email: string, password: string) =>
        r<{ access_token: string; refresh_token: string }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }),
      register: (email: string, password: string) =>
        r<{ access_token: string; refresh_token: string }>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }),
      refresh: (refreshToken: string) =>
        request<{ access_token: string; refresh_token: string }>(
          { ...config, getToken: () => refreshToken },
          "/api/auth/refresh",
          { method: "POST" }
        ),
      me: () => r("/api/auth/me"),
    },

    papers: {
      list: (offset = 0, limit = 20) =>
        r<Paper[]>(`/api/papers?offset=${offset}&limit=${limit}`),
      get: (id: string) => r<Paper>(`/api/papers/${id}`),
      upload: (file: File, onProgress?: (pct: number) => void) => {
        const form = new FormData();
        form.append("file", file);
        const headers: Record<string, string> = {};
        if (config.getToken) {
          const token = config.getToken();
          if (token) headers["Authorization"] = `Bearer ${token}`;
        }
        return fetch(`${config.baseURL}/api/papers/upload`, {
          method: "POST",
          headers,
          body: form,
        }).then((res) => {
          if (!res.ok) return res.text().then((t) => Promise.reject(new Error(t)));
          return res.json() as Promise<{ paper_id: string; job_id?: string; title: string }>;
        });
      },
      analyze: (id: string) => r(`/api/papers/${id}/analyze`, { method: "POST" }),
      reproduce: (id: string) => r(`/api/papers/${id}/reproduce`, { method: "POST" }),
      delete: (id: string) => r(`/api/papers/${id}`, { method: "DELETE" }),
    },

    knowledge: {
      listInterests: () => r<ResearchInterest[]>("/api/knowledge/interests"),
      createInterest: (topic: string, keywords: string[]) =>
        r<ResearchInterest>("/api/knowledge/interests", {
          method: "POST",
          body: JSON.stringify({ topic, keywords }),
        }),
      generatePlan: (id: string) =>
        r(`/api/knowledge/interests/${id}/plan`, { method: "POST" }),
      listNotes: (search?: string) =>
        r<KnowledgeNote[]>(`/api/knowledge/notes${search ? `?search=${encodeURIComponent(search)}` : ""}`),
      createNote: (data: { title: string; content: string; tags?: string[]; research_interest_id?: string }) =>
        r<KnowledgeNote>("/api/knowledge/notes", { method: "POST", body: JSON.stringify(data) }),
      updateNote: (id: string, data: { title?: string; content?: string; tags?: string[] }) =>
        r<KnowledgeNote>(`/api/knowledge/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      deleteNote: (id: string) => r(`/api/knowledge/notes/${id}`, { method: "DELETE" }),
      search: (q: string, top_k = 5) =>
        r(`/api/knowledge/search?q=${encodeURIComponent(q)}&top_k=${top_k}`),
    },

    chat: {
      listSessions: () => r<ChatSession[]>("/api/chat/sessions"),
      getSession: (id: string) => r<ChatSession>(`/api/chat/sessions/${id}`),
      deleteSession: (id: string) => r(`/api/chat/sessions/${id}`, { method: "DELETE" }),
      send: (data: { session_id?: string; message: string; context_type?: string; context_id?: string }) =>
        r<{ success: boolean; session_id: string; message: string; sources: ChatMessage["sources"] }>(
          "/api/chat/send",
          { method: "POST", body: JSON.stringify(data) }
        ),
      stream: (data: Parameters<typeof streamChat>[1]) => streamChat(config, data),
    },

    settings: {
      get: () => r<AppSettings>("/api/settings"),
      update: (data: Partial<AppSettings>) =>
        r<{ ok: boolean; updated: string[] }>("/api/settings", {
          method: "PUT",
          body: JSON.stringify(data),
        }),
    },

    planner: {
      generate: (topic: string, keywords: string[]) =>
        r("/api/planner/generate", { method: "POST", body: JSON.stringify({ topic, keywords }) }),
    },

    survey: {
      generate: (query: string, max_papers = 20) =>
        r("/api/survey/generate", { method: "POST", body: JSON.stringify({ query, max_papers }) }),
      search: (query: string, limit = 20) =>
        r(`/api/survey/search?query=${encodeURIComponent(query)}&limit=${limit}`),
    },
  };
}

export type ResearchCopilotClient = ReturnType<typeof createClient>;

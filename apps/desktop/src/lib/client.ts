/**
 * Desktop Tauri client — replaces HTTP SDK with invoke() calls.
 * Implements the same interface as @research-copilot/api-sdk so pages
 * require minimal changes.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  Paper,
  ChatSession,
  ChatMessage,
  ChatStreamChunk,
  ResearchInterest,
  ResearchInterestProfile,
  ResearchInterestHintRequest,
  ResearchInterestHintResponse,
  KnowledgeNote,
  AppSettings,
  AgentRun,
} from "@research-copilot/types";

// ── Helpers ──────────────────────────────────────────────────────

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ── Settings ─────────────────────────────────────────────────────

export const settingsApi = {
  get: (): Promise<AppSettings> => invoke("settings_get"),
  update: (data: Partial<AppSettings>): Promise<{ ok: boolean; updated: string[] }> =>
    invoke("settings_update", { data }),
  test: (data: Partial<AppSettings>): Promise<string> =>
    invoke("settings_test", { data }),
};

// ── Papers ───────────────────────────────────────────────────────

export const papersApi = {
  list: (offset = 0, limit = 20): Promise<Paper[]> =>
    invoke("papers_list", { offset, limit }),
  get: (id: string): Promise<Paper> =>
    invoke("papers_get", { id }),
  upload: (filePath: string): Promise<{ paper_id: string; title: string }> =>
    invoke("papers_upload", { filePath: filePath }),
  delete: (id: string): Promise<void> =>
    invoke("papers_delete", { id }),
  analyze: (id: string): Promise<void> =>
    invoke("papers_analyze", { id }),
  reproduce: (id: string): Promise<void> =>
    invoke("papers_reproduce", { id }),
};

// ── Knowledge ─────────────────────────────────────────────────────

export const knowledgeApi = {
  listInterests: (): Promise<ResearchInterest[]> =>
    invoke("knowledge_list_interests"),
  createInterest: (
    topic: string,
    keywords: string[],
    profile?: ResearchInterestProfile
  ): Promise<ResearchInterest> =>
    invoke("knowledge_create_interest", { topic, keywords, profile: profile ?? null }),
  generateInterestHints: (data: ResearchInterestHintRequest): Promise<ResearchInterestHintResponse> =>
    invoke("knowledge_generate_interest_hints", {
      topic: data.topic,
      keywords: data.keywords ?? null,
      goal: data.goal ?? null,
      background: data.background ?? null,
      timeBudget: data.time_budget ?? null,
      constraints: data.constraints ?? null,
      knownContext: data.known_context ?? null,
      preferredOutput: data.preferred_output ?? null,
    }),
  generatePlan: (id: string): Promise<void> =>
    invoke("knowledge_generate_plan", { id }),
  listNotes: (search?: string): Promise<KnowledgeNote[]> =>
    invoke("knowledge_list_notes", { search: search ?? null }),
  createNote: (data: {
    title: string;
    content: string;
    tags?: string[];
    research_interest_id?: string;
  }): Promise<KnowledgeNote> =>
    invoke("knowledge_create_note", {
      title: data.title,
      content: data.content,
      tags: data.tags ?? null,
      researchInterestId: data.research_interest_id ?? null,
    }),
  updateNote: (id: string, data: { title?: string; content?: string; tags?: string[] }): Promise<KnowledgeNote> =>
    invoke("knowledge_update_note", {
      id,
      title: data.title ?? null,
      content: data.content ?? null,
      tags: data.tags ?? null,
    }),
  deleteNote: (id: string): Promise<void> =>
    invoke("knowledge_delete_note", { id }),
  search: (q: string, topK = 5): Promise<{ id: string; content: string; source: string; score: number }[]> =>
    invoke("knowledge_search", { q, topK }),
};

// ── Chat / Streaming ──────────────────────────────────────────────

export async function* streamChat(body: {
  session_id?: string;
  message: string;
  context_type?: string;
  context_id?: string;
}): AsyncGenerator<ChatStreamChunk> {
  // Start the backend stream, get request_id + session_id
  const { request_id, session_id } = await invoke<{
    request_id: string;
    session_id: string;
  }>("chat_stream", {
    message: body.message,
    sessionId: body.session_id ?? null,
    contextType: body.context_type ?? null,
    contextId: body.context_id ?? null,
  });

  yield { type: "request_id", value: request_id };
  yield { type: "session_id", value: session_id };

  // Collect events emitted by the Rust backend
  const queue: ChatStreamChunk[] = [];
  let done = false;
  let resolve: (() => void) | null = null;

  const enqueue = (chunk: ChatStreamChunk) => {
    queue.push(chunk);
    resolve?.();
    resolve = null;
  };

  const wait = () =>
    new Promise<void>((r) => {
      if (queue.length > 0) return r();
      resolve = r;
    });

  const unlisteners = await Promise.all([
    listen<{ request_id: string; plan: unknown[] }>(`chat:plan`, (e) => {
      if (e.payload.request_id === request_id)
        enqueue({ type: "plan", value: e.payload.plan as never });
    }),
    listen<{ request_id: string; value: AgentRun }>(`chat:agent_start`, (e) => {
      if (e.payload.request_id === request_id)
        enqueue({ type: "agent_start", value: e.payload.value });
    }),
    listen<{ request_id: string; value: AgentRun }>(`chat:agent_complete`, (e) => {
      if (e.payload.request_id === request_id)
        enqueue({ type: "agent_complete", value: e.payload.value });
    }),
    listen<{ request_id: string; delta: string }>(`chat:delta`, (e) => {
      if (e.payload.request_id === request_id)
        enqueue({ type: "delta", value: e.payload.delta });
    }),
    listen<{ request_id: string; value: NonNullable<ChatMessage["sources"]> }>(`chat:sources`, (e) => {
      if (e.payload.request_id === request_id)
        enqueue({ type: "sources", value: e.payload.value });
    }),
    listen<{ request_id: string }>(`chat:done`, (e) => {
      if (e.payload.request_id === request_id) {
        enqueue({ type: "done" });
        done = true;
        resolve?.();
        resolve = null;
      }
    }),
    listen<{ request_id: string; error: string }>(`chat:error`, (e) => {
      if (e.payload.request_id === request_id) {
        enqueue({ type: "error", value: e.payload.error });
        done = true;
        resolve?.();
        resolve = null;
      }
    }),
  ]);

  try {
    while (true) {
      await wait();
      while (queue.length > 0) {
        yield queue.shift()!;
      }
      if (done) break;
    }
  } finally {
    unlisteners.forEach((u) => u());
  }
}

export const chatApi = {
  listSessions: (): Promise<ChatSession[]> => invoke("chat_list_sessions"),
  getSession: (id: string): Promise<ChatSession> => invoke("chat_get_session", { id }),
  deleteSession: (id: string): Promise<void> => invoke("chat_delete_session", { id }),
  listAgentRuns: (sessionId: string, requestId?: string): Promise<AgentRun[]> =>
    invoke("chat_list_agent_runs", { sessionId, requestId: requestId ?? null }),
  stream: streamChat,
};

// ── Planner ───────────────────────────────────────────────────────

export const plannerApi = {
  generate: (topic: string, keywords: string[]): Promise<void> =>
    invoke("planner_generate", { topic, keywords }),
};

// ── Survey ────────────────────────────────────────────────────────

export const surveyApi = {
  generate: (query: string, maxPapers = 20): Promise<void> =>
    invoke("survey_generate", { query, maxPapers }),
  search: (query: string, limit = 20): Promise<unknown[]> =>
    invoke("survey_search", { query, limit }),
};

// ── Unified client (mirrors api-sdk shape) ────────────────────────

export const apiClient = {
  settings: settingsApi,
  papers: papersApi,
  knowledge: knowledgeApi,
  chat: chatApi,
  planner: plannerApi,
  survey: surveyApi,
};

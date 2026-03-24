/**
 * Desktop Tauri client — replaces HTTP SDK with invoke() calls.
 * Implements the same interface as @research-copilot/api-sdk so pages
 * require minimal changes.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  ArxivRankingMode,
  ArxivSearchRequest,
  ArxivSearchResponse,
  CcfLookupResponse,
  JournalLookupResponse,
  SourceLookupResponse,
  Paper,
  ChatSession,
  ChatMessage,
  ChatStreamChunk,
  ResearchInterest,
  ResearchInterestProfile,
  ResearchInterestHintRequest,
  ResearchInterestHintResponse,
  KnowledgeNote,
  Skill,
  AppSettings,
  AppUpdateInfo,
  AgentRun,
} from "@research-copilot/types";

// ── Helpers ──────────────────────────────────────────────────────

export function formatErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.trim();

  if (!normalized) return "操作未完成，请稍后重试。";

  const directMap: Record<string, string> = {
    "Session not found": "未找到对应会话。",
    "Research interest not found": "未找到对应研究方向。",
    "Interest not found": "未找到对应研究方向。",
    "Note not found": "未找到对应笔记。",
    "Paper not found": "未找到对应论文。",
    "Expected object": "请求参数格式不正确。",
  };

  if (directMap[normalized]) return directMap[normalized];

  return normalized
    .replace(/^PDF extraction failed:/i, "PDF 解析失败：")
    .replace(/^error:\s*/i, "");
}

// ── Settings ─────────────────────────────────────────────────────

export const settingsApi = {
  get: (): Promise<AppSettings> => invoke("settings_get"),
  update: (data: Partial<AppSettings>): Promise<{ ok: boolean; updated: string[] }> =>
    invoke("settings_update", { data }),
  test: (data: Partial<AppSettings>): Promise<string> =>
    invoke("settings_test", { data }),
};

export const updatesApi = {
  check: (): Promise<AppUpdateInfo> => invoke("update_check"),
  install: (): Promise<void> => invoke("update_install"),
};

// ── Papers ───────────────────────────────────────────────────────

export const papersApi = {
  list: (offset = 0, limit = 20, research_interest_id?: string): Promise<Paper[]> =>
    invoke("papers_list", { offset, limit, researchInterestId: research_interest_id ?? null }),
  get: (id: string): Promise<Paper> =>
    invoke("papers_get", { id }),
  upload: (filePath: string, research_interest_id?: string): Promise<{ paper_id: string; title: string }> =>
    invoke("papers_upload", { filePath, researchInterestId: research_interest_id ?? null }),
  update: (id: string, data: { title?: string; authors?: string; venue?: string; year?: number; doi?: string; research_interest_id?: string; importance_color?: string; notes?: string }): Promise<Paper> =>
    invoke("papers_update", {
      id,
      title: data.title ?? null,
      authors: data.authors ?? null,
      venue: data.venue ?? null,
      year: data.year ?? null,
      doi: data.doi ?? null,
      researchInterestId: data.research_interest_id ?? null,
      importanceColor: data.importance_color ?? null,
      notes: data.notes ?? null,
    }),
  delete: (id: string): Promise<void> =>
    invoke("papers_delete", { id }),
  openFile: (id: string): Promise<void> =>
    invoke("papers_open_pdf", { id }),
  analyze: (id: string): Promise<void> =>
    invoke("papers_analyze", { id }),
  reproduce: (id: string): Promise<void> =>
    invoke("papers_reproduce", { id }),
  listFigures: (paper_id: string): Promise<Array<{ id: string; paper_id: string; fig_index: number; caption: string | null; data_url: string }>> =>
    invoke("papers_list_figures", { paperId: paper_id }),
  extractPdfText: (filePath: string, max_chars = 32000): Promise<string> =>
    invoke("papers_extract_pdf_text", { filePath, maxChars: max_chars }),
};

export const ccfApi = {
  lookup: (query: string, limit = 8): Promise<CcfLookupResponse> =>
    invoke("ccf_lookup", { query, limit }),
};

export const journalApi = {
  lookup: (query: string, limit = 8): Promise<JournalLookupResponse> =>
    invoke("journal_lookup", { query, limit }),
};

export const sourceApi = {
  lookup: (query: string, limit = 8): Promise<SourceLookupResponse> =>
    invoke("source_lookup", { query, limit }),
};

export const arxivApi = {
  search: (
    request: ArxivSearchRequest,
    days = 14,
    limit = 5,
    ranking_mode: ArxivRankingMode = "relevance"
  ): Promise<ArxivSearchResponse> =>
    invoke("arxiv_search", { request, days, limit, rankingMode: ranking_mode }),
};

export const paperSearchApi = {
  search: (
    request: ArxivSearchRequest,
    days = 14,
    limit = 5,
    ranking_mode: ArxivRankingMode = "relevance"
  ): Promise<ArxivSearchResponse> =>
    invoke("paper_search", { request, days, limit, rankingMode: ranking_mode }),
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
  updateInterestFolder: (id: string, folder_name: string): Promise<ResearchInterest> =>
    invoke("knowledge_update_interest_folder", { id, folderName: folder_name }),
  deleteInterestBundle: (id: string): Promise<{ deleted_interest_id: string; deleted_sessions: number; deleted_notes: number; deleted_papers: number }> =>
    invoke("knowledge_delete_interest_bundle", { id }),
  deleteInterestOnly: (id: string): Promise<{ deleted_interest_id: string }> =>
    invoke("knowledge_delete_interest_only", { id }),
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
  suggestTopics: (field: string, goalType: string, background: string): Promise<string[]> =>
    invoke("knowledge_suggest_topics", { field, goalType: goalType, background }),
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
  moveNote: (id: string, research_interest_id?: string): Promise<KnowledgeNote> =>
    invoke("knowledge_move_note", {
      id,
      researchInterestId: research_interest_id ?? null,
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
  updateSessionContext: (id: string, interestId?: string): Promise<ChatSession> =>
    invoke("chat_update_session_context", {
      id,
      contextType: interestId ? "interest" : "general",
      contextId: interestId ?? null,
    }),
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
  generate: (
    query: string,
    maxPapers = 20,
    timeFrom?: number,
    timeTo?: number,
    litTypes?: string[],
    databases?: string[],
    citationFormat?: string,
    language?: string,
    paperIds?: string[],
  ): Promise<void> =>
    invoke("survey_generate", {
      query,
      maxPapers,
      timeFrom: timeFrom ?? null,
      timeTo: timeTo ?? null,
      litTypes: litTypes ?? null,
      databases: databases ?? null,
      citationFormat: citationFormat ?? null,
      language: language ?? null,
      paperIds: paperIds ?? null,
    }),
  search: (query: string, limit = 20): Promise<unknown[]> =>
    invoke("survey_search", { query, limit }),
};

// ── Translate ─────────────────────────────────────────────────────

export const translateApi = {
  translate: (text: string, targetLang: string, sourceLang?: string): Promise<string> =>
    invoke("translate_text", { text, targetLang, sourceLang: sourceLang ?? null }),
};

// ── Markdown Format ───────────────────────────────────────────────

export const markdownApi = {
  formatChunk: (
    text: string,
    styleSummary: string,
  ): Promise<{ formatted: string; styleSummary: string }> =>
    invoke("markdown_format_chunk", { text, styleSummary }),
};

// ── Skills ────────────────────────────────────────────────────────

export const skillsApi = {
  list: (): Promise<Skill[]> =>
    invoke("skills_list"),
  create: (data: {
    name: string;
    title: string;
    description: string;
    prompt: string;
    tags?: string[];
  }): Promise<Skill> =>
    invoke("skills_create", {
      name: data.name,
      title: data.title,
      description: data.description,
      prompt: data.prompt,
      tags: data.tags ?? null,
    }),
  update: (
    id: string,
    data: {
      title?: string;
      description?: string;
      prompt?: string;
      tags?: string[];
      is_enabled?: boolean;
    }
  ): Promise<Skill> =>
    invoke("skills_update", {
      id,
      title: data.title ?? null,
      description: data.description ?? null,
      prompt: data.prompt ?? null,
      tags: data.tags ?? null,
      isEnabled: data.is_enabled ?? null,
    }),
  delete: (id: string): Promise<void> =>
    invoke("skills_delete", { id }),
  resetBuiltins: (): Promise<Skill[]> =>
    invoke("skills_reset_builtins"),
};

// ── Unified client (mirrors api-sdk shape) ────────────────────────

export const apiClient = {
  arxiv: arxivApi,
  paperSearch: paperSearchApi,
  ccf: ccfApi,
  journals: journalApi,
  sources: sourceApi,
  settings: settingsApi,
  translate: translateApi,
  markdown: markdownApi,
  updates: updatesApi,
  papers: papersApi,
  knowledge: knowledgeApi,
  chat: chatApi,
  planner: plannerApi,
  survey: surveyApi,
  skills: skillsApi,
};

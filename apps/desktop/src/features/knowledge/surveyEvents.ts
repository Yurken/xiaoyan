import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { listen } from "@tauri-apps/api/event";
import type { StructuredSurveyResult, SurveyAgentState } from "./shared";

interface SurveyEventOptions {
  requestIdRef: MutableRefObject<string | null>;
  contentRef: MutableRefObject<string>;
  setContent: Dispatch<SetStateAction<string>>;
  setGenerating: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setAgents: Dispatch<SetStateAction<SurveyAgentState[]>>;
  setStructured: Dispatch<SetStateAction<StructuredSurveyResult | null>>;
  cleanupSurveyListeners: () => void;
}

export function createSurveyRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `survey-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function registerSurveyEventListeners({
  requestIdRef,
  contentRef,
  setContent,
  setGenerating,
  setError,
  setAgents,
  setStructured,
  cleanupSurveyListeners,
}: SurveyEventOptions) {
  const acceptRequest = (requestId?: string) => !requestId || requestId === requestIdRef.current;
  const finishWithError = (message: string) => {
    setError(message);
    setGenerating(false);
    cleanupSurveyListeners();
  };

  return Promise.all([
    listen<{ request_id?: string; delta: string }>("survey:delta", (event) => {
      if (!acceptRequest(event.payload.request_id)) return;
      contentRef.current += event.payload.delta;
      setContent(contentRef.current);
    }),
    listen<{ request_id?: string }>("survey:done", (event) => {
      if (!acceptRequest(event.payload.request_id)) return;
      setGenerating(false);
      cleanupSurveyListeners();
    }),
    listen<{ request_id?: string; error: string }>("survey:error", (event) => {
      if (!acceptRequest(event.payload.request_id)) return;
      finishWithError(event.payload.error);
    }),
    listen<{
      request_id?: string;
      query: string;
      report: StructuredSurveyResult["report"];
      papers: StructuredSurveyResult["papers"];
      formatted_citations?: string[];
      citation_format?: string;
      meta?: StructuredSurveyResult["meta"];
    }>("survey:structured", (event) => {
      if (!acceptRequest(event.payload.request_id)) return;
      setStructured({
        query: event.payload.query,
        report: event.payload.report,
        papers: event.payload.papers,
        formatted_citations: event.payload.formatted_citations,
        citation_format: event.payload.citation_format,
        meta: event.payload.meta,
      });
    }),
    listen<{ request_id?: string; agent: SurveyAgentState }>("survey:agent_start", (event) => {
      if (!acceptRequest(event.payload.request_id)) return;
      const nextAgent = event.payload.agent;
      setAgents((prev) => {
        const exists = prev.some((item) => item.id === nextAgent.id);
        if (exists) return prev.map((item) => (item.id === nextAgent.id ? { ...item, ...nextAgent } : item));
        return [...prev, nextAgent];
      });
    }),
    listen<{ request_id?: string; agent: SurveyAgentState }>("survey:agent_complete", (event) => {
      if (!acceptRequest(event.payload.request_id)) return;
      const nextAgent = event.payload.agent;
      setAgents((prev) => prev.map((item) => (item.id === nextAgent.id ? { ...item, ...nextAgent, status: "done" } : item)));
    }),
    listen<{ request_id?: string; agent: SurveyAgentState }>("survey:agent_error", (event) => {
      if (!acceptRequest(event.payload.request_id)) return;
      const nextAgent = event.payload.agent;
      setAgents((prev) => prev.map((item) => (item.id === nextAgent.id ? { ...item, ...nextAgent, status: "failed" } : item)));
      finishWithError(nextAgent.error || "生成未完成，请稍后重试。");
    }),
  ]);
}

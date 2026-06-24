import { useCallback, useRef, useState } from "react";
import {
  buildCopilotMessageContent,
  upsertAgentRun,
} from "./shared";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { AgentPlanStep, AgentRun, ChatMessage, ChatMode, ChatSession, RoutingDecision, Skill } from "@research-copilot/types";

const DEFAULT_ATTACHMENT_PROMPT = "请先阅读我上传的文件，并给我一个简洁的重点概览。";

export interface UseCopilotChatOptions {
  currentSession: ChatSession | null;
  selectedInterestId: string;
  chatMode: ChatMode;
  skills: Skill[];
  selectedSkillId: string | null;
  attachments: ReturnType<typeof import("./useCopilotAttachments").useCopilotAttachments>["attachments"];
  clearAttachments: () => void;
  onSessionCreated: (sessionId: string) => void;
}

export function useCopilotChat(options: UseCopilotChatOptions) {
  const {
    currentSession,
    selectedInterestId,
    chatMode,
    skills,
    selectedSkillId,
    attachments,
    clearAttachments,
    onSessionCreated,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<AgentPlanStep[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [requestId, setRequestId] = useState<string>();
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchingQuery, setSearchingQuery] = useState<string | null>(null);
  const [routingDecision, setRoutingDecision] = useState<RoutingDecision | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef("");
  const rafRef = useRef(0);

  const resetChat = useCallback(() => {
    setMessages([]);
    setPlan([]);
    setAgentRuns([]);
    setRequestId(undefined);
    setActiveAssistantId(null);
    setInput("");
    setLoadError("");
    setSearchingQuery(null);
    setRoutingDecision(null);
  }, []);

  const cancelActiveStream = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  }, []);

  const handleSend = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || sending) return;
    const rawText = input.trim() || DEFAULT_ATTACHMENT_PROMPT;
    const selSkill = skills.find((s) => s.id === selectedSkillId);
    const text = selSkill
      ? `[技能指令 · ${selSkill.title}]\n${selSkill.prompt}\n\n---\n\n${rawText}`
      : rawText;
    const submittedText = buildCopilotMessageContent(text, attachments);
    const assistantId = `${Date.now()}_a`;

    if (chatMode === "task") setSidebarCollapsed(false);

    void apiClient.memory.add({
      type: "auto",
      action: "chat.query",
      summary: `向小妍提问：${rawText.slice(0, 60)}${rawText.length > 60 ? "..." : ""}`,
    });

    cancelActiveStream();
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    setInput("");
    clearAttachments();
    setSending(true);
    setLoadError("");
    setPlan([]);
    setAgentRuns([]);
    setRequestId(undefined);
    setRoutingDecision(null);
    setActiveAssistantId(assistantId);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: submittedText,
      created_at: new Date().toISOString(),
    };
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    streamingContentRef.current = "";
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    try {
      let sessionId = currentSession?.id;

      for await (const chunk of apiClient.chat.stream(
        {
          session_id: currentSession?.id,
          message: submittedText,
          context_type: selectedInterestId ? "interest" : "general",
          context_id: selectedInterestId || undefined,
          chat_mode: chatMode,
        },
        abortController.signal
      )) {
        if (streamAbortRef.current !== abortController || abortController.signal.aborted) {
          abortController.abort();
          break;
        }
        if (chunk.type === "session_id") sessionId = chunk.value;
        if (chunk.type === "request_id") setRequestId(chunk.value);
        if (chunk.type === "plan") setPlan(chunk.value);
        if (chunk.type === "agent_start" || chunk.type === "agent_complete" || chunk.type === "agent_error") {
          setAgentRuns((prev) => upsertAgentRun(prev, chunk.value));
        }
        if (chunk.type === "searching") setSearchingQuery(chunk.query);
        if (chunk.type === "routing_decision") setRoutingDecision(chunk.value);
        if (chunk.type === "tool_result") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, tool_results: [...(m.tool_results || []), { tool_name: chunk.tool_name, tool_id: chunk.tool_id, result: chunk.result, result_id: chunk.result_id }] }
                : m
            )
          );
        }
        if (chunk.type === "delta") {
          if (searchingQuery) setSearchingQuery(null);
          streamingContentRef.current += chunk.value;

          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
              const content = streamingContentRef.current;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
              );
              rafRef.current = 0;
            });
          }
        }
        if (chunk.type === "sources") {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, sources: chunk.value } : m))
          );
        }
        if (chunk.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: chunk.value || "请求未完成，请稍后重试。" } : m
            )
          );
        }
      }

      // Flush any remaining buffered streaming content
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (streamingContentRef.current) {
        const finalContent = streamingContentRef.current;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: finalContent } : m))
        );
        streamingContentRef.current = "";
      }

      if (sessionId && !currentSession && !abortController.signal.aborted) {
        onSessionCreated(sessionId);
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        const msg = `请求未完成：${formatErrorMessage(error)}`;
        setMessages((prev) =>
          prev.map((item) => (item.id === assistantId ? { ...item, content: msg } : item))
        );
      }
    } finally {
      setSending(false);
      streamingContentRef.current = "";
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (streamAbortRef.current === abortController) streamAbortRef.current = null;
    }
  }, [
    input, attachments, sending, skills, selectedSkillId, chatMode,
    currentSession, selectedInterestId, clearAttachments, cancelActiveStream,
    searchingQuery, onSessionCreated,
  ]);

  return {
    messages,
    setMessages,
    plan,
    agentRuns,
    setAgentRuns,
    requestId,
    activeAssistantId,
    input,
    setInput,
    sending,
    loadError,
    setLoadError,
    searchingQuery,
    routingDecision,
    sidebarCollapsed,
    setSidebarCollapsed,
    resetChat,
    cancelActiveStream,
    handleSend,
  };
}

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
  // 始终指向最新消息列表，供 retry/editAndResend 在点击时读取，避免闭包过期。
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

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

  // 流式对话核心：接收已构建好的发送内容与「基础消息列表」（含用户消息、不含助手占位），
  // 追加助手占位后驱动流式响应。handleSend / retry / editAndResend 共用，避免重复流式逻辑。
  const runChatStream = useCallback(
    async (
      submittedText: string,
      buildBaseMessages: (prev: ChatMessage[]) => ChatMessage[],
      images: Array<{ data: string; mediaType: string }> = [],
    ) => {
      const assistantId = `${Date.now()}_a`;

      // 带图时后端强制走直答（不发 plan/agent 事件），任务模式也不展开协同台，避免出现空的 agent 面板。
      if (chatMode === "task" && images.length === 0) setSidebarCollapsed(false);

      cancelActiveStream();
      const abortController = new AbortController();
      streamAbortRef.current = abortController;

      setSending(true);
      setLoadError("");
      setPlan([]);
      setAgentRuns([]);
      setRequestId(undefined);
      setRoutingDecision(null);
      setActiveAssistantId(assistantId);

      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...buildBaseMessages(prev), assistantMsg]);
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
            images: images.length ? images : undefined,
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
            setSearchingQuery((q) => (q ? null : q));
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
    },
    [chatMode, currentSession, selectedInterestId, cancelActiveStream, onSessionCreated]
  );

  const handleSend = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || sending) return;
    const rawText = input.trim() || DEFAULT_ATTACHMENT_PROMPT;
    const selSkill = skills.find((s) => s.id === selectedSkillId);
    const text = selSkill
      ? `[技能指令 · ${selSkill.title}]\n${selSkill.prompt}\n\n---\n\n${rawText}`
      : rawText;
    const submittedText = buildCopilotMessageContent(text, attachments);
    // 图片走多模态 images 通道：发送给后端用 {data,mediaType}，存进消息用带 name 的 ChatImageRef 供气泡缩略图展示。
    const imageAttachments = attachments.filter(
      (a): a is typeof a & { imageData: string; imageMediaType: string } =>
        a.kind === "image" && !!a.imageData && !!a.imageMediaType,
    );
    const images = imageAttachments.map((a) => ({ data: a.imageData, mediaType: a.imageMediaType }));

    // 发图前先确认已配置视觉模型；未配置则提示并保留输入/附件，不发送。
    if (images.length > 0) {
      try {
        const settings = await apiClient.settings.get();
        if (!settings.vision_model?.trim()) {
          setLoadError("发送图片前请先在「设置 → 模型角色 → 视界·视觉」中配置视觉模型。");
          return;
        }
      } catch {
        // 设置获取失败时不阻断，交由后端兜底校验。
      }
    }

    void apiClient.memory.add({
      type: "auto",
      action: "chat.query",
      summary: `向小妍提问：${rawText.slice(0, 60)}${rawText.length > 60 ? "..." : ""}`,
    });

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: submittedText,
      images: imageAttachments.length
        ? imageAttachments.map((a) => ({ data: a.imageData, mediaType: a.imageMediaType, name: a.name }))
        : undefined,
      created_at: new Date().toISOString(),
    };

    setInput("");
    clearAttachments();
    await runChatStream(submittedText, (prev) => [...prev, userMsg], images);
  }, [input, attachments, sending, skills, selectedSkillId, clearAttachments, runChatStream]);

  // 重新生成：复用目标助手消息之前那条用户消息（其 content 即原始发送内容，已含附件上下文）。
  const retry = useCallback(
    (assistantMsgId: string) => {
      if (sending) return;
      const list = messagesRef.current;
      const assistantIdx = list.findIndex((m) => m.id === assistantMsgId);
      if (assistantIdx < 0) return;
      let userIdx = assistantIdx - 1;
      while (userIdx >= 0 && list[userIdx].role !== "user") userIdx -= 1;
      if (userIdx < 0) return;
      const base = list.slice(0, userIdx + 1);
      const images = (list[userIdx].images ?? []).map((im) => ({ data: im.data, mediaType: im.mediaType }));
      void runChatStream(list[userIdx].content, () => base, images);
    },
    [sending, runChatStream]
  );

  // 编辑并重发：用新文本替换该用户消息（保留其原有附件上下文块），截断其后所有消息后重发。
  const editAndResend = useCallback(
    (messageId: string, newText: string) => {
      if (sending) return;
      const trimmed = newText.trim();
      if (!trimmed) return;
      const list = messagesRef.current;
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx < 0 || list[idx].role !== "user") return;
      const blockIdx = list[idx].content.indexOf("<copilot-attachments");
      const submittedText = blockIdx >= 0 ? `${trimmed}\n\n${list[idx].content.slice(blockIdx)}` : trimmed;
      const updatedUser: ChatMessage = { ...list[idx], content: submittedText };
      const base = [...list.slice(0, idx), updatedUser];
      const images = (list[idx].images ?? []).map((im) => ({ data: im.data, mediaType: im.mediaType }));
      void runChatStream(submittedText, () => base, images);
    },
    [sending, runChatStream]
  );

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
    retry,
    editAndResend,
  };
}

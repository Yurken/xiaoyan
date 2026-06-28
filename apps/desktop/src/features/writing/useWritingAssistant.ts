import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import {
  buildWritingAssistantPrompt,
  type LatexDiagnostic,
  type LatexOutlineEntry,
  type LatexStats,
  type WritingAssistantActionId,
  type WritingAssistantMessage,
} from "./shared";

interface UseWritingAssistantOptions {
  projectName: string;
  mainTex: string;
  bibtex: string;
  notes: string;
  outline: LatexOutlineEntry[];
  diagnostics: LatexDiagnostic[];
  stats: LatexStats;
  getSelectedText: () => string;
}

export function useWritingAssistant({
  projectName,
  mainTex,
  bibtex,
  notes,
  outline,
  diagnostics,
  stats,
  getSelectedText,
}: UseWritingAssistantOptions) {
  const [messages, setMessages] = useState<WritingAssistantMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.content.trim()),
    [messages],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  const reset = useCallback(() => {
    cancel();
    setMessages([]);
    setSessionId(undefined);
    setError("");
  }, [cancel]);

  const send = useCallback(async (actionId: WritingAssistantActionId, userInstruction: string) => {
    if (sending) return;

    const selectedText = getSelectedText();
    const assistantId = createWritingAssistantMessageId("assistant");
    const userMessage: WritingAssistantMessage = {
      id: createWritingAssistantMessageId("user"),
      role: "user",
      content: renderUserMessage(actionId, userInstruction, selectedText),
      createdAt: new Date().toISOString(),
      actionId,
    };
    const assistantMessage: WritingAssistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      actionId,
    };
    const abortController = new AbortController();

    abortRef.current?.abort();
    abortRef.current = abortController;
    setSending(true);
    setError("");
    setMessages((current) => [...current, userMessage, assistantMessage]);

    let assistantText = "";
    try {
      if (actionId === "polish") {
        if (!selectedText.trim()) {
          throw new Error("请先选中要润色的文本，再点击润色。");
        }
        const result = await apiClient.writing.polish({
          text: selectedText,
          section: "free",
          direction: userInstruction.trim() || "polish",
        });
        assistantText = formatPolishResult(result);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: assistantText } : message,
          ),
        );
        setSending(false);
        return;
      }

      const prompt = buildWritingAssistantPrompt({
        actionId,
        userInstruction,
        projectName,
        mainTex,
        bibtex,
        notes,
        selectedText,
        outline,
        diagnostics,
        stats,
      });
      for await (const chunk of apiClient.chat.stream(
        {
          session_id: sessionId,
          message: prompt,
          context_type: "general",
          chat_mode: "direct",
          tag: "writing",
        },
        abortController.signal,
      )) {
        if (abortRef.current !== abortController || abortController.signal.aborted) {
          abortController.abort();
          break;
        }

        if (chunk.type === "session_id") {
          setSessionId(chunk.value);
        }
        if (chunk.type === "delta") {
          assistantText += chunk.value;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, content: assistantText } : message,
            ),
          );
        }
        if (chunk.type === "error") {
          const errorText = chunk.value || "小妍这次没有完成写作辅助。";
          assistantText = errorText;
          setError(errorText);
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, content: errorText } : message,
            ),
          );
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        const errorText = `小妍写作辅助失败：${formatErrorMessage(err)}`;
        setError(errorText);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: errorText } : message,
          ),
        );
      }
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null;
      }
      setSending(false);
    }
  }, [
    bibtex,
    diagnostics,
    getSelectedText,
    mainTex,
    notes,
    outline,
    projectName,
    sending,
    sessionId,
    stats,
  ]);

  return {
    messages,
    latestAssistantMessage,
    sending,
    error,
    send,
    cancel,
    reset,
  };
}

function createWritingAssistantMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderUserMessage(
  actionId: WritingAssistantActionId,
  userInstruction: string,
  selectedText: string,
): string {
  const prefix = actionId === "freeform" ? "问小妍" : actionLabel(actionId);
  const instruction = userInstruction.trim();
  const selectionHint = selectedText.trim() ? `（已带入 ${selectedText.trim().length} 字符选区）` : "";
  return instruction ? `${prefix}${selectionHint}：${instruction}` : `${prefix}${selectionHint}`;
}

function actionLabel(actionId: WritingAssistantActionId): string {
  switch (actionId) {
    case "polish":
      return "润色";
    case "continue":
      return "续写";
    case "abstract":
      return "摘要";
    case "review":
      return "检查";
    default:
      return "问小妍";
  }
}

function formatPolishResult(result: { polished: string; revision_notes: string[]; warnings: string[] }): string {
  const parts: string[] = [];
  parts.push("## 润色结果\n\n" + result.polished.trim());
  if (result.revision_notes && result.revision_notes.length > 0) {
    parts.push("\n\n## 修改说明\n\n" + result.revision_notes.map((note) => `- ${note}`).join("\n"));
  }
  if (result.warnings && result.warnings.length > 0) {
    parts.push("\n\n## ⚠️ 需要注意\n\n" + result.warnings.map((warning) => `- ${warning}`).join("\n"));
  }
  return parts.join("");
}

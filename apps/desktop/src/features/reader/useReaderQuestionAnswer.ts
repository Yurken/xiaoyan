import { useCallback, useEffect, useRef, useState } from "react";
import { chatApi } from "../../lib/client";
import { buildReaderQuestionContext, type ReaderPageContent } from "./readerNavigation";
import { splitReasoning } from "./readerReasoning";

export interface ReaderQaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "loading" | "done" | "error";
  page: number;
}

let qaMessageSequence = 0;

export function createReaderQaMessageId(role: ReaderQaMessage["role"]) {
  qaMessageSequence += 1;
  return `${Date.now()}-${qaMessageSequence}-${role}`;
}

export function useReaderQuestionAnswer(
  paperId: string | undefined,
  paperTitle: string,
  pages: ReaderPageContent[],
) {
  const [messages, setMessages] = useState<ReaderQaMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const sessionRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    sessionRef.current = undefined;
    setMessages([]);
    setSending(false);
    setError("");
  }, [paperId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(async (question: string, currentPage: number) => {
    const trimmed = question.trim();
    if (!paperId || !trimmed || sending) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const userId = createReaderQaMessageId("user");
    const assistantId = createReaderQaMessageId("assistant");
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: trimmed, status: "done", page: currentPage },
      { id: assistantId, role: "assistant", content: "", status: "loading", page: currentPage },
    ]);
    setSending(true);
    setError("");

    const excerpts = buildReaderQuestionContext(pages, trimmed, currentPage);
    const prompt = [
      `你正在帮助用户精读论文《${paperTitle || "当前论文"}》。`,
      `用户当前阅读到第 ${currentPage} 页。请只依据给出的论文原文回答；需要推断时明确标注“推断”。`,
      "回答使用中文，先给直接结论，再给依据。引用依据时标注页码，例如「第 3 页」。如果原文不足以回答，请明确说明缺少什么。",
      `\n用户问题：${trimmed}`,
      excerpts ? `\n论文原文摘录：\n${excerpts}` : "\n论文原文尚在加载，请依据当前论文上下文回答并说明证据限制。",
    ].join("\n");

    let raw = "";
    try {
      for await (const chunk of chatApi.stream({
        session_id: sessionRef.current,
        message: prompt,
        context_type: "paper",
        context_id: paperId,
        chat_mode: "direct",
        tag: "reader-qa",
      }, controller.signal)) {
        if (chunk.type === "session_id") sessionRef.current = chunk.value;
        if (chunk.type === "delta") {
          raw += chunk.value;
          const content = splitReasoning(raw).answer;
          setMessages((current) => current.map((message) => (
            message.id === assistantId ? { ...message, content } : message
          )));
        }
        if (chunk.type === "error") throw new Error(chunk.value || "问答失败");
      }
      setMessages((current) => current.map((message) => (
        message.id === assistantId ? { ...message, content: splitReasoning(raw).answer, status: "done" } : message
      )));
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "问答失败";
      setError(message);
      setMessages((current) => current.map((item) => (
        item.id === assistantId ? { ...item, status: "error", content: item.content || message } : item
      )));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setSending(false);
      }
    }
  }, [pages, paperId, paperTitle, sending]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sessionRef.current = undefined;
    setMessages([]);
    setSending(false);
    setError("");
  }, []);

  return { messages, sending, error, ask, clear };
}

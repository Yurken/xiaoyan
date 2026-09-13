import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatSession } from "@research-copilot/types";
import { apiClient } from "../../lib/client";
import { getRecord, getRecords } from "../sync/localStore";
import { useChatSessions } from "./useChatSessions";

type LocalChatMessage = ChatMessage & { session_id?: string };

const GENERIC_FAILURE = "请求未完成，请检查后端连接后重试";
const EMPTY_RESPONSE = "后端未返回内容，请重试";
const SESSION_LOAD_FAILURE = "无法加载该对话，请检查连接后重试";

let localMessageSeq = 0;

function createLocalMessageId(): string {
  localMessageSeq += 1;
  return `${Date.now()}-${localMessageSeq}`;
}

export function useChat() {
  const {
    sessions,
    reload: reloadSessions,
    source: sessionsSource,
    error: sessionsError,
  } = useChatSessions();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loadingSession, setLoadingSession] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const send = useCallback(async () => {
    if (!input.trim() || sending || inFlightRef.current) return;
    const text = input.trim();
    inFlightRef.current = true;
    if (!mountedRef.current) {
      inFlightRef.current = false;
      return;
    }
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = {
      id: createLocalMessageId(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const assistantId = createLocalMessageId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const patchAssistant = (patch: (message: ChatMessage) => ChatMessage) => {
      if (!mountedRef.current) return;
      setMessages((prev) =>
        prev.map((message) => (message.id === assistantId ? patch(message) : message)),
      );
    };

    try {
      let receivedContent = false;
      let sawError = false;
      for await (const chunk of apiClient.chat.stream({
        session_id: sessionId,
        message: text,
      })) {
        if (!mountedRef.current) break;
        if (chunk.type === "session_id") {
          setSessionId(chunk.value);
        } else if (chunk.type === "delta") {
          if (chunk.value) receivedContent = true;
          patchAssistant((message) => ({
            ...message,
            content: message.content + chunk.value,
          }));
        } else if (chunk.type === "sources") {
          patchAssistant((message) => ({ ...message, sources: chunk.value }));
        } else if (chunk.type === "error") {
          sawError = true;
          patchAssistant((message) => ({ ...message, content: GENERIC_FAILURE }));
          break;
        }
      }

      if (mountedRef.current && !sawError) {
        setMessages((prev) =>
          prev.map((message) => {
            if (message.id !== assistantId) return message;
            if (!receivedContent && !message.content.trim()) {
              return { ...message, content: EMPTY_RESPONSE };
            }
            return message;
          }),
        );
      }

      if (mountedRef.current) {
        void reloadSessions();
      }
    } catch {
      patchAssistant((message) => ({ ...message, content: GENERIC_FAILURE }));
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setSending(false);
      }
    }
  }, [input, sending, sessionId, reloadSessions]);

  const newChat = useCallback(() => {
    setMessages([]);
    setSessionId(undefined);
    setSessionError(null);
    setShowSessions(false);
  }, []);

  const loadSession = useCallback(async (id: string) => {
    if (id === sessionId) {
      setShowSessions(false);
      return;
    }
    setLoadingSession(true);
    setShowSessions(false);
    try {
      const data = await apiClient.chat.getSession(id);
      if (!mountedRef.current) return;
      setMessages(data.messages ?? []);
      setSessionId(id);
      setSessionError(null);
    } catch {
      try {
        const [local, storedMessages] = await Promise.all([
          getRecord<ChatSession>("chat_sessions", id),
          getRecords<LocalChatMessage>("chat_messages"),
        ]);
        if (!mountedRef.current) return;
        if (local) {
          const messages = storedMessages
            .filter((message) => message.session_id === id)
            .sort((a, b) => {
              const left = Date.parse(a.created_at);
              const right = Date.parse(b.created_at);
              return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
            });
          setMessages(messages);
          setSessionId(id);
          setSessionError(null);
        } else {
          setSessionError(SESSION_LOAD_FAILURE);
        }
      } catch {
        if (!mountedRef.current) return;
        setSessionError(SESSION_LOAD_FAILURE);
      }
    } finally {
      if (mountedRef.current) {
        setLoadingSession(false);
      }
    }
  }, [sessionId]);

  const toggleSessions = useCallback(() => {
    setShowSessions((open) => !open);
  }, []);

  return {
    messages,
    input,
    sending,
    sessionId,
    loadingSession,
    showSessions,
    sessionError,
    sessions,
    sessionsSource,
    sessionsError,
    setInput,
    send,
    newChat,
    loadSession,
    toggleSessions,
  };
}

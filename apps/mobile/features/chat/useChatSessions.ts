import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "../../lib/client";
import type { ChatSession } from "@research-copilot/types";
import { getRecords } from "../sync/localStore";

export type ChatSessionsSource = "server" | "synced" | "unavailable";

const LOAD_UNAVAILABLE = "无法加载对话列表，请检查后端连接";

function sessionTime(session: ChatSession): number {
  const raw = session.updated_at || session.created_at;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function sortLocalSessions(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((a, b) => sessionTime(b) - sessionTime(a));
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<ChatSessionsSource>("unavailable");
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyIfMounted = useCallback((fn: () => void) => {
    if (mountedRef.current) fn();
  }, []);

  const load = useCallback(async () => {
    applyIfMounted(() => setLoading(true));
    try {
      const data = await apiClient.chat.listSessions();
      applyIfMounted(() => {
        setSessions(data);
        setSource("server");
        setError(null);
      });
    } catch {
      try {
        const local = await getRecords<ChatSession>("chat_sessions");
        if (local.length > 0) {
          applyIfMounted(() => {
            setSessions(sortLocalSessions(local));
            setSource("synced");
            setError(null);
          });
        } else {
          applyIfMounted(() => {
            setSessions([]);
            setSource("unavailable");
            setError(LOAD_UNAVAILABLE);
          });
        }
      } catch {
        applyIfMounted(() => {
          setSessions([]);
          setSource("unavailable");
          setError(LOAD_UNAVAILABLE);
        });
      }
    } finally {
      applyIfMounted(() => setLoading(false));
    }
  }, [applyIfMounted]);

  useEffect(() => {
    void load();
  }, [load]);

  return { sessions, loading, source, error, reload: load };
}

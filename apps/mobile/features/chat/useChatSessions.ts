import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../../lib/client";
import type { ChatSession } from "@research-copilot/types";

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.chat.listSessions();
      setSessions(data);
    } catch {
      // Session list is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { sessions, loading, reload: load };
}

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../../lib/client";
import type { Paper } from "@research-copilot/types";

export function usePaperDetail(id: string) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.papers.get(id);
      setPaper(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载论文详情失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { paper, loading, error, reload: load };
}

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../lib/client";
import type { Paper, ResearchInterest } from "@research-copilot/types";

interface WorkbenchData {
  interests: ResearchInterest[];
  recentPapers: Paper[];
}

const RECENT_PAPER_LIMIT = 5;

export function useWorkbench() {
  const [data, setData] = useState<WorkbenchData>({ interests: [], recentPapers: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      // 任一子请求失败都不应让整个工作台空白，逐项兜底为空。
      const [interests, papers] = await Promise.all([
        apiClient.knowledge.listInterests().catch(() => [] as ResearchInterest[]),
        apiClient.papers.list(0, RECENT_PAPER_LIMIT).catch(() => [] as Paper[]),
      ]);
      setData({ interests, recentPapers: papers });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  return { ...data, loading, refreshing, refresh };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../lib/client";
import type { Paper, ResearchInterest } from "@research-copilot/types";
import { getRecords } from "../sync/localStore";

export type WorkbenchSource = "server" | "mixed" | "synced" | "unavailable";

interface WorkbenchData {
  interests: ResearchInterest[];
  recentPapers: Paper[];
}

const RECENT_PAPER_LIMIT = 5;
const LOAD_UNAVAILABLE = "无法加载工作台，请检查后端连接";
const LOCAL_EMPTY = "后端不可用，且没有可用的同步副本";

function recordTime(item: { updated_at?: string; created_at?: string }): number {
  const raw = item.updated_at || item.created_at || "";
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function sortByRecency<T extends { updated_at?: string; created_at?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => recordTime(b) - recordTime(a));
}

async function loadInterests(): Promise<{ items: ResearchInterest[]; fromServer: boolean; synced: boolean }> {
  try {
    const items = await apiClient.knowledge.listInterests();
    return { items, fromServer: true, synced: false };
  } catch {
    try {
      const local = await getRecords<ResearchInterest>("research_interests");
      if (local.length > 0) {
        return { items: sortByRecency(local), fromServer: false, synced: true };
      }
    } catch {
      // 本地读取失败视为无可用同步数据
    }
    return { items: [], fromServer: false, synced: false };
  }
}

async function loadPapers(): Promise<{ items: Paper[]; fromServer: boolean; synced: boolean }> {
  try {
    const items = await apiClient.papers.list(0, RECENT_PAPER_LIMIT);
    return { items, fromServer: true, synced: false };
  } catch {
    try {
      const local = await getRecords<Paper>("papers");
      if (local.length > 0) {
        return { items: sortByRecency(local).slice(0, RECENT_PAPER_LIMIT), fromServer: false, synced: true };
      }
    } catch {
      // 本地读取失败视为无可用同步数据
    }
    return { items: [], fromServer: false, synced: false };
  }
}

function resolveSource(interestSynced: boolean, paperSynced: boolean, interestServer: boolean, paperServer: boolean): WorkbenchSource {
  if (interestServer && paperServer) return "server";
  if ((interestServer && paperSynced) || (paperServer && interestSynced)) return "mixed";
  if (!interestServer && !paperServer && (interestSynced || paperSynced)) return "synced";
  return "unavailable";
}

export function useWorkbench() {
  const [data, setData] = useState<WorkbenchData>({ interests: [], recentPapers: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState<WorkbenchSource>("unavailable");
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

  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      applyIfMounted(() => setLoading(true));
    }

    try {
      const [interestsResult, papersResult] = await Promise.all([
        loadInterests(),
        loadPapers(),
      ]);

      const nextSource = resolveSource(
        interestsResult.synced,
        papersResult.synced,
        interestsResult.fromServer,
        papersResult.fromServer,
      );

      applyIfMounted(() => {
        setData({
          interests: interestsResult.items,
          recentPapers: papersResult.items,
        });
        setSource(nextSource);
        setError(nextSource === "unavailable"
          ? (interestsResult.fromServer || papersResult.fromServer ? LOAD_UNAVAILABLE : LOCAL_EMPTY)
          : null);
      });
    } catch {
      applyIfMounted(() => {
        setData({ interests: [], recentPapers: [] });
        setSource("unavailable");
        setError(LOAD_UNAVAILABLE);
      });
    } finally {
      applyIfMounted(() => {
        setLoading(false);
        setRefreshing(false);
      });
    }
  }, [applyIfMounted]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    applyIfMounted(() => setRefreshing(true));
    await load(true);
  }, [applyIfMounted, load]);

  return { ...data, loading, refreshing, refresh, source, error };
}

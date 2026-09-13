import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Paper } from "@research-copilot/types";
import { apiClient } from "../../lib/client";
import { getRecords } from "../sync/localStore";

export type PaperLibrarySource = "server" | "synced" | "unavailable";

const LOAD_UNAVAILABLE = "无法加载论文库，请检查后端连接";
const LOCAL_EMPTY = "后端不可用，且没有可用的同步副本";
const READONLY_COPY = "当前为只读同步副本，连接后端后才能分析";
const ANALYZE_FAILED = "分析未启动，请检查网络或稍后重试";
const ANALYZE_UNAVAILABLE = "无法连接后端，暂时不能分析";

function paperTime(paper: Paper): number {
  const raw = paper.updated_at || paper.created_at;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function sortLocalPapers(papers: Paper[]): Paper[] {
  return [...papers].sort((a, b) => paperTime(b) - paperTime(a));
}

export function usePaperLibrary() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState<PaperLibrarySource>("unavailable");
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const analyzingIdsRef = useRef(new Set<string>());
  const sourceRef = useRef(source);
  sourceRef.current = source;

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
      const data = await apiClient.papers.list();
      applyIfMounted(() => {
        setPapers(data);
        setSource("server");
        setError(null);
      });
    } catch {
      try {
        const local = await getRecords<Paper>("papers");
        if (local.length > 0) {
          applyIfMounted(() => {
            setPapers(sortLocalPapers(local));
            setSource("synced");
            setError(null);
          });
        } else {
          applyIfMounted(() => {
            setPapers([]);
            setSource("unavailable");
            setError(LOCAL_EMPTY);
          });
        }
      } catch {
        applyIfMounted(() => {
          setPapers([]);
          setSource("unavailable");
          setError(LOAD_UNAVAILABLE);
        });
      }
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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const analyze = useCallback(async (id: string) => {
    if (sourceRef.current !== "server") {
      applyIfMounted(() => {
        setError(sourceRef.current === "synced" ? READONLY_COPY : ANALYZE_UNAVAILABLE);
      });
      return;
    }

    if (analyzingIdsRef.current.has(id)) return;

    const previousPaper = papers.find((p) => p.id === id);
    if (previousPaper?.status === "analyzing") return;

    setPapers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "analyzing" } : p)),
    );

    analyzingIdsRef.current.add(id);

    try {
      const result = (await apiClient.papers.analyze(id)) as { job_id?: string };
      if (result?.job_id) {
        for await (const job of apiClient.jobs.poll(result.job_id)) {
          if (!mountedRef.current) break;
          setProgressMap((prev) => ({ ...prev, [id]: job.progress }));
          if (job.status === "done" || job.status === "failed") {
            break;
          }
        }
      }
      await load(true);
      applyIfMounted(() => {
        setProgressMap((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      });
    } catch {
      applyIfMounted(() => {
        if (previousPaper) {
          setPapers((prev) => prev.map((p) => (p.id === id ? previousPaper : p)));
        }
        setError(ANALYZE_FAILED);
      });
    } finally {
      analyzingIdsRef.current.delete(id);
    }
  }, [applyIfMounted, load, papers]);

  const canAnalyze = useMemo(() => source === "server", [source]);

  return {
    papers,
    progressMap,
    loading,
    refreshing,
    source,
    error,
    refresh,
    analyze,
    canAnalyze,
    clearError,
  };
}

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { apiClient } from "../../lib/client";
import type { Paper } from "@research-copilot/types";
import { getRecord } from "../sync/localStore";

export type PaperDetailSource = "server" | "synced" | "unavailable";

const LOAD_UNAVAILABLE = "无法加载论文详情，请检查后端连接";
const READONLY_COPY = "当前为只读同步副本，连接后端后才能分析";
const ANALYZE_FAILED = "分析未启动，请检查网络或稍后重试";
const ANALYZE_UNAVAILABLE = "无法连接后端，暂时不能分析";

export function usePaperDetail(id: string | undefined) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<PaperDetailSource>("unavailable");
  const [analyzing, setAnalyzing] = useState(false);

  const mountedRef = useRef(true);
  const analyzingRef = useRef(false);
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

  const load = useCallback(async () => {
    if (!id) {
      applyIfMounted(() => {
        setPaper(null);
        setSource("unavailable");
        setError(LOAD_UNAVAILABLE);
        setLoading(false);
      });
      return;
    }

    applyIfMounted(() => {
      setLoading(true);
      setError(null);
    });

    try {
      const data = await apiClient.papers.get(id);
      applyIfMounted(() => {
        setPaper(data);
        setSource("server");
        setError(null);
      });
    } catch {
      try {
        const local = await getRecord<Paper>("papers", id);
        if (local) {
          applyIfMounted(() => {
            setPaper(local);
            setSource("synced");
            setError(null);
          });
        } else {
          applyIfMounted(() => {
            setPaper(null);
            setSource("unavailable");
            setError(LOAD_UNAVAILABLE);
          });
        }
      } catch {
        applyIfMounted(() => {
          setPaper(null);
          setSource("unavailable");
          setError(LOAD_UNAVAILABLE);
        });
      }
    } finally {
      applyIfMounted(() => setLoading(false));
    }
  }, [id, applyIfMounted]);

  useEffect(() => {
    void load();
  }, [load]);

  const analyze = useCallback(async () => {
    if (!id) {
      applyIfMounted(() => setError(ANALYZE_UNAVAILABLE));
      return;
    }

    if (sourceRef.current !== "server") {
      applyIfMounted(() => {
        setError(sourceRef.current === "synced" ? READONLY_COPY : ANALYZE_UNAVAILABLE);
      });
      return;
    }

    if (analyzingRef.current) return;
    analyzingRef.current = true;
    applyIfMounted(() => setAnalyzing(true));

    try {
      await apiClient.papers.analyze(id);
      await load();
    } catch {
      applyIfMounted(() => setError(ANALYZE_FAILED));
    } finally {
      analyzingRef.current = false;
      applyIfMounted(() => setAnalyzing(false));
    }
  }, [id, applyIfMounted, load]);

  const canAnalyze = useMemo(() => source === "server", [source]);

  return { paper, loading, error, source, analyzing, canAnalyze, reload: load, analyze };
}

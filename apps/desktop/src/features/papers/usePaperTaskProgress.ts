import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Paper } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";
import {
  expectedPaperTaskFinalStatuses,
  initialPaperTaskProgress,
  progressForPendingPaperCompletions,
  progressFromPaperStatusEvent,
  type PaperStatusEventPayload,
  type PaperTaskFinalStatus,
  type PaperTaskMode,
  type PaperTaskProgress,
} from "./shared";

interface UsePaperTaskProgressOptions {
  setPapers: Dispatch<SetStateAction<Paper[]>>;
  setError: (message: string) => void;
}

export function usePaperTaskProgress({ setPapers, setError }: UsePaperTaskProgressOptions) {
  const pendingTasks = useRef(new Map<string, Set<PaperTaskFinalStatus>>());
  const fetchRequestSeq = useRef(new Map<string, number>());
  const [taskProgressByPaperId, setTaskProgressByPaperId] = useState<Record<string, PaperTaskProgress>>({});

  const clearPaperTaskProgress = useCallback((paperId: string) => {
    setTaskProgressByPaperId((prev) => {
      if (!(paperId in prev)) return prev;
      const next = { ...prev };
      delete next[paperId];
      return next;
    });
  }, []);

  const markPaperTaskStarted = useCallback((paperId: string, mode: PaperTaskMode) => {
    pendingTasks.current.set(paperId, new Set(expectedPaperTaskFinalStatuses(mode)));
    setTaskProgressByPaperId((prev) => ({
      ...prev,
      [paperId]: initialPaperTaskProgress(mode),
    }));
  }, []);

  const markPaperTaskFailed = useCallback((paperId: string) => {
    pendingTasks.current.delete(paperId);
    clearPaperTaskProgress(paperId);
  }, [clearPaperTaskProgress]);

  useEffect(() => {
    const fetchPaperSnapshot = (
      paperId: string,
      applySnapshot: (latest: Paper, current: Paper) => Paper,
    ) => {
      const nextSeq = (fetchRequestSeq.current.get(paperId) ?? 0) + 1;
      fetchRequestSeq.current.set(paperId, nextSeq);

      void apiClient.papers.get(paperId)
        .then((latest) => {
          if (fetchRequestSeq.current.get(paperId) !== nextSeq) return;
          setPapers((prev) =>
            prev.map((paper) => (paper.id === paperId ? applySnapshot(latest, paper) : paper))
          );
        })
        .catch((fetchError) => {
          if (fetchRequestSeq.current.get(paperId) === nextSeq) {
            setError(formatErrorMessage(fetchError));
          }
        });
    };

    const fetchLatestPaper = (paperId: string) => {
      clearPaperTaskProgress(paperId);
      fetchPaperSnapshot(paperId, (latest) => latest);
    };

    const unlisten = listen<PaperStatusEventPayload>("paper:status", (event) => {
      const { paper_id: paperId, status, error } = event.payload;

      if (status === "analyzed" || status === "reproduced") {
        const finalStatus = status as PaperTaskFinalStatus;
        const pending = pendingTasks.current.get(paperId);
        if (pending?.has(finalStatus)) {
          pending.delete(finalStatus);
          if (pending.size === 0) {
            pendingTasks.current.delete(paperId);
            fetchLatestPaper(paperId);
          } else {
            setTaskProgressByPaperId((prev) => ({
              ...prev,
              [paperId]: progressForPendingPaperCompletions(pending, prev[paperId]),
            }));
          }
          return;
        }

        fetchLatestPaper(paperId);
        return;
      }

      if (status === "metadata") {
        fetchPaperSnapshot(paperId, (latest, current) => ({ ...latest, status: current.status }));
        return;
      }

      if (status === "parsed") {
        fetchLatestPaper(paperId);
        return;
      }

      if (status === "error" || status === "failed") {
        pendingTasks.current.delete(paperId);
        clearPaperTaskProgress(paperId);
        setPapers((prev) => prev.map((paper) => (paper.id === paperId ? { ...paper, status } : paper)));
        if (error) setError(error);
        return;
      }

      if (status === "analyzing") {
        setTaskProgressByPaperId((prev) => ({
          ...prev,
          [paperId]: progressFromPaperStatusEvent(event.payload, prev[paperId]),
        }));
      }

      setPapers((prev) => prev.map((paper) => (paper.id === paperId ? { ...paper, status } : paper)));
    });

    return () => {
      void unlisten.then((cleanup) => cleanup());
    };
  }, [clearPaperTaskProgress, setError, setPapers]);

  return {
    taskProgressByPaperId,
    markPaperTaskStarted,
    markPaperTaskFailed,
    clearPaperTaskProgress,
  };
}

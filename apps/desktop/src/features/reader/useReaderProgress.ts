import { useCallback, useEffect, useState } from "react";

export interface ReaderProgressState {
  page: number;
  totalPages: number;
  percent: number;
  updatedAt: string;
}

const EMPTY_PROGRESS: ReaderProgressState = { page: 1, totalPages: 0, percent: 0, updatedAt: "" };

function storageKey(paperId: string) {
  return `xiaoyan:reader-progress:${paperId}`;
}

function readProgress(paperId?: string) {
  if (!paperId) return EMPTY_PROGRESS;
  try {
    const raw = localStorage.getItem(storageKey(paperId));
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<ReaderProgressState>;
    return {
      page: Math.max(1, Number(parsed.page) || 1),
      totalPages: Math.max(0, Number(parsed.totalPages) || 0),
      percent: Math.min(100, Math.max(0, Number(parsed.percent) || 0)),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** 每篇论文独立保存最后阅读页与完成度，切换论文时自动恢复。 */
export function useReaderProgress(paperId?: string) {
  const [progress, setProgress] = useState<ReaderProgressState>(() => readProgress(paperId));

  useEffect(() => {
    setProgress(readProgress(paperId));
  }, [paperId]);

  const recordProgress = useCallback((next: Omit<ReaderProgressState, "updatedAt">) => {
    if (!paperId) return;
    const value = { ...next, updatedAt: new Date().toISOString() };
    setProgress(value);
    try {
      localStorage.setItem(storageKey(paperId), JSON.stringify(value));
    } catch {
      // 本地存储不可用时保留当前会话进度。
    }
  }, [paperId]);

  return { progress, initialPage: progress.page, recordProgress };
}

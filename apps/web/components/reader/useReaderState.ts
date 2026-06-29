"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────

export interface ReaderState {
  scale: number;
  scrollTop: number;
}

// ── Constants ──────────────────────────────────────────────

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const STORAGE_KEY_PREFIX = "xiaoyan_reader_state";

// ── Pure helpers ───────────────────────────────────────────

export function readerStateKey(paperId: string): string {
  return `${STORAGE_KEY_PREFIX}:${paperId}`;
}

export function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

export function loadReaderState(paperId: string): ReaderState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(readerStateKey(paperId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReaderState>;
    if (typeof parsed.scale !== "number" || typeof parsed.scrollTop !== "number") {
      return null;
    }
    return {
      scale: clampScale(parsed.scale),
      scrollTop: Math.max(0, parsed.scrollTop),
    };
  } catch {
    return null;
  }
}

export function saveReaderState(paperId: string, state: ReaderState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      readerStateKey(paperId),
      JSON.stringify({
        scale: clampScale(state.scale),
        scrollTop: Math.max(0, state.scrollTop),
      }),
    );
  } catch {
    // Ignore storage errors (e.g. quota exceeded, private mode).
  }
}

// ── Hook ───────────────────────────────────────────────────

export function useReaderState(paperId: string) {
  const [state, setState] = useState<ReaderState | null>(null);

  useEffect(() => {
    setState(loadReaderState(paperId));
  }, [paperId]);

  const saveState = useCallback(
    (next: ReaderState) => {
      saveReaderState(paperId, next);
    },
    [paperId],
  );

  return { state, saveState };
}

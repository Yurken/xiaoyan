import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoteDockSide } from "../readerTypes";
import {
  NOTE_DOCK_DEFAULT_WIDTH,
  clampNoteDockWidth,
  resolveNoteDockLayout,
  type NoteDockMode,
} from "./dockLayout";

const PREFS_KEY = "xiaoyan.reader.noteDocks.v1";
const SIDES_KEY = "xiaoyan.reader.noteSides.v1";
/** 右侧图标栏固定宽度（ReaderRightRail 的 w-10）。 */
const READER_RAIL_WIDTH = 40;
const FLASH_MS = 2200;
const SAVE_DEBOUNCE_MS = 240;

interface NoteDockPreferences {
  open: Record<NoteDockSide, boolean>;
  /** 两栏共用同一个宽度。 */
  width: number;
  /** 最近操作的一栏：空间只够一栏时保留它。 */
  priority: NoteDockSide;
}

const DEFAULT_PREFERENCES: NoteDockPreferences = {
  open: { left: true, right: true },
  width: NOTE_DOCK_DEFAULT_WIDTH,
  priority: "left",
};

function readStoredPreferences(): NoteDockPreferences {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<NoteDockPreferences> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_PREFERENCES;
    return {
      open: {
        left: typeof parsed.open?.left === "boolean" ? parsed.open.left : DEFAULT_PREFERENCES.open.left,
        right: typeof parsed.open?.right === "boolean" ? parsed.open.right : DEFAULT_PREFERENCES.open.right,
      },
      width: clampNoteDockWidth(typeof parsed.width === "number" ? parsed.width : DEFAULT_PREFERENCES.width),
      priority: parsed.priority === "right" ? "right" : "left",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function readStoredSides(): Record<string, NoteDockSide> {
  try {
    const raw = window.localStorage.getItem(SIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return {};
    const sides: Record<string, NoteDockSide> = {};
    for (const [noteId, side] of Object.entries(parsed)) {
      if (side === "left" || side === "right") sides[noteId] = side;
    }
    return sides;
  } catch {
    return {};
  }
}

interface UseReaderNoteDocksOptions {
  navOpen: boolean;
  navWidth: number;
  auxOpen: boolean;
  auxWidth: number;
}

/**
 * 左右笔记栏的开关、宽度与自适应。
 *
 * 开关和宽度是用户意图（会持久化），实际是否展开还要看阅读行剩余空间：
 * resolveNoteDockLayout 会在空间不足时收窄、只保留最近操作的一栏、最后退化为细缝，
 * 阅读区始终不小于最小宽度——栏位只会推开正文，不会盖住正文。
 *
 * 批注落在哪一栏由坐标推导（见 dockLayout）；只有「手动换到另一栏」需要记住，
 * 因此单独存一份 noteId → side 的本地偏好，改动面只停留在展示层。
 */
export function useReaderNoteDocks({ navOpen, navWidth, auxOpen, auxWidth }: UseReaderNoteDocksOptions) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const [preferences, setPreferences] = useState<NoteDockPreferences>(readStoredPreferences);
  const [sideOverrides, setSideOverrides] = useState<Record<string, NoteDockSide>>(readStoredSides);
  const [flashNoteId, setFlashNoteId] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;
    const measure = () => setRowWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 拖动改宽会高频触发，落盘合并到停顿后一次。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
      } catch {
        // 存储不可用时只保留本次会话的布局。
      }
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [preferences]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(SIDES_KEY, JSON.stringify(sideOverrides));
      } catch {
        // 同上：换栏只是展示偏好，存不下也不影响批注本身。
      }
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [sideOverrides]);

  const layout = useMemo(() => resolveNoteDockLayout({
    rowWidth,
    navWidth: navOpen ? navWidth : 0,
    railWidth: READER_RAIL_WIDTH,
    auxWidth: auxOpen ? auxWidth : 0,
    open: preferences.open,
    width: preferences.width,
    priority: preferences.priority,
  }), [rowWidth, navOpen, navWidth, auxOpen, auxWidth, preferences]);

  const setOpen = useCallback((side: NoteDockSide, open: boolean) => {
    setPreferences((previous) => ({
      ...previous,
      open: { ...previous.open, [side]: open },
      ...(open ? { priority: side } : {}),
    }));
  }, []);

  const expand = useCallback((side: NoteDockSide) => setOpen(side, true), [setOpen]);
  const collapse = useCallback((side: NoteDockSide) => setOpen(side, false), [setOpen]);

  const toggle = useCallback((side: NoteDockSide) => {
    setPreferences((previous) => ({
      ...previous,
      open: { ...previous.open, [side]: !previous.open[side] },
      priority: side,
    }));
  }, []);

  const setWidth = useCallback((width: number) => {
    setPreferences((previous) => ({ ...previous, width: clampNoteDockWidth(width) }));
  }, []);

  const moveNote = useCallback((noteId: string, side: NoteDockSide) => {
    setSideOverrides((previous) => ({ ...previous, [noteId]: side }));
  }, []);

  const forgetNote = useCallback((noteId: string) => {
    setSideOverrides((previous) => {
      if (!(noteId in previous)) return previous;
      const next = { ...previous };
      delete next[noteId];
      return next;
    });
  }, []);

  const flashNote = useCallback((noteId: string) => {
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    setFlashNoteId(noteId);
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      setFlashNoteId(null);
    }, FLASH_MS);
  }, []);

  useEffect(() => () => {
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
  }, []);

  const modeOf = useCallback((side: NoteDockSide): NoteDockMode => layout.modes[side], [layout]);

  return {
    rowRef,
    rowWidth,
    layout,
    preferences,
    sideOverrides,
    flashNoteId,
    modeOf,
    setOpen,
    expand,
    collapse,
    toggle,
    setWidth,
    moveNote,
    forgetNote,
    flashNote,
  };
}

export type ReaderNoteDocks = ReturnType<typeof useReaderNoteDocks>;

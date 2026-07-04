import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { findLineNoteAtPoint, normalizedPointFromClient, notePopupPoint } from "./highlightHitTesting";
import type { PaperNote } from "./readerTypes";

interface PageSize {
  w: number;
  h: number;
}

interface HoveredNote {
  note: PaperNote;
  x: number;
  y: number;
}

interface UseLineHighlightInteractionOptions {
  pageNotes: PaperNote[];
  pageSize: PageSize | null;
  onNoteClick: (note: PaperNote, point: { x: number; y: number }) => void;
}

function isShapeOverlayTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest(".pdf-highlight-overlay:not(.pdf-text-highlight-overlay)");
}

function hasActiveTextSelection() {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim().length > 0);
}

export function useLineHighlightInteraction({
  pageNotes,
  pageSize,
  onNoteClick,
}: UseLineHighlightInteractionOptions) {
  const [hoveredNote, setHoveredNote] = useState<HoveredNote | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const showNoteHover = useCallback((note: PaperNote, x: number, y: number) => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    if (note.content?.trim()) setHoveredNote({ note, x, y });
  }, []);

  const scheduleHoverClear = useCallback(() => {
    hoverTimeoutRef.current = window.setTimeout(() => setHoveredNote(null), 120);
  }, []);

  const findLineNoteFromEvent = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const pageRect = event.currentTarget.getBoundingClientRect();
      const point = normalizedPointFromClient(event.clientX, event.clientY, pageRect);
      if (!point) return null;
      const hit = findLineNoteAtPoint(pageNotes, point);
      return hit ? { ...hit, pageRect } : null;
    },
    [pageNotes],
  );

  const handlePageClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (isShapeOverlayTarget(event.target) || hasActiveTextSelection()) return;

      const hit = findLineNoteFromEvent(event);
      if (!hit) return;
      event.stopPropagation();
      onNoteClick(hit.note, notePopupPoint(hit.pageRect, hit.rect));
    },
    [findLineNoteFromEvent, onNoteClick],
  );

  const handlePageMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (isShapeOverlayTarget(event.target) || !pageSize || hasActiveTextSelection()) return;

      const hit = findLineNoteFromEvent(event);
      if (!hit || !hit.note.content?.trim()) {
        setHoveredNote(null);
        return;
      }
      showNoteHover(hit.note, hit.rect.x * pageSize.w, hit.rect.y * pageSize.h);
    },
    [findLineNoteFromEvent, pageSize, showNoteHover],
  );

  return {
    hoveredNote,
    showNoteHover,
    scheduleHoverClear,
    handlePageClick,
    handlePageMouseMove,
    handlePageMouseLeave: scheduleHoverClear,
  };
}

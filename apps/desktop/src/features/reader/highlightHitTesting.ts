import { isShapeStyle, mergeNormalizedRects, type NormalizedRect, type PaperNote } from "./readerTypes";

interface PagePoint {
  x: number;
  y: number;
}

interface NoteHit {
  note: PaperNote;
  rect: NormalizedRect;
}

const HIT_SLOP = 0.003;

function containsPoint(rect: NormalizedRect, point: PagePoint) {
  return (
    point.x >= rect.x - HIT_SLOP &&
    point.x <= rect.x + rect.w + HIT_SLOP &&
    point.y >= rect.y - HIT_SLOP &&
    point.y <= rect.y + rect.h + HIT_SLOP
  );
}

export function normalizedPointFromClient(clientX: number, clientY: number, pageRect: DOMRect): PagePoint | null {
  if (pageRect.width === 0 || pageRect.height === 0) return null;
  return {
    x: (clientX - pageRect.left) / pageRect.width,
    y: (clientY - pageRect.top) / pageRect.height,
  };
}

export function findLineNoteAtPoint(notes: PaperNote[], point: PagePoint): NoteHit | null {
  for (let noteIndex = notes.length - 1; noteIndex >= 0; noteIndex--) {
    const note = notes[noteIndex];
    if (isShapeStyle(note.style)) continue;

    const rects = mergeNormalizedRects(note.highlight_positions ?? []);
    for (let rectIndex = rects.length - 1; rectIndex >= 0; rectIndex--) {
      const rect = rects[rectIndex];
      if (containsPoint(rect, point)) return { note, rect };
    }
  }
  return null;
}

export function notePopupPoint(pageRect: DOMRect, rect: NormalizedRect) {
  return {
    x: pageRect.left + (rect.x + rect.w / 2) * pageRect.width,
    y: pageRect.top + rect.y * pageRect.height,
  };
}

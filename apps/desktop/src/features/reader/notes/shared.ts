import type { AnnotationStyle, HighlightColor, NormalizedRect, PaperNote } from "../readerTypes";

export interface CreateAnnotationInput {
  page: number;
  highlightText: string;
  color: HighlightColor;
  style: AnnotationStyle;
  positions: NormalizedRect[];
  content?: string;
  fillColor?: HighlightColor | null;
}

export type AnnotationPatch = Partial<Pick<PaperNote,
  "content" | "highlight_color" | "fill_color" | "highlight_positions"
>>;

export type ReaderNoteUndoEntry =
  | { kind: "remove"; id: string }
  | { kind: "restore"; note: PaperNote }
  | { kind: "update"; id: string; patch: AnnotationPatch };

export const MAX_READER_NOTE_UNDO = 100;

export function hasAnnotationChanges(note: PaperNote, patch: AnnotationPatch) {
  return Object.entries(patch).some(([field, value]) =>
    JSON.stringify(note[field as keyof AnnotationPatch]) !== JSON.stringify(value));
}

export function previousAnnotationPatch(note: PaperNote, patch: AnnotationPatch): AnnotationPatch {
  const previous: AnnotationPatch = {};
  if ("content" in patch) previous.content = note.content;
  if ("highlight_color" in patch) previous.highlight_color = note.highlight_color;
  if ("fill_color" in patch) previous.fill_color = note.fill_color;
  if ("highlight_positions" in patch) previous.highlight_positions = note.highlight_positions;
  return previous;
}

export function annotationUpdatePayload(patch: AnnotationPatch) {
  return {
    ...("content" in patch ? { content: patch.content } : {}),
    ...("highlight_color" in patch ? { highlight_color: patch.highlight_color } : {}),
    ...("fill_color" in patch ? { fill_color: patch.fill_color ?? "none" } : {}),
    ...("highlight_positions" in patch ? { highlight_positions: patch.highlight_positions ?? [] } : {}),
  };
}

/** 恢复删除会生成新的数据库 ID，之前的撤销项必须继续指向同一批注。 */
export function remapReaderNoteUndoIds(entries: ReaderNoteUndoEntry[], previousId: string, nextId: string) {
  return entries.map((entry): ReaderNoteUndoEntry => {
    if (entry.kind === "restore") {
      return entry.note.id === previousId ? { ...entry, note: { ...entry.note, id: nextId } } : entry;
    }
    return entry.id === previousId ? { ...entry, id: nextId } : entry;
  });
}

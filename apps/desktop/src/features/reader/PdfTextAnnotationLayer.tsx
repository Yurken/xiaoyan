import { useCallback, useEffect, useState } from "react";
import TextAnnotationInput from "./TextAnnotationInput";
import {
  boundingRect,
  HIGHLIGHT_COLORS,
  isTextStyle,
  type HighlightColor,
  type NormalizedRect,
  type PaperNote,
} from "./readerTypes";
import { clampTextAnnotationInputPosition, createTextAnnotationRect } from "./readerTextAnnotations";

interface PdfTextAnnotationLayerProps {
  page: number;
  pageSize: { w: number; h: number };
  notes: PaperNote[];
  enabled: boolean;
  color?: HighlightColor;
  onCreate?: (page: number, rect: NormalizedRect, content: string) => void;
  onUpdate?: (note: PaperNote, content: string) => void;
  onDelete?: (note: PaperNote) => void;
  onColorChange?: (note: PaperNote, color: HighlightColor) => void;
  onMove?: (note: PaperNote, rect: NormalizedRect) => void;
}

/** 自由文字批注层：负责创建、原位编辑与拖动，不把交互状态留在 PDF 页面组件中。 */
export default function PdfTextAnnotationLayer({
  page,
  pageSize,
  notes,
  enabled,
  color,
  onCreate,
  onUpdate,
  onDelete,
  onColorChange,
  onMove,
}: PdfTextAnnotationLayerProps) {
  const [draft, setDraft] = useState<NormalizedRect | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ id: string; rect: NormalizedRect } | null>(null);

  useEffect(() => {
    if (!enabled) setDraft(null);
  }, [enabled]);

  const startCreate = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!enabled || !onCreate) return;
      event.preventDefault();
      event.stopPropagation();
      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      setDraft(createTextAnnotationRect(event.clientX, event.clientY, bounds));
      setEditingId(null);
    },
    [enabled, onCreate],
  );

  const startMove = useCallback(
    (event: React.MouseEvent, note: PaperNote, box: NormalizedRect) => {
      event.stopPropagation();
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const pageRect = (event.currentTarget.closest("[data-page-num]") as HTMLElement | null)?.getBoundingClientRect();
      if (!pageRect || pageRect.width === 0 || pageRect.height === 0) return;
      let moved = false;
      const rectAt = (clientX: number, clientY: number): NormalizedRect => ({
        x: Math.min(1 - box.w, Math.max(0, box.x + (clientX - startX) / pageRect.width)),
        y: Math.min(1 - box.h, Math.max(0, box.y + (clientY - startY) / pageRect.height)),
        w: box.w,
        h: box.h,
      });
      const onPointerMove = (moveEvent: MouseEvent) => {
        if (Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3) moved = true;
        setMoving({ id: note.id, rect: rectAt(moveEvent.clientX, moveEvent.clientY) });
      };
      const onPointerUp = (upEvent: MouseEvent) => {
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
        setMoving(null);
        if (moved) onMove?.(note, rectAt(upEvent.clientX, upEvent.clientY));
        else setEditingId(note.id);
      };
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onPointerUp);
    },
    [onMove],
  );

  const textNotes = notes.filter((note) => isTextStyle(note.style));

  return (
    <>
      {textNotes.map((note) => {
        const stored = boundingRect(note.highlight_positions ?? []);
        const box = moving?.id === note.id ? moving.rect : stored;
        if (!box || !note.content.trim()) return null;
        if (editingId === note.id) {
          const inputPosition = clampTextAnnotationInputPosition(box, pageSize);
          return (
            <TextAnnotationInput
              key={note.id}
              x={inputPosition.x}
              y={inputPosition.y}
              color={note.highlight_color}
              initialContent={note.content}
              onColorChange={(nextColor) => onColorChange?.(note, nextColor)}
              onDelete={() => {
                setEditingId(null);
                onDelete?.(note);
              }}
              onCancel={() => setEditingId(null)}
              onSubmit={(content) => {
                setEditingId(null);
                onUpdate?.(note, content);
              }}
            />
          );
        }
        const noteColor = HIGHLIGHT_COLORS[note.highlight_color];
        return (
          <div
            key={note.id}
            className="pdf-highlight-overlay pdf-text-annotation-overlay absolute z-[5] select-none whitespace-pre-wrap rounded px-1.5 py-0.5 text-xs font-medium leading-5 shadow-sm"
            style={{
              left: box.x * pageSize.w,
              top: box.y * pageSize.h,
              minWidth: Math.max(88, box.w * pageSize.w),
              maxWidth: Math.max(160, box.w * pageSize.w * 1.5),
              color: noteColor.border,
              background: "color-mix(in srgb, var(--rc-card-bg) 92%, transparent)",
              border: `1px solid color-mix(in srgb, ${noteColor.border} 55%, transparent)`,
              cursor: "move",
            }}
            title="拖拽移动 · 点击直接编辑"
            onMouseDown={(event) => startMove(event, note, box)}
          >
            {note.content}
          </div>
        );
      })}

      {draft && color ? (
        <TextAnnotationInput
          x={draft.x}
          y={draft.y}
          color={color}
          onCancel={() => setDraft(null)}
          onSubmit={(content) => {
            onCreate?.(page, draft, content);
            setDraft(null);
          }}
        />
      ) : null}

      {enabled ? (
        <div
          className="absolute left-0 top-0 z-[4]"
          style={{ width: pageSize.w, height: pageSize.h, cursor: "text" }}
          onMouseDown={startCreate}
        />
      ) : null}
    </>
  );
}

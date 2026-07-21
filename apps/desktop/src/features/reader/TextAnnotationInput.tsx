import { Check, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HIGHLIGHT_COLORS, type HighlightColor } from "./readerTypes";
import { TEXT_ANNOTATION_INPUT_WIDTH } from "./readerTextAnnotations";

interface TextAnnotationInputProps {
  x: number;
  y: number;
  color: HighlightColor;
  initialContent?: string;
  onColorChange?: (color: HighlightColor) => void;
  onDelete?: () => void;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}

const colorKeys = Object.keys(HIGHLIGHT_COLORS) as HighlightColor[];

/** 在 PDF 页面上就地创建或编辑自由文本批注。 */
export default function TextAnnotationInput({
  x,
  y,
  color,
  initialContent = "",
  onColorChange,
  onDelete,
  onSubmit,
  onCancel,
}: TextAnnotationInputProps) {
  const [content, setContent] = useState(initialContent);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const value = content.trim();
    if (value) onSubmit(value);
    else onCancel();
  };

  return (
    <div
      className="absolute z-[7] rounded-md border p-1"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: TEXT_ANNOTATION_INPUT_WIDTH,
        background: "var(--rc-control-bg, var(--rc-card-bg))",
        borderColor: HIGHLIGHT_COLORS[color].border,
        boxShadow: "var(--rc-control-focus-shadow, 0 0 0 2px rgba(0,122,255,0.12))",
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <textarea
        ref={inputRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            submit();
          }
          if (event.key === "Escape") onCancel();
        }}
        placeholder="直接输入文字…"
        rows={2}
        className="rc-selectable block w-full resize-none bg-transparent px-1 py-0.5 text-xs font-medium leading-5 outline-none"
        style={{ color: HIGHLIGHT_COLORS[color].border }}
      />
      <div className="mt-1 flex items-center gap-1 border-t px-0.5 pt-1" style={{ borderColor: "var(--rc-border)" }}>
        {onColorChange
          ? colorKeys.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => onColorChange(candidate)}
              className="h-3.5 w-3.5 rounded-full border"
              style={{
                background: HIGHLIGHT_COLORS[candidate].bg,
                borderColor: color === candidate ? HIGHLIGHT_COLORS[candidate].border : "transparent",
              }}
              title={HIGHLIGHT_COLORS[candidate].label}
            />
          ))
          : null}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto flex h-5 w-5 items-center justify-center rounded text-apple-red hover:bg-apple-red/10"
            title="删除文字"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className={`${onDelete ? "" : "ml-auto "}flex h-5 w-5 items-center justify-center rounded text-ink-tertiary hover:bg-black/5`}
          title="取消"
        >
          <X className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={submit}
          className="flex h-5 w-5 items-center justify-center rounded text-white"
          style={{ background: "var(--rc-accent)" }}
          title={initialContent ? "保存文字" : "添加文字"}
        >
          <Check className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

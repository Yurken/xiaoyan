import { useState } from "react";
import { Columns2, Eye, Pencil } from "lucide-react";
import { CapsuleTabs, MarkdownRenderer } from "@research-copilot/ui";
import { useResolvedNoteContent } from "./useResolvedNoteContent";

export type MarkdownView = "edit" | "preview" | "split";

const VIEW_TABS = [
  { value: "edit", label: "编辑", icon: <Pencil className="h-3 w-3" /> },
  { value: "split", label: "分屏", icon: <Columns2 className="h-3 w-3" /> },
  { value: "preview", label: "预览", icon: <Eye className="h-3 w-3" /> },
];

const INSET_STYLE = { background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" } as const;

/**
 * 三视图 Markdown 编辑器：可单独编辑、单独预览，或左编辑右预览并排。
 * 自身撑满父容器高度，编辑区与预览区各自滚动。
 */
export default function MarkdownSplitEditor({
  value,
  onChange,
  placeholder,
  label = "内容",
  defaultView = "split",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  defaultView?: MarkdownView;
}) {
  const [view, setView] = useState<MarkdownView>(defaultView);
  const resolvedValue = useResolvedNoteContent(value);

  const editor = (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-full w-full resize-none rounded-2xl px-4 py-3 leading-relaxed text-ink-primary outline-none placeholder:text-ink-tertiary/60"
      style={{ ...INSET_STYLE, fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: "13px" }}
    />
  );

  const preview = (
    <div className="h-full overflow-y-auto rounded-2xl px-4 py-3 text-sm" style={INSET_STYLE}>
      {value.trim() ? (
        <MarkdownRenderer content={resolvedValue} />
      ) : (
        <p className="text-xs text-ink-tertiary/60">{placeholder ?? "暂无内容"}</p>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-tertiary">{label}</span>
          <span className="text-[10px] font-normal text-ink-tertiary/60">支持 Markdown</span>
        </div>
        <CapsuleTabs compact options={VIEW_TABS} value={view} onChange={(next) => setView(next as MarkdownView)} />
      </div>

      <div className="min-h-0 flex-1">
        {view === "edit" ? (
          editor
        ) : view === "preview" ? (
          preview
        ) : (
          <div className="grid h-full min-h-0 grid-cols-2 gap-3">
            {editor}
            {preview}
          </div>
        )}
      </div>
    </div>
  );
}

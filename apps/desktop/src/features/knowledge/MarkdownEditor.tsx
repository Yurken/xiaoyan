import { useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { MarkdownRenderer } from "@research-copilot/ui";

export default function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between ml-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-tertiary">{label}</span>
            <span className="text-[10px] text-ink-tertiary/60 font-normal">支持 Markdown</span>
          </div>
          <div className="flex gap-1">
            {(["edit", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all duration-100"
                style={
                  tab === t
                    ? { background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)", color: "#1C1C1E" }
                    : { color: "#8E8E93" }
                }
              >
                {t === "edit" ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {t === "edit" ? "编辑" : "预览"}
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-none rounded-2xl px-4 py-3 text-sm text-ink-primary outline-none placeholder:text-ink-tertiary/60 leading-relaxed"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)", fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: "12px" }}
        />
      ) : (
        <div
          className="min-h-[120px] rounded-2xl px-4 py-3 text-sm"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
        >
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-ink-tertiary/60 text-xs">{placeholder}</p>
          )}
        </div>
      )}
    </div>
  );
}

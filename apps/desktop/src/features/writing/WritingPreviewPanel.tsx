import { useState } from "react";
import { clsx } from "clsx";
import { BookOpen, FileText, ListTree } from "lucide-react";
import { CapsuleTabs } from "@research-copilot/ui";
import WritingRenderedLatexPreview from "./WritingRenderedLatexPreview";
import type { LatexPreviewBlock } from "./shared";

type PreviewMode = "structure" | "text";

const PREVIEW_MODE_OPTIONS = [
  { value: "text", label: "文本", icon: <FileText className="h-3.5 w-3.5" /> },
  { value: "structure", label: "结构", icon: <ListTree className="h-3.5 w-3.5" /> },
] as const;

interface WritingPreviewPanelProps {
  blocks: LatexPreviewBlock[];
  source: string;
  compact: boolean;
}

export default function WritingPreviewPanel({
  blocks,
  source,
  compact,
}: WritingPreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("text");

  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto pl-1">
      <section
        className="flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
      >
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--rc-border)" }}>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-apple-blue/10 text-apple-blue">
              <BookOpen className="h-4 w-4" />
            </div>
            <p className="text-sm font-bold tracking-tight text-ink-primary">实时预览</p>
          </div>
          <CapsuleTabs
            value={previewMode}
            onChange={(value) => setPreviewMode(value as PreviewMode)}
            options={PREVIEW_MODE_OPTIONS}
            compact
          />
        </div>

        <div className={clsx(
          "min-h-0 flex-1 overflow-y-auto p-4 space-y-4",
          compact ? "max-h-[34rem]" : "max-h-none"
        )}>
          {blocks.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center text-ink-tertiary" style={{ borderColor: "var(--rc-border)" }}>
              <p className="text-xs">暂无内容预览。</p>
            </div>
          ) : previewMode === "text" ? (
            <WritingRenderedLatexPreview source={source} />
          ) : (
            <StructurePreview blocks={blocks} />
          )}
        </div>
      </section>

    </aside>
  );
}

function StructurePreview({ blocks }: { blocks: LatexPreviewBlock[] }) {
  return (
    <>
      {blocks.map((block) => (
        <article
          key={block.id}
          className="rounded-xl border p-3.5 shadow-sm transition-shadow hover:shadow-md"
          style={{
            background: block.kind === "meta" ? "rgba(0,122,255,0.04)" : "var(--rc-card-inset-bg)",
            borderColor: "var(--rc-border)",
          }}
        >
          <div className="mb-2 flex items-center gap-2 border-b pb-2" style={{ borderColor: "var(--rc-border)" }}>
            <div
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                block.kind === "meta" ? "bg-apple-blue" : "bg-ink-tertiary/40",
              )}
            />
            <p
              className={clsx(
                "truncate text-xs tracking-tight text-ink-primary",
                block.kind === "meta" || block.level <= 1 ? "font-bold" : "font-semibold",
              )}
            >
              {block.title}
            </p>
          </div>
          {block.content ? (
            <p className="rc-selectable text-[12px] leading-relaxed text-ink-secondary">
              {block.content.length > 900 ? `${block.content.slice(0, 900)}...` : block.content}
            </p>
          ) : (
            <p className="text-[11px] italic text-ink-tertiary">该章节暂无正文内容。</p>
          )}
        </article>
      ))}
    </>
  );
}

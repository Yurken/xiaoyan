import { useState } from "react";
import { clsx } from "clsx";
import { BookOpen, FileCheck2, ListTree, RefreshCw } from "lucide-react";
import { CapsuleTabs } from "@research-copilot/ui";
import type { LatexPreviewBlock, WritingCompileStatus, WritingCompileSummary } from "./shared";
import { isLatexCompilerMissing } from "./shared";
import WritingPdfPreview from "./WritingPdfPreview";
import WritingCompileLog from "./WritingCompileLog";

type PreviewMode = "structure" | "pdf";

const PREVIEW_MODE_OPTIONS = [
  { value: "pdf", label: "PDF", icon: <FileCheck2 className="h-3.5 w-3.5" /> },
  { value: "structure", label: "结构", icon: <ListTree className="h-3.5 w-3.5" /> },
] as const;

interface WritingPreviewPanelProps {
  draftId: string;
  blocks: LatexPreviewBlock[];
  compileResult: WritingCompileSummary | null;
  previewResult: WritingCompileSummary | null;
  compileStatus: WritingCompileStatus;
  autoCompileEnabled: boolean;
  autoCompilePending: boolean;
  previewStale: boolean;
  compact: boolean;
  onAutoCompileChange: (enabled: boolean) => void;
  onCompile: () => void;
  onSavePdf: () => void;
}

export default function WritingPreviewPanel({
  draftId,
  blocks,
  compileResult,
  previewResult,
  compileStatus,
  autoCompileEnabled,
  autoCompilePending,
  previewStale,
  compact,
  onAutoCompileChange,
  onCompile,
  onSavePdf,
}: WritingPreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("pdf");
  const failed = compileResult !== null && !compileResult.success;

  return (
    <aside className="flex min-h-0 flex-col gap-4 pl-1">
      <section
        className="flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
      >
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--rc-border)" }}>
          <div className="flex items-center gap-2">
            <div className="writing-inset-icon"><BookOpen className="h-4 w-4" /></div>
            <p className="text-sm font-bold tracking-tight text-ink-primary">文稿预览</p>
          </div>
          <CapsuleTabs
            value={previewMode}
            onChange={(value) => setPreviewMode(value as PreviewMode)}
            options={PREVIEW_MODE_OPTIONS}
            compact
          />
        </div>
        {previewMode === "pdf" && (
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--rc-border)" }}>
            <button
              type="button"
              role="switch"
              aria-checked={autoCompileEnabled}
              onClick={() => onAutoCompileChange(!autoCompileEnabled)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary"
              title={autoCompileEnabled ? "关闭自动预览" : "开启自动预览"}
            >
              <span className={clsx("relative h-3.5 w-6 rounded-full transition-colors", autoCompileEnabled ? "bg-apple-blue" : "bg-ink-tertiary/30")}>
                <span className={clsx("absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform", autoCompileEnabled ? "translate-x-3" : "translate-x-0.5")} />
              </span>
              自动预览
            </button>
            <span className="ml-auto truncate text-[10px] text-ink-tertiary" role="status">
              {previewStatusLabel({ compileStatus, autoCompilePending, previewStale, failed, hasPreview: previewResult !== null, missing: isLatexCompilerMissing(compileResult) })}
            </span>
            <button
              type="button"
              onClick={onCompile}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-apple-blue/5 hover:text-apple-blue"
              title="立即编译当前版本"
              aria-label="立即编译当前版本"
            >
              <RefreshCw className={clsx("h-3.5 w-3.5", compileStatus === "compiling" && "animate-spin")} />
            </button>
          </div>
        )}
        {previewMode === "pdf" && failed && previewResult && (
          <p className="shrink-0 border-b bg-[#FF9500]/[0.07] px-3 py-2 text-[11px] leading-4 text-[#9A5B00]" style={{ borderColor: "var(--rc-border)" }}>
            当前修改未通过编译，正在显示上次成功的 PDF。
          </p>
        )}
        <div className={clsx(
          "min-h-0 flex-1 p-4",
          previewMode === "pdf" ? "overflow-hidden" : "space-y-4 overflow-y-auto",
          compact && previewMode !== "pdf" ? "max-h-[34rem]" : "max-h-none",
        )}>
          {previewMode === "pdf" ? (
            <WritingPdfPreview compileResult={previewResult} draftId={draftId} onSave={onSavePdf} />
          ) : blocks.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center text-ink-tertiary" style={{ borderColor: "var(--rc-border)" }}>
              <p className="text-xs">暂无内容预览。</p>
            </div>
          ) : <StructurePreview blocks={blocks} />}
        </div>
        {previewMode === "pdf" && compileResult && <WritingCompileLog result={compileResult} />}
      </section>
    </aside>
  );
}

function previewStatusLabel({
  compileStatus,
  autoCompilePending,
  previewStale,
  failed,
  hasPreview,
  missing,
}: {
  compileStatus: WritingCompileStatus;
  autoCompilePending: boolean;
  previewStale: boolean;
  failed: boolean;
  hasPreview: boolean;
  missing: boolean;
}) {
  if (missing) return "需要 LaTeX 环境";
  if (compileStatus === "compiling") return autoCompilePending ? "编译中 · 等待最新修改" : "正在更新 PDF";
  if (autoCompilePending) return "等待自动预览";
  if (failed) return "编译失败";
  if (previewStale) return "有未预览的修改";
  return hasPreview ? "PDF 已是最新" : "等待生成预览";
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
            <div className={clsx("h-1.5 w-1.5 rounded-full", block.kind === "meta" ? "bg-apple-blue" : "bg-ink-tertiary/40")} />
            <p className={clsx("truncate text-xs tracking-tight text-ink-primary", block.kind === "meta" || block.level <= 1 ? "font-bold" : "font-semibold")}>
              {block.title}
            </p>
          </div>
          {block.content ? (
            <p className="rc-selectable text-[12px] leading-relaxed text-ink-secondary">
              {block.content.length > 900 ? `${block.content.slice(0, 900)}...` : block.content}
            </p>
          ) : <p className="text-[11px] italic text-ink-tertiary">该章节暂无正文内容。</p>}
        </article>
      ))}
    </>
  );
}

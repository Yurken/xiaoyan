import { clsx } from "clsx";
import {
  Archive,
  CheckCircle2,
  Clipboard,
  Download,
  Eye,
  ExternalLink,
  FileCheck2,
  FileInput,
  FileText,
  LayoutPanelLeft,
  Save,
  Upload,
} from "lucide-react";
import { Button } from "@research-copilot/ui";
import WritingEditorPanel from "./WritingEditorPanel";
import WritingLatexInstallNotice from "./WritingLatexInstallNotice";
import WritingPreviewPanel from "./WritingPreviewPanel";
import WritingSidebar from "./WritingSidebar";
import {
  EXPORT_TARGET_LABELS,
  isLatexCompilerMissing,
  type WritingExportTarget,
  type WritingViewMode,
} from "./shared";
import { useWritingWorkspace } from "./useWritingWorkspace";

const VIEW_OPTIONS: Array<{ value: WritingViewMode; label: string; icon: typeof LayoutPanelLeft }> = [
  { value: "split", label: "分栏", icon: LayoutPanelLeft },
  { value: "editor", label: "源码", icon: FileText },
  { value: "preview", label: "预览", icon: Eye },
];

const EXPORT_OPTIONS: Array<{ target: WritingExportTarget; label: string }> = [
  { target: "texstudio", label: "导出 TeXstudio" },
  { target: "overleaf", label: "导出 Overleaf" },
];

export default function WritingWorkspace() {
  const workspace = useWritingWorkspace();
  const showEditor = workspace.viewMode !== "preview";
  const showPreview = workspace.viewMode !== "editor";
  const showLatexInstallNotice = isLatexCompilerMissing(workspace.compileResult);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      <header className="shrink-0 px-6 pb-4 pt-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-apple-blue/10 text-apple-blue">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-ink-primary">论文撰写</h1>
                <p className="mt-0.5 text-sm text-ink-tertiary">
                  轻量 LaTeX 工作台：源码、结构、引用和导出放在一个顺手的写作界面里。
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => void workspace.importTexFile()}>
              <Upload className="h-3.5 w-3.5" />
              导入 .tex
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void workspace.importBibFile()}>
              <FileInput className="h-3.5 w-3.5" />
              导入 .bib
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void workspace.copyMainTex()}>
              <Clipboard className="h-3.5 w-3.5" />
              复制源码
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void workspace.compilePdf()}
              loading={workspace.compileStatus === "compiling"}
              disabled={workspace.exportingTarget !== null}
            >
              {workspace.compileStatus !== "compiling" ? (
                <FileCheck2 className="h-3.5 w-3.5" />
              ) : null}
              编译 PDF
            </Button>
            {workspace.compileResult?.pdfPath ? (
              <>
                <Button type="button" size="sm" variant="ghost" onClick={() => void workspace.openCompiledPdf()}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  打开 PDF
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => void workspace.saveCompiledPdf()}>
                  <Save className="h-3.5 w-3.5" />
                  另存 PDF
                </Button>
              </>
            ) : null}
            {EXPORT_OPTIONS.map((option) => (
              <Button
                key={option.target}
                type="button"
                size="sm"
                onClick={() => void workspace.exportProject(option.target)}
                loading={workspace.exportingTarget === option.target}
                disabled={workspace.exportingTarget !== null}
              >
                {workspace.exportingTarget !== option.target ? (
                  <Archive className="h-3.5 w-3.5" />
                ) : null}
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div
            className="inline-flex rounded-2xl p-1"
            style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          >
            {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => workspace.setViewMode(value)}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                  workspace.viewMode === value ? "text-white" : "text-ink-tertiary hover:text-ink-primary",
                )}
                style={workspace.viewMode === value ? { background: "var(--rc-button-primary-bg)" } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="min-w-0 flex-1 text-xs text-ink-tertiary">
            {workspace.lastSavedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759]" />
                已自动保存 {workspace.lastSavedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : (
              <span>正在准备自动保存...</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-ink-tertiary">
            <Download className="h-3.5 w-3.5" />
            {EXPORT_TARGET_LABELS.texstudio} / {EXPORT_TARGET_LABELS.overleaf} 均为 zip 项目包
          </div>
        </div>

        {(workspace.message || workspace.error) && (
          <div
            className={clsx(
              "mt-3 rounded-xl px-3 py-2 text-xs leading-5",
              workspace.error ? "text-apple-red" : "text-ink-secondary",
            )}
            style={{
              background: workspace.error ? "rgba(255,59,48,0.08)" : "rgba(52,199,89,0.10)",
            }}
          >
            {workspace.error || workspace.message}
          </div>
        )}

        {showLatexInstallNotice ? (
          <WritingLatexInstallNotice
            openingInstaller={workspace.latexInstallerStatus === "opening"}
            onDownloadInstaller={() => void workspace.openLatexInstaller()}
            onOpenDownloadPage={() => void workspace.openLatexDownloadPage()}
          />
        ) : null}

        {workspace.compileResult ? (
          <details
            className="mt-3 rounded-xl border px-3 py-2 text-xs"
            style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
          >
            <summary className="cursor-pointer font-semibold text-ink-secondary">
              编译日志 · {workspace.compileResult.engine}
              {workspace.compileResult.success ? " · 已生成 PDF" : " · 未生成 PDF"}
            </summary>
            <pre className="rc-selectable mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg p-3 font-mono text-[11px] leading-5 text-ink-secondary" style={{ background: "var(--rc-card-inset-bg)" }}>
              {workspace.compileResult.log || "没有编译日志。"}
            </pre>
          </details>
        ) : null}
      </header>

      <div
        className={clsx(
          "grid min-h-0 flex-1 gap-4 px-6 pb-6",
          workspace.viewMode === "split"
            ? "grid-cols-[18rem_minmax(0,1fr)_24rem]"
            : "grid-cols-[18rem_minmax(0,1fr)]",
        )}
      >
        <WritingSidebar
          projectName={workspace.projectName}
          templates={workspace.templates}
          templateId={workspace.templateId}
          outline={workspace.outline}
          diagnostics={workspace.diagnostics}
          onProjectNameChange={workspace.setProjectName}
          onTemplateChange={workspace.applyTemplate}
          onJumpToLine={workspace.jumpToLine}
          onReset={workspace.resetWorkspace}
        />

        {showEditor ? (
          <WritingEditorPanel
            editorRef={workspace.editorRef}
            mainTex={workspace.mainTex}
            bibtex={workspace.bibtex}
            activeSource={workspace.activeSource}
            onActiveSourceChange={workspace.setActiveSource}
            onMainTexChange={workspace.setMainTex}
            onBibtexChange={workspace.setBibtex}
            onInsertText={workspace.insertText}
          />
        ) : null}

        {showPreview ? (
          <WritingPreviewPanel
            blocks={workspace.previewBlocks}
            stats={workspace.stats}
            snippets={workspace.snippets}
            notes={workspace.notes}
            compact={workspace.viewMode === "split"}
            onNotesChange={workspace.setNotes}
            onInsertSnippet={workspace.insertSnippet}
          />
        ) : null}
      </div>
    </div>
  );
}

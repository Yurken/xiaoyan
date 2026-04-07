import { AlertCircle, AlignLeft, ArrowRight, CheckCircle2, Download, FileText, Loader2, Presentation, Upload, Wand2 } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { Link } from "react-router-dom";

const insetShadow = "var(--rc-inset-shadow)";
const raisedShadow = "var(--rc-raised-shadow)";
const activeTabStyle = {
  background: "var(--rc-elevated)",
  boxShadow: raisedShadow,
  color: "var(--rc-text)",
} as const;
const activeChipStyle = {
  background: "var(--rc-card-inset-bg)",
  color: "#007AFF",
  boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.12), inset -1px -1px 3px rgba(255,255,255,0.5)",
  border: "1px solid rgba(0,122,255,0.3)",
} as const;
const inactiveChipStyle = {
  background: "var(--rc-elevated)",
  color: "var(--rc-text-muted)",
  border: "1px solid transparent",
} as const;

const MODE_OPTIONS = [
  { key: "topic" as const, icon: <Wand2 className="h-3.5 w-3.5" />, label: "输入主题" },
  { key: "document" as const, icon: <Upload className="h-3.5 w-3.5" />, label: "上传文档" },
  { key: "outline" as const, icon: <AlignLeft className="h-3.5 w-3.5" />, label: "粘贴大纲" },
] as const;

const STYLE_OPTIONS = [
  { value: "auto", label: "✦ 小妍推荐" },
  { value: "文献综述", label: "文献综述" },
  { value: "实验汇报", label: "实验汇报" },
  { value: "开题答辩", label: "开题答辩" },
  { value: "技术路线", label: "技术路线" },
  { value: "custom", label: "自定义" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "✦ 小妍推荐" },
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
] as const;

const PAGE_OPTIONS = [
  { value: "auto", label: "✦ 小妍推荐" },
  { value: "8", label: "8 页" },
  { value: "12", label: "12 页" },
  { value: "16", label: "16 页" },
  { value: "20", label: "20 页" },
  { value: "custom", label: "自定义" },
] as const;

type PptMode = "topic" | "document" | "outline";
type PptStatus = "idle" | "llm" | "building" | "ready" | "error";

interface PptWorkspaceProps {
  featureDisabled: boolean;
  mode: PptMode;
  topic: string;
  outline: string;
  documentName: string | null;
  documentLoading: boolean;
  documentError: string;
  hasDocumentContent: boolean;
  styleValue: string;
  customStyle: string;
  language: string;
  pageCount: string;
  customPages: string;
  status: PptStatus;
  slideCount: number;
  error: string;
  onModeChange: (value: PptMode) => void;
  onTopicChange: (value: string) => void;
  onOutlineChange: (value: string) => void;
  onDocumentDrop: (file: File) => void | Promise<void>;
  onPickDocument: () => void | Promise<void>;
  onResetDocument: () => void;
  onStyleChange: (value: string) => void;
  onCustomStyleChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onPageCountChange: (value: string) => void;
  onCustomPagesChange: (value: string) => void;
  onGenerate: () => void | Promise<void>;
  onDownload: () => void | Promise<void>;
}

export function PptWorkspace({
  featureDisabled,
  mode,
  topic,
  outline,
  documentName,
  documentLoading,
  documentError,
  hasDocumentContent,
  styleValue,
  customStyle,
  language,
  pageCount,
  customPages,
  status,
  slideCount,
  error,
  onModeChange,
  onTopicChange,
  onOutlineChange,
  onDocumentDrop,
  onPickDocument,
  onResetDocument,
  onStyleChange,
  onCustomStyleChange,
  onLanguageChange,
  onPageCountChange,
  onCustomPagesChange,
  onGenerate,
  onDownload,
}: PptWorkspaceProps) {
  const generating = status === "llm" || status === "building";
  const generateDisabled =
    generating ||
    (mode === "topic" && !topic.trim()) ||
    (mode === "outline" && !outline.trim()) ||
    (mode === "document" && (!hasDocumentContent || !!documentError || documentLoading));

  return (
    <div className="relative">
      <Card padding="md" className={["space-y-5", featureDisabled ? "pointer-events-none select-none opacity-40" : ""].join(" ")}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-purple/10 text-apple-purple">
            <Presentation className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-primary">幻灯片生成</p>
            <p className="text-xs leading-5 text-ink-tertiary">
              告诉小妍你的演示主题，或上传文档、粘贴大纲，小妍会帮你生成一份结构清晰的幻灯片内容。
            </p>
          </div>
        </div>

        <div className="flex gap-0.5 rounded-2xl p-1" style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}>
          {MODE_OPTIONS.map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onModeChange(key)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150"
              style={mode === key ? activeTabStyle : { color: "var(--rc-text-muted)" }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {mode === "topic" ? (
          <div className="space-y-2">
            <textarea
              value={topic}
              onChange={(event) => onTopicChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  void onGenerate();
                }
              }}
              rows={3}
              placeholder={'输入演示主题，例如："大语言模型在科研中的应用"'}
              className="w-full resize-none rounded-2xl px-4 py-3 text-sm text-ink-primary outline-none placeholder:text-ink-muted"
              style={{ background: "var(--rc-surface)", boxShadow: insetShadow, color: "var(--rc-text)" }}
            />
            <p className="ml-1 text-xs text-ink-muted">小妍会自动决定幻灯片数量、内容深度与配图风格</p>
          </div>
        ) : null}

        {mode === "document" ? (
          <div>
            <div
              className="space-y-4 rounded-2xl border-2 border-dashed p-8 text-center transition-colors"
              style={{ borderColor: "var(--rc-border)" }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) {
                  void onDocumentDrop(file);
                }
              }}
            >
              {documentName ? (
                <div className="space-y-2">
                  <FileText className="mx-auto h-8 w-8 text-apple-blue" />
                  <p className="text-sm font-medium text-ink-primary">{documentName}</p>
                  <button
                    type="button"
                    onClick={onResetDocument}
                    className="text-xs text-ink-muted transition-colors hover:text-apple-red"
                  >
                    移除文件
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="mx-auto h-8 w-8 text-ink-muted" />
                  <div>
                    <p className="text-sm font-medium text-ink-primary">拖拽文件到此处</p>
                    <p className="mt-1 text-xs text-ink-muted">支持 PDF、TXT、MD 文档</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onPickDocument()}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-ink-secondary transition-all"
                    style={{ background: "var(--rc-elevated)", boxShadow: raisedShadow }}
                  >
                    <FileText className="h-4 w-4" />
                    本地文件
                  </button>
                </div>
              )}
            </div>
            {documentLoading ? <p className="mt-2 text-xs text-ink-muted">正在读取文档内容…</p> : null}
            {documentError ? <p className="mt-2 text-xs text-apple-red">{documentError}</p> : null}
          </div>
        ) : null}

        {mode === "outline" ? (
          <div className="space-y-2">
            <textarea
              value={outline}
              onChange={(event) => onOutlineChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  void onGenerate();
                }
              }}
              rows={8}
              placeholder={"在此处键入或粘贴大纲，内容层级尽量不超过 4 级，例如：\n第一章 章节页标题\n  正文页标题\n    a. 此处为正文小标题\n    此处为正文内容，建议内容尽量精简"}
              className="w-full resize-none rounded-2xl px-4 py-3 font-mono text-sm leading-6 outline-none"
              style={{ background: "var(--rc-surface)", boxShadow: insetShadow, color: "var(--rc-text)" }}
            />
            <p className="ml-1 text-xs text-ink-muted">小妍会按照大纲层级整理为幻灯片结构</p>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-6 flex-shrink-0 text-xs font-medium text-ink-muted">风格</span>
            {STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onStyleChange(option.value)}
                className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150"
                style={styleValue === option.value ? activeChipStyle : inactiveChipStyle}
              >
                {option.label}
              </button>
            ))}
            {styleValue === "custom" ? (
              <input
                type="text"
                value={customStyle}
                onChange={(event) => onCustomStyleChange(event.target.value)}
                placeholder="输入科研风格（如：算法推导型）"
                className="min-w-0 flex-1 rounded-xl px-3 py-1 text-xs outline-none"
                style={{ background: "var(--rc-surface)", boxShadow: insetShadow, color: "var(--rc-text)" }}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-6 flex-shrink-0 text-xs font-medium text-ink-muted">语言</span>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onLanguageChange(option.value)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-all duration-150"
                  style={language === option.value ? activeChipStyle : inactiveChipStyle}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-6 flex-shrink-0 text-xs font-medium text-ink-muted">页数</span>
            {PAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPageCountChange(option.value)}
                className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150"
                style={pageCount === option.value ? activeChipStyle : inactiveChipStyle}
              >
                {option.label}
              </button>
            ))}
            {pageCount === "custom" ? (
              <input
                type="number"
                min={4}
                max={40}
                value={customPages}
                onChange={(event) => onCustomPagesChange(event.target.value)}
                placeholder="4-40"
                className="w-20 flex-shrink-0 rounded-xl px-3 py-1 text-xs outline-none"
                style={{ background: "var(--rc-surface)", boxShadow: insetShadow, color: "var(--rc-text)" }}
              />
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 text-xs text-ink-muted">
            {status === "llm" ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin text-apple-blue" />小妍正在构思幻灯片结构…</span> : null}
            {status === "building" ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin text-apple-blue" />正在生成 .pptx 文件…</span> : null}
            {status === "ready" ? <span className="flex items-center gap-1.5 text-apple-green"><CheckCircle2 className="h-3.5 w-3.5" />已生成 {slideCount} 张幻灯片，可直接在 PowerPoint / WPS 中打开</span> : null}
            {status === "idle" ? <span>小妍生成可直接打开的 .pptx 文件</span> : null}
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            {status === "ready" ? (
              <button
                type="button"
                onClick={() => void onDownload()}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150"
                style={{ background: "linear-gradient(145deg, #38C759, #28A048)", boxShadow: "3px 3px 8px rgba(0,0,0,0.2)" }}
              >
                <Download className="h-4 w-4" />
                下载 .pptx
              </button>
            ) : null}
            <button
              type="button"
              disabled={generateDisabled}
              onClick={() => void onGenerate()}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "linear-gradient(145deg, #1A8AFF, #0062CC)", boxShadow: "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)" }}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {status === "ready" ? "重新生成" : "立即生成"}
            </button>
          </div>
        </div>

        {status === "error" && error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </Card>

      {featureDisabled ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl">
          <div
            className="flex flex-col items-center gap-3 rounded-3xl px-8 py-6 text-center"
            style={{ background: "var(--rc-elevated)", boxShadow: "var(--rc-raised-shadow)" }}
          >
            <Presentation className="h-8 w-8 text-ink-muted" />
            <p className="text-sm font-semibold text-ink-primary">PPT 生成功能已关闭</p>
            <p className="text-xs text-ink-tertiary">此功能已在技能库中被禁用，请前往设置开启。</p>
            <Link to="/settings" className="text-xs font-medium text-apple-blue hover:underline">
              前往 设置 › 技能库
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

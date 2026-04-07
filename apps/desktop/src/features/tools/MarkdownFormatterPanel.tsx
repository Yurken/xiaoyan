import { AlertCircle, FileText, Loader2, Plus } from "lucide-react";
import { Card, Textarea } from "@research-copilot/ui";

const insetShadow = "var(--rc-inset-shadow)";
const primaryButtonStyle = {
  background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
  boxShadow: "4px 4px 10px rgba(0,62,204,0.3),-3px -3px 8px rgba(58,155,255,0.15)",
} as const;

interface MarkdownProgress {
  current: number;
  total: number;
}

interface MarkdownFormatterPanelProps {
  input: string;
  result: string;
  processing: boolean;
  error: string;
  progress: MarkdownProgress | null;
  onInputChange: (value: string) => void;
  onUpload: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
}

export function MarkdownFormatterPanel({
  input,
  result,
  processing,
  error,
  progress,
  onInputChange,
  onUpload,
  onSubmit,
  onSave,
}: MarkdownFormatterPanelProps) {
  const trimmedLength = input.trim().length;

  return (
    <>
      <Card padding="md" className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <FileText className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-ink-primary">Markdown 整理</p>
            <p className="text-xs leading-5 text-ink-tertiary">
              粘贴任意文本，小妍帮你整理为规范的 Markdown 格式。内容过长时会自动分块处理，保证全文一致性。
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">待整理内容</label>
            <button
              type="button"
              onClick={() => void onUpload()}
              className="flex items-center gap-1 text-xs text-ink-tertiary transition-colors hover:text-apple-blue"
            >
              <Plus className="h-3.5 w-3.5" />
              上传文件
            </button>
          </div>
          <Textarea
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                void onSubmit();
              }
            }}
            rows={10}
            placeholder="粘贴需要整理的文字内容，或点击右上角上传文件…"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-tertiary">
            {trimmedLength > 0
              ? `${trimmedLength} 字 · 预计 ${Math.ceil(trimmedLength / 1500)} 块`
              : "支持 ⌘/Ctrl+Enter 快捷提交"}
          </p>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!input.trim() || processing}
            className="flex items-center gap-1.5 rounded-2xl px-5 py-2 text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={primaryButtonStyle}
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {processing ? "整理中…" : "开始整理"}
          </button>
        </div>

        {processing && progress ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-tertiary">
              <span>正在处理第 {progress.current} / {progress.total} 块</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  background: "linear-gradient(90deg,#1A8AFF,#0062CC)",
                }}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </Card>

      {result ? (
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-secondary">整理结果</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(result)}
                className="text-xs text-ink-tertiary transition-colors hover:text-apple-blue"
              >
                复制
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                className="flex items-center gap-1 text-xs font-medium text-apple-blue transition-opacity hover:opacity-80"
              >
                <FileText className="h-3.5 w-3.5" />
                保存为 .md
              </button>
            </div>
          </div>
          <pre
            className="overflow-x-auto whitespace-pre-wrap rounded-2xl p-4 font-mono text-xs leading-6 text-ink-primary"
            style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}
          >
            {result}
          </pre>
        </Card>
      ) : null}
    </>
  );
}

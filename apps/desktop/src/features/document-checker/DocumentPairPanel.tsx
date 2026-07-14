import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  FileUp,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge, Button, Card } from "@research-copilot/ui";
import type { DocumentRole, SelectedDocumentFile } from "./shared";

interface DocumentPairPanelProps {
  referenceFile: SelectedDocumentFile | null;
  candidateFile: SelectedDocumentFile | null;
  loading: boolean;
  canCompare: boolean;
  onChoose: (role: DocumentRole) => void | Promise<void>;
  onClear: (role: DocumentRole) => void;
  onCompare: () => void | Promise<void>;
}

function DocumentSlot({
  step,
  role,
  title,
  description,
  file,
  icon: Icon,
  onChoose,
  onClear,
}: {
  step: number;
  role: DocumentRole;
  title: string;
  description: string;
  file: SelectedDocumentFile | null;
  icon: typeof FileText;
  onChoose: (role: DocumentRole) => void | Promise<void>;
  onClear: (role: DocumentRole) => void;
}) {
  return (
    <section
      className="min-w-0 rounded-3xl border p-5"
      style={{
        background: "var(--rc-card-inset-bg)",
        borderColor: file ? "color-mix(in srgb, var(--rc-apple-green, #34C759) 24%, var(--rc-card-inset-outline))" : "var(--rc-card-inset-outline)",
        boxShadow: "var(--rc-card-inset-shadow)",
      }}
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: file ? "var(--rc-success-chip-bg, rgba(52,199,89,0.12))" : "var(--rc-info-chip-bg)",
            color: file ? "var(--rc-apple-green, #1A9E3F)" : "var(--rc-info-chip-text)",
          }}
        >
          {file ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={file ? "success" : "default"}>步骤 {step}</Badge>
            <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-tertiary">{description}</p>
        </div>
      </div>

      <div className="mt-5 flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border px-4 py-3"
        style={{ background: "var(--rc-control-bg)", borderColor: "var(--rc-control-border)" }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-primary">{file?.name ?? "尚未选择文件"}</p>
          <p className="mt-1 text-[11px] text-ink-tertiary">{file ? "文件仅在本机解析" : "支持 PDF、DOCX"}</p>
        </div>
        {file ? (
          <button
            type="button"
            aria-label={`移除${title}`}
            title={`移除${title}`}
            onClick={() => onClear(role)}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-ink-tertiary transition-colors hover:text-ink-primary"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <Button variant="secondary" className="mt-3 w-full" onClick={() => void onChoose(role)}>
        <FileUp className="h-4 w-4" />
        {file ? `重新选择${title}` : `选择${title}`}
      </Button>
    </section>
  );
}

export function DocumentPairPanel({
  referenceFile,
  candidateFile,
  loading,
  canCompare,
  onChoose,
  onClear,
  onCompare,
}: DocumentPairPanelProps) {
  return (
    <Card padding="lg" className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-ink-primary">选择比对文档</h3>
        <p className="mt-1 text-xs leading-5 text-ink-tertiary">
          先提供学校、期刊或项目方发布的规范/模板，再提供已撰写文档；两份文件都会在本机解析。
        </p>
      </div>

      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)]">
        <DocumentSlot
          step={1}
          role="reference"
          title="规范文档"
          description="上传官方格式规范、投稿模板或一份排版正确的示例文档。"
          file={referenceFile}
          icon={FileText}
          onChoose={onChoose}
          onClear={onClear}
        />
        <div className="flex items-center justify-center text-ink-tertiary" aria-hidden="true">
          <ArrowRight className="hidden h-5 w-5 lg:block" />
          <ArrowDown className="h-5 w-5 lg:hidden" />
        </div>
        <DocumentSlot
          step={2}
          role="candidate"
          title="待校验文档"
          description="上传已完成撰写、准备提交或送审的 PDF / DOCX 成稿。"
          file={candidateFile}
          icon={FileCheck2}
          onChoose={onChoose}
          onClear={onClear}
        />
      </div>

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "var(--rc-border)" }}
      >
        <p className="text-xs leading-5 text-ink-tertiary">
          {canCompare ? "两份文档已就绪，可以开始提取规范并逐项比对。" : "选择两份文档后才能开始比对。"}
        </p>
        <Button onClick={() => void onCompare()} loading={loading} disabled={!canCompare}>
          <ShieldCheck className="h-4 w-4" />
          提取规范并开始比对
        </Button>
      </div>
    </Card>
  );
}

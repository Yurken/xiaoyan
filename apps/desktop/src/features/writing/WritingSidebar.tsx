import { AlertCircle, CheckCircle2, FileArchive, FileText, ListTree, RefreshCw } from "lucide-react";
import { Button, Input } from "@research-copilot/ui";
import type {
  LatexDiagnostic,
  LatexOutlineEntry,
  LatexTemplate,
  WritingTemplateId,
} from "./shared";

interface WritingSidebarProps {
  projectName: string;
  templates: LatexTemplate[];
  templateId: WritingTemplateId;
  outline: LatexOutlineEntry[];
  diagnostics: LatexDiagnostic[];
  onProjectNameChange: (value: string) => void;
  onTemplateChange: (templateId: WritingTemplateId) => void;
  onJumpToLine: (line: number) => void;
  onReset: () => void;
}

const severityStyle: Record<LatexDiagnostic["severity"], { icon: typeof AlertCircle; text: string; bg: string }> = {
  error: { icon: AlertCircle, text: "#FF3B30", bg: "rgba(255,59,48,0.10)" },
  warning: { icon: AlertCircle, text: "#FF9500", bg: "rgba(255,149,0,0.12)" },
  info: { icon: CheckCircle2, text: "#34A853", bg: "rgba(52,199,89,0.12)" },
};

export default function WritingSidebar({
  projectName,
  templates,
  templateId,
  outline,
  diagnostics,
  onProjectNameChange,
  onTemplateChange,
  onJumpToLine,
  onReset,
}: WritingSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      <section
        className="rounded-[8px] border p-3"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-flat-shadow)" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <FileArchive className="h-4 w-4 text-apple-blue" />
          <p className="text-sm font-semibold text-ink-primary">项目</p>
          <Button type="button" size="sm" variant="ghost" className="ml-auto px-2" onClick={onReset}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Input
          label="项目名"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          placeholder="my-paper"
        />
        <label className="mt-3 block text-xs font-medium text-ink-tertiary ml-1">模板</label>
        <select
          value={templateId}
          onChange={(event) => onTemplateChange(event.target.value as WritingTemplateId)}
          className="mt-1.5 w-full rounded-2xl border px-3 py-2.5 text-sm text-ink-primary outline-none"
          style={{
            background: "var(--rc-control-bg)",
            borderColor: "var(--rc-control-border)",
            boxShadow: "var(--rc-control-shadow)",
          }}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-5 text-ink-tertiary">
          {templates.find((template) => template.id === templateId)?.description}
        </p>
      </section>

      <section
        className="rounded-[8px] border p-3"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-flat-shadow)" }}
      >
        <div className="mb-2 flex items-center gap-2">
          <ListTree className="h-4 w-4 text-apple-blue" />
          <p className="text-sm font-semibold text-ink-primary">结构</p>
          <span className="ml-auto text-xs text-ink-tertiary">{outline.length}</span>
        </div>
        {outline.length === 0 ? (
          <p className="rounded-xl px-3 py-2 text-xs leading-5 text-ink-tertiary" style={{ background: "var(--rc-card-inset-bg)" }}>
            还没有章节。插入 section 后会在这里形成可跳转大纲。
          </p>
        ) : (
          <div className="space-y-1">
            {outline.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onJumpToLine(entry.line)}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors hover:bg-nm-dark/8"
                style={{ paddingLeft: `${8 + entry.level * 10}px` }}
              >
                <span className="w-8 shrink-0 font-mono text-[10px] text-ink-tertiary">L{entry.line}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink-secondary">{entry.title}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section
        className="rounded-[8px] border p-3"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-flat-shadow)" }}
      >
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-apple-blue" />
          <p className="text-sm font-semibold text-ink-primary">结构检查</p>
          <span className="ml-auto text-xs text-ink-tertiary">{diagnostics.length}</span>
        </div>
        {diagnostics.length === 0 ? (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-5" style={{ background: "rgba(52,199,89,0.12)", color: "#248A3D" }}>
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            基础结构看起来正常。
          </div>
        ) : (
          <div className="space-y-2">
            {diagnostics.slice(0, 8).map((item) => {
              const style = severityStyle[item.severity];
              const Icon = style.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => item.line && onJumpToLine(item.line)}
                  className="w-full rounded-xl px-3 py-2 text-left transition-transform active:scale-[0.99]"
                  style={{ background: style.bg }}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: style.text }} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink-primary">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-ink-secondary">{item.detail}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </aside>
  );
}

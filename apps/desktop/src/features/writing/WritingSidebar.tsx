import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  FileArchive,
  FileText,
  ListTree,
  RefreshCw,
  StickyNote,
} from "lucide-react";
import { Button, Input, Select, Textarea } from "@research-copilot/ui";
import type {
  LatexDiagnostic,
  LatexOutlineEntry,
  LatexStats,
  LatexTemplate,
  WritingTemplateId,
} from "./shared";

interface WritingSidebarProps {
  projectName: string;
  templates: LatexTemplate[];
  templateId: WritingTemplateId;
  outline: LatexOutlineEntry[];
  diagnostics: LatexDiagnostic[];
  stats: LatexStats;
  notes: string;
  onProjectNameChange: (value: string) => void;
  onTemplateChange: (templateId: WritingTemplateId) => void;
  onJumpToLine: (line: number) => void;
  onNotesChange: (value: string) => void;
  onReset: () => void;
}

const severityStyle: Record<
  LatexDiagnostic["severity"],
  { icon: typeof AlertCircle; text: string; bg: string }
> = {
  error: { icon: AlertCircle, text: "#FF3B30", bg: "rgba(255,59,48,0.10)" },
  warning: { icon: AlertCircle, text: "#FF9500", bg: "rgba(255,149,0,0.12)" },
  info: { icon: CheckCircle2, text: "#34A853", bg: "rgba(52,199,89,0.12)" },
};

interface SidebarSectionProps {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

function SidebarSection({
  title,
  icon,
  badge,
  action,
  children,
  defaultOpen = true,
  className,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section
      className={clsx(
        "rounded-xl border shadow-sm transition-all",
        className,
      )}
      style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
    >
      <div
        className={clsx(
          "flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-white/5",
          isOpen ? "border-b" : "rounded-xl",
        )}
        style={{ borderColor: "var(--rc-border)" }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-apple-blue/10 text-apple-blue">
            {icon}
          </div>
          <p className="text-sm font-bold tracking-tight text-ink-primary">{title}</p>
          {badge}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {action}
          <div
            className={clsx(
              "flex h-6 w-6 items-center justify-center rounded-md text-ink-tertiary transition-transform duration-200",
              isOpen ? "rotate-0" : "-rotate-90",
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      {isOpen && <div className="relative">{children}</div>}
    </section>
  );
}

export default function WritingSidebar({
  projectName,
  templates,
  templateId,
  outline,
  diagnostics,
  stats,
  notes,
  onProjectNameChange,
  onTemplateChange,
  onJumpToLine,
  onNotesChange,
  onReset,
}: WritingSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <SidebarSection
        title="项目配置"
        icon={<FileArchive className="h-4 w-4" />}
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 rounded-lg p-0"
            onClick={onReset}
            title="重置工作台"
          >
            <RefreshCw className="h-3.5 w-3.5 text-ink-tertiary" />
          </Button>
        }
      >
        <div className="space-y-4 p-3.5">
          <Input
            label="项目名称"
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            placeholder="my-paper"
            className="h-9 text-sm"
          />

          <div className="space-y-1.5">
            <Select
              label="LaTeX 模板"
              value={templateId}
              onChange={(value) => onTemplateChange(value as WritingTemplateId)}
              options={templates.map((t) => ({ value: t.id, label: t.title }))}
            />
            <p className="px-1 text-[10px] leading-relaxed text-ink-tertiary">
              {templates.find((template) => template.id === templateId)?.description}
            </p>
          </div>
        </div>
      </SidebarSection>

      <SidebarSection
        title="论文大纲"
        icon={<ListTree className="h-4 w-4" />}
        badge={
          <span className="rounded-full bg-apple-blue/10 px-2 py-0.5 text-[10px] font-bold text-apple-blue">
            {outline.length} 章节
          </span>
        }
      >
        <div className="p-1.5">
          {outline.length === 0 ? (
            <div
              className="m-2 flex h-28 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <p className="text-[11px] leading-relaxed text-ink-tertiary">
                在源码中使用 \section 等命令，大纲将自动在此生成。
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {outline.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onJumpToLine(entry.line)}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left transition-all hover:bg-apple-blue/5"
                  style={{ paddingLeft: `${12 + entry.level * 12}px` }}
                >
                  <span className="w-7 shrink-0 font-mono text-[9px] text-ink-tertiary transition-colors group-hover:text-apple-blue">
                    L{entry.line}
                  </span>
                  <span
                    className={clsx(
                      "min-w-0 flex-1 truncate text-xs transition-colors group-hover:text-ink-primary",
                      entry.level === 0 ? "font-bold text-ink-secondary" : "font-medium text-ink-tertiary",
                    )}
                  >
                    {entry.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </SidebarSection>

      <SidebarSection
        title="稿件状态"
        icon={<BarChart3 className="h-4 w-4" />}
      >
        <div className="grid grid-cols-3 gap-2 p-3.5">
          <StatTile label="字数" value={stats.words} />
          <StatTile label="公式" value={stats.equations} />
          <StatTile label="引用" value={stats.citations} />
          <StatTile label="标签" value={stats.labels} />
          <StatTile label="行数" value={stats.lines} />
          <StatTile label="字符" value={stats.characters} />
        </div>
      </SidebarSection>

      <SidebarSection
        title="结构检查"
        icon={<FileText className="h-4 w-4" />}
        badge={
          <span
            className={clsx(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              diagnostics.length === 0
                ? "bg-[#34C759]/10 text-[#34C759]"
                : "bg-apple-orange/10 text-apple-orange",
            )}
          >
            {diagnostics.length} 提示
          </span>
        }
      >
        <div className="p-3.5">
          {diagnostics.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-[#34C759]/5 p-3 text-xs text-[#248A3D]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p className="font-medium">基本结构完整且正确。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {diagnostics.map((item) => {
                const style = severityStyle[item.severity];
                const Icon = style.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => item.line && onJumpToLine(item.line)}
                    className="flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-all hover:border-apple-blue/30 hover:bg-apple-blue/5"
                    style={{ borderColor: "var(--rc-border)" }}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: style.text }} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink-primary">{item.title}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-ink-tertiary line-clamp-2">
                        {item.detail}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SidebarSection>

      <SidebarSection
        title="写作便签"
        icon={<StickyNote className="h-4 w-4" />}
      >
        <div className="p-3.5">
          <Textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="记录审稿要求、待补实验、下一轮修改计划..."
            className="min-h-28 text-xs leading-relaxed transition-all focus:ring-2 focus:ring-apple-blue/20"
            style={{ background: "var(--rc-card-inset-bg)" }}
          />
        </div>
      </SidebarSection>
    </aside>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border p-2 shadow-sm"
      style={{ background: "var(--rc-card-inset-bg)", borderColor: "var(--rc-border)" }}
    >
      <p className="text-sm font-black tracking-tight text-ink-primary">{value.toLocaleString()}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ink-tertiary/60">{label}</p>
    </div>
  );
}

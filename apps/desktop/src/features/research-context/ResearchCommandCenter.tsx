import { CheckCircle2, Link as LinkIcon, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@research-copilot/ui";
import { useThemeContext } from "./useResearchContext";
import { buildThemeStages, themeProgressPercent } from "./shared";
import ResearchTimelinePanel from "./ResearchTimelinePanel";
import ThemeProgressLadder from "./ThemeProgressLadder";
import ThemeModuleGrid from "./ThemeModuleGrid";
import EvidenceDrawer from "./EvidenceDrawer";

interface ResearchCommandCenterProps {
  themeId: string;
}

export default function ResearchCommandCenter({ themeId }: ResearchCommandCenterProps) {
  const { theme, events, loading, error } = useThemeContext(themeId);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const stages = useMemo(() => (theme ? buildThemeStages(theme) : []), [theme]);
  const percent = useMemo(() => themeProgressPercent(stages), [stages]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-apple-blue opacity-80" />
        <p className="text-sm font-medium text-ink-tertiary">正在加载研究主题…</p>
      </div>
    );
  }

  if (error || !theme) {
    return (
      <div className="flex h-full flex-col justify-center overflow-y-auto">
        <Card className="mx-auto flex w-full max-w-3xl flex-col gap-3 py-10 text-center">
          <p className="text-base font-semibold text-ink-primary">无法加载主题</p>
          <p className="mx-auto max-w-2xl break-all text-sm text-apple-red">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col gap-4">
        <Card padding="md" className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-ink-primary">{theme.name}</h1>
              <p className="mt-1 text-sm text-ink-tertiary">
                最近活动：
                {theme.lastActiveAt ? new Date(theme.lastActiveAt).toLocaleString() : "暂无记录"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEvidenceOpen(true)}
              className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-2xl px-3 text-xs font-medium transition-colors hover:text-ink-primary"
              style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)", color: "var(--rc-text-secondary)" as string }}
              title="查看证据链"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              证据
            </button>
          </div>

          <ThemeProgressLadder stages={stages} percent={percent} />

          <ThemeModuleGrid progress={theme.progress} />

          {theme.completedTasks.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                已完成里程碑
              </div>
              <div className="flex flex-wrap gap-2">
                {theme.completedTasks.map((task, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-secondary"
                    style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-apple-green" />
                    {task}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card padding="md">
          <div className="grid gap-6 md:grid-cols-[1fr_260px]">
            <ResearchTimelinePanel events={events} />

            <div className="space-y-6">
              {theme.nextSteps.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                    推荐下一步
                  </div>
                  <div className="space-y-2">
                    {theme.nextSteps.map((step, index) => (
                      <div key={index} className="rounded-xl bg-black/[0.03] px-3 py-2">
                        <p className="text-xs font-semibold text-ink-primary">{step.title}</p>
                        {step.description && (
                          <p className="mt-1 text-[11px] text-ink-secondary">{step.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {theme.openQuestions.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                    开放问题
                  </div>
                  <ul className="list-disc space-y-1 pl-4">
                    {theme.openQuestions.map((question, index) => (
                      <li key={index} className="text-xs text-ink-secondary">
                        {question}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <EvidenceDrawer
        targetId={themeId}
        targetType="research_theme"
        isOpen={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
      />
    </>
  );
}

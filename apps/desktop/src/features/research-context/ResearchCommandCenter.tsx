import { Loader2 } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { useThemeContext } from "./useResearchContext";
import ResearchTimelinePanel from "./ResearchTimelinePanel";

interface ResearchCommandCenterProps {
  themeId: string;
}

export default function ResearchCommandCenter({ themeId }: ResearchCommandCenterProps) {
  const { theme, events, loading, error } = useThemeContext(themeId);

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
      <div className="flex h-full flex-col justify-center overflow-y-auto p-5">
        <Card className="mx-auto flex w-full max-w-3xl flex-col gap-3 py-10 text-center">
          <p className="text-base font-semibold text-ink-primary">无法加载主题</p>
          <p className="mx-auto max-w-2xl break-all text-sm text-apple-red">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-5">
      <Card padding="md" className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">{theme.name}</h1>
          <p className="text-sm text-ink-tertiary mt-1">
            最近活动：{new Date(theme.lastActiveAt).toLocaleString()}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_250px]">
          <div className="space-y-6">
            <ResearchTimelinePanel events={events} />
          </div>

          <div className="space-y-6">
            {theme.nextSteps.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2">
                  推荐下一步
                </div>
                <div className="space-y-2">
                  {theme.nextSteps.map((step, i) => (
                    <div key={i} className="rounded-xl px-3 py-2 bg-black/[0.03]">
                      <p className="text-xs font-semibold text-ink-primary">{step.title}</p>
                      {step.description && (
                        <p className="text-[11px] text-ink-secondary mt-1">{step.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {theme.openQuestions.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2">
                  开放问题
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  {theme.openQuestions.map((q, i) => (
                    <li key={i} className="text-xs text-ink-secondary">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

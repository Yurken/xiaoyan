import { Loader2, ArrowRight, BrainCircuit } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Card } from "@research-copilot/ui";
import { useResearchThemes } from "./useResearchContext";

export default function ContinueResearchPanel() {
  const { themes, loading, error } = useResearchThemes(3);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-ink-tertiary" />
      </div>
    );
  }

  if (error || themes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <BrainCircuit className="w-4 h-4 text-apple-blue" />
        <h2 className="text-sm font-semibold text-ink-primary">继续研究</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((theme) => (
          <Card key={theme.id} className="flex flex-col p-4 transition-colors hover:bg-black/[0.02]">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-primary line-clamp-1" title={theme.name}>
                {theme.name}
              </h3>
            </div>

            <div className="flex-1 space-y-3">
              {theme.nextSteps.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wide mb-1">推荐下一步</p>
                  <p className="text-xs font-medium text-ink-secondary line-clamp-2">
                    {theme.nextSteps[0].title}
                  </p>
                  {theme.nextSteps[0].description && (
                    <p className="mt-1 text-[11px] text-ink-tertiary line-clamp-2">
                      {theme.nextSteps[0].description}
                    </p>
                  )}
                </div>
              )}

              {theme.openQuestions.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wide mb-1">开放问题</p>
                  <p className="text-xs text-ink-secondary line-clamp-2">
                    {theme.openQuestions[0]}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-black/[0.04]">
              <Link to={`/research-theme/${theme.id}`} className="inline-flex w-full">
                <Button size="sm" variant="secondary" className="w-full flex items-center justify-between">
                  <span>进入主题</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

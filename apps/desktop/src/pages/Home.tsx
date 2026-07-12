import { Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Card } from "@research-copilot/ui";
import OverviewWorkspace from "../features/workbench/OverviewWorkspace";
import { useWorkbenchOverview } from "../features/workbench/useWorkbenchOverview";
import ContinueResearchPanel from "../features/research-context/ContinueResearchPanel";

export default function Home() {
  const { model, loading, error } = useWorkbenchOverview();

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-apple-blue opacity-80" />
        <p className="text-sm font-medium text-ink-tertiary">正在加载工作台…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col justify-center overflow-y-auto p-5">
        <Card className="mx-auto flex w-full max-w-3xl flex-col gap-3 py-10 text-center">
          <p className="text-base font-semibold text-ink-primary">无法加载工作台</p>
          <p className="mx-auto max-w-2xl break-all text-sm text-apple-red">{error}</p>
        </Card>
      </div>
    );
  }

  if (model) {
    return (
      <div className="h-full overflow-y-auto p-5 rc-home-container">
        <OverviewWorkspace model={model} beforeQuickActions={<ContinueResearchPanel />} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center overflow-y-auto p-5">
      <Card padding="md" className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 py-12 text-center">
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-apple-blue/5 text-apple-blue">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <p className="text-base font-semibold text-ink-primary">还没有工作台概览</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-ink-tertiary">
            可以先规划一个研究主题，或者直接让小妍帮你整理当前想法，开启你的研究之旅。
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
          <Link to="/planner">
            <Button size="sm">打开规划</Button>
          </Link>
          <Link to="/chat">
            <Button size="sm" variant="secondary">开始对话</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

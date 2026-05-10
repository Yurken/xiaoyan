import { Loader2, Sparkles, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Card } from "@research-copilot/ui";
import OverviewWorkspace from "../features/workbench/OverviewWorkspace";
import { useWorkbenchOverview } from "../features/workbench/useWorkbenchOverview";

export default function Home() {
  const { model, loading, error } = useWorkbenchOverview();

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-apple-blue opacity-80" />
        <p className="text-sm font-medium text-ink-tertiary tracking-wide">正在加载工作台…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-6 flex flex-col justify-center">
        <Card className="flex flex-col gap-3 py-16 text-center shadow-lg border-red-500/10 bg-red-500/[0.02]">
          <p className="text-lg font-bold text-ink-primary">无法加载工作台</p>
          <p className="break-all text-[15px] max-w-2xl mx-auto text-red-500/90">{error}</p>
        </Card>
      </div>
    );
  }

  if (model) {
    return <OverviewWorkspace model={model} />;
  }

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col justify-center">
      <Card padding="lg" className="flex flex-col items-center gap-6 py-20 text-center max-w-3xl mx-auto w-full">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-apple-blue/5 text-apple-blue mb-2">
           <Sparkles className="h-8 w-8" />
        </div>
        <div>
          <p className="text-base font-semibold text-ink-primary">还没有工作台概览</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-ink-tertiary">
            可以先规划一个研究方向，或者直接让小妍帮你整理当前想法，开启你的研究之旅。
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
          <Link to="/planner">
             <Button className="h-11 px-6 font-bold shadow-lg shadow-apple-blue/20">
                打开规划
             </Button>
          </Link>
          <Link to="/xiaoyan">
             <Button variant="secondary" className="h-11 px-6 font-bold">
                问问小妍
             </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

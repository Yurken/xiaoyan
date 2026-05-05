import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@research-copilot/ui";
import OverviewWorkspace from "../features/workbench/OverviewWorkspace";
import { useWorkbenchOverview } from "../features/workbench/useWorkbenchOverview";

export default function Home() {
  const { model, loading, error } = useWorkbenchOverview();

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-apple-blue" />
        <p className="text-sm text-ink-tertiary">正在加载工作台…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <Card className="flex flex-col gap-3 py-14 text-center">
          <p className="text-base font-semibold text-ink-primary">无法加载工作台</p>
          <p className="break-all text-sm text-apple-red">{error}</p>
        </Card>
      </div>
    );
  }

  if (model) {
    return <OverviewWorkspace model={model} />;
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <Card className="flex flex-col items-center gap-4 py-14 text-center">
        <div>
          <p className="text-base font-semibold text-ink-primary">还没有工作台概览</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-ink-tertiary">
            可以先规划一个研究方向，或者直接让小妍帮你整理当前想法。
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/planner"
            className="rounded-2xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 active:scale-95"
            style={{
              background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
              boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.15)",
            }}
          >
            打开规划
          </Link>
          <Link
            to="/xiaoyan"
            className="rounded-2xl px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95"
            style={{
              background: "var(--rc-chip-bg)",
              color: "var(--rc-text-soft)",
              boxShadow: "var(--rc-chip-shadow)",
            }}
          >
            问问小妍
          </Link>
        </div>
      </Card>
    </div>
  );
}

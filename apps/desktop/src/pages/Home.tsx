import { Loader2 } from "lucide-react";
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

  return model ? <OverviewWorkspace model={model} /> : null;
}

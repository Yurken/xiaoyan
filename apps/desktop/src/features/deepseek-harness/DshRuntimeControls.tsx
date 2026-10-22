import { KeyRound, RefreshCw, Square } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { DSH_PHASE_LABELS, type DshRuntimePhase } from "./shared";

export default function DshRuntimeControls({
  phase,
  statusTone,
  busy,
  onRestart,
  onStop,
  onImportApi,
}: {
  phase: DshRuntimePhase;
  statusTone: string;
  busy: boolean;
  onRestart: () => void;
  onStop: () => void;
  onImportApi?: () => void;
}) {
  return (
    <div className="flex flex-shrink-0 items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ background: "var(--rc-chip-inset-bg)", color: statusTone, boxShadow: "var(--rc-chip-inset-shadow)" }}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${phase === "starting" ? "animate-pulse" : ""}`} style={{ background: statusTone }} />
        {DSH_PHASE_LABELS[phase]}
      </span>
      {phase === "running" && (
        <>
          {onImportApi && <Button variant="ghost" size="sm" onClick={onImportApi} disabled={busy} title="同步小妍当前主模型到 DSH">
            <KeyRound className="h-3.5 w-3.5" />配置小妍 API
          </Button>}
          <Button variant="ghost" size="sm" onClick={onRestart} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5" />
            重启
          </Button>
          <Button variant="ghost" size="sm" onClick={onStop} disabled={busy}>
            <Square className="h-3 w-3" />
            停止
          </Button>
        </>
      )}
    </div>
  );
}

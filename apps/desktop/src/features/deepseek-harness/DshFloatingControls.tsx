import { GripVertical } from "lucide-react";
import DshRuntimeControls from "./DshRuntimeControls";
import { useDeepSeekHarnessRuntime } from "./useDeepSeekHarnessRuntime";
import { useDshFloatingControls } from "./useDshFloatingControls";
import "./floating-controls.css";

export default function DshFloatingControls() {
  const runtime = useDeepSeekHarnessRuntime();
  const controls = useDshFloatingControls();
  const phase = runtime.snapshot?.phase ?? "starting";
  const tone = phase === "running" ? "#248A3D" : phase === "failed" ? "#C9342C" : "#B35C00";
  return (
    <div className="w-max p-3">
      <div ref={controls.panelRef} role="toolbar" aria-label="DSH 运行控制" className="flex w-max select-none items-center gap-0.5 rounded-2xl border border-nm-dark/10 p-1.5" style={{ background: "var(--rc-elevated)", boxShadow: "var(--rc-card-shadow)" }}>
        <button type="button" aria-label="拖动 DSH 运行控制" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home" title="拖动调整位置；双击或按 Home 恢复默认位置" className={`flex h-8 w-5 flex-shrink-0 items-center justify-center rounded-xl text-ink-tertiary ${controls.dragging ? "cursor-grabbing" : "cursor-grab"}`} style={{ touchAction: "none" }} onDoubleClick={controls.resetPosition} {...controls.dragHandleProps}>
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <DshRuntimeControls phase={phase} statusTone={tone} busy={runtime.busy} onRestart={() => void runtime.restart()} onStop={() => void runtime.stop()} />
      </div>
    </div>
  );
}

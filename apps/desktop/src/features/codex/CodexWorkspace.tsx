import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { CodexRuntimeConfig } from "./shared";
import { useCodexRuntime } from "./useCodexRuntime";
import CodexLaunchPanel from "./CodexLaunchPanel";
import CodexRuntimeControls from "./CodexRuntimeControls";
import FloatingRuntimeControls from "../code-harness/FloatingRuntimeControls";
import RuntimeControlBar from "../code-harness/RuntimeControlBar";

export default function CodexWorkspace() {
  const runtime = useCodexRuntime();
  const [draft, setDraft] = useState<CodexRuntimeConfig>(runtime.config);

  useEffect(() => {
    if (runtime.snapshot && runtime.snapshot.phase !== "running") setDraft(runtime.snapshot.config);
  }, [runtime.snapshot]);

  const phase = runtime.snapshot?.phase ?? "stopped";
  const isRunning = phase === "running" && Boolean(runtime.snapshot?.url);
  const statusTone = useMemo(() => {
    if (phase === "running") return "#248A3D";
    if (phase === "failed") return "#C9342C";
    if (phase === "starting") return "#B35C00";
    return "var(--rc-text-muted)";
  }, [phase]);

  const updateDraft = <K extends keyof CodexRuntimeConfig>(key: K, value: CodexRuntimeConfig[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    runtime.clearApiImportResult();
  };

  if (runtime.loading) {
    return <div className="flex h-full items-center justify-center bg-nm-bg"><Loader2 className="h-5 w-5 animate-spin text-ink-tertiary" /></div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-nm-bg">
      {!isRunning && (
        <RuntimeControlBar>
          <CodexRuntimeControls phase={phase} statusTone={statusTone} busy={runtime.busy} onRestart={() => void runtime.restart()} onStop={() => void runtime.stop()} />
        </RuntimeControlBar>
      )}

      {isRunning ? (
        <div className="relative min-h-0 flex-1 bg-white">
          <iframe
            key={runtime.snapshot?.url}
            src={runtime.snapshot?.url ?? undefined}
            title="Codex Web"
            className="absolute inset-0 h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
          />
          <FloatingRuntimeControls provider="codex" label="Codex">
            <CodexRuntimeControls phase={phase} statusTone={statusTone} busy={runtime.busy} onRestart={() => void runtime.restart()} onStop={() => void runtime.stop()} />
          </FloatingRuntimeControls>
        </div>
      ) : (
        <CodexLaunchPanel runtime={runtime} draft={draft} onDraftChange={updateDraft} />
      )}
    </div>
  );
}

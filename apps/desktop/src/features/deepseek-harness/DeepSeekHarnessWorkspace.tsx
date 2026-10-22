import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@research-copilot/ui";
import FloatingRuntimeControls from "../code-harness/FloatingRuntimeControls";
import ManagedRuntimeDownloadNotice from "../code-harness/ManagedRuntimeDownloadNotice";
import DshRuntimeView from "./DshRuntimeView";
import DshRuntimeControls from "./DshRuntimeControls";
import DshApiSyncFeedback from "./DshApiSyncFeedback";
import DshApiSyncPrompt from "./DshApiSyncPrompt";
import { useDeepSeekHarnessRuntime } from "./useDeepSeekHarnessRuntime";
import { useDshAutoStart } from "./useDshAutoStart";
import { useDshApiSyncHost } from "./useDshApiSync";
import { canStartDsh } from "./shared";

// 旧必经启动页仅注释入口，完整源码保留。
// import LegacyDshLaunchWorkspace from "./LegacyDshLaunchWorkspace";

export default function DeepSeekHarnessWorkspace() {
  // return <LegacyDshLaunchWorkspace />;
  const runtime = useDeepSeekHarnessRuntime();
  const api = useDshApiSyncHost(runtime.refresh);
  const [apiPrompt, setApiPrompt] = useState(false);
  useDshAutoStart(runtime);
  const phase = runtime.snapshot?.phase ?? "stopped";
  const running = phase === "running" && runtime.snapshot?.url;
  const pending = runtime.loading || runtime.busy || phase === "starting" || api.state.busy;
  const available = canStartDsh(runtime.snapshot);
  const error = runtime.error || runtime.snapshot?.error;

  if (running && !api.state.busy) return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-nm-bg">
      <DshRuntimeView key={runtime.snapshot?.url} url={runtime.snapshot?.url ?? ""}>
        <FloatingRuntimeControls provider="dsh" label="DSH" initialPositionClassName="right-3 top-3 md:right-[11.5rem]">
          <div>
            <DshRuntimeControls phase={phase} statusTone="#248A3D" busy={runtime.busy} onRestart={() => void runtime.restart()} onStop={() => void runtime.stop()} onImportApi={() => setApiPrompt((value) => !value)} />
            {apiPrompt && <DshApiSyncPrompt onConfirm={() => { setApiPrompt(false); void api.sync(); }} onCancel={() => setApiPrompt(false)} />}
            <DshApiSyncFeedback state={api.state} />
          </div>
        </FloatingRuntimeControls>
      </DshRuntimeView>
    </div>
  );

  return (
    <div className="flex h-full items-center justify-center bg-nm-bg p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        {pending ? <><Loader2 className="mx-auto h-5 w-5 animate-spin text-ink-tertiary" /><p role="status" className="text-sm text-ink-secondary">{api.state.busy ? "正在同步小妍 API…" : "正在打开 DSH…"}</p></> : <>
          <p className="text-sm text-ink-secondary">{error ? "DSH 未能启动" : available ? "DSH 已停止" : "安装 DSH 后即可开始使用"}</p>
          {error && <p role="alert" className="break-words text-xs text-red-700">{error}</p>}
          {!available && <ManagedRuntimeDownloadNotice provider="dsh" label="DSH" available={false} onInstalled={runtime.refresh} />}
          {available && <Button onClick={() => void runtime.start()}>{error ? "重试" : "启动 DSH"}</Button>}
          {!runtime.snapshot && <Button variant="ghost" onClick={() => void runtime.refresh()}>重新加载</Button>}
        </>}
        <DshApiSyncFeedback state={api.state} />
      </div>
    </div>
  );
}

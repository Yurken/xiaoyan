import { AlertTriangle } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { useDshRuntimeView } from "./useDshRuntimeView";
import type { ReactNode } from "react";

export default function DshRuntimeView({ url, children }: { url: string; children?: ReactNode }) {
  const { hostRef, native, error, reload } = useDshRuntimeView(url);

  return (
    <div ref={hostRef} className="relative min-h-0 flex-1 bg-white" aria-label="DeepSeek Harness 页面">
      {!native && <>
        <iframe
          src={url}
          title="DeepSeek Harness"
          className="absolute inset-0 h-full w-full border-0"
          allow="clipboard-read; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox"
        />
        {children}
      </>}
      {error && (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-nm-bg" role="alert">
          <AlertTriangle className="h-5 w-5 text-ink-tertiary" />
          <p className="text-sm text-ink-secondary">{error}</p>
          <Button variant="secondary" onClick={reload}>重新加载</Button>
        </div>
      )}
    </div>
  );
}

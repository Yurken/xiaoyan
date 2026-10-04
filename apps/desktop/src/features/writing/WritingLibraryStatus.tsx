import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { WritingSaveStatus } from "./shared";

interface WritingLibraryStatusProps {
  ready: boolean;
  status: WritingSaveStatus;
  error: string;
  lastSavedAt: Date | null;
  onRetryLoad: () => void;
  onRetrySave: () => void;
}

export default function WritingLibraryStatus({ ready, status, error, lastSavedAt, onRetryLoad, onRetrySave }: WritingLibraryStatusProps) {
  if (error) {
    return (
      <div role="alert" className="space-y-1 text-xs text-apple-red">
        <p className="inline-flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {ready ? "文稿尚未保存：" : "文稿库加载失败："}{error}
        </p>
        <div className="flex items-center gap-2">
          {ready && <span>当前内容仍保留在页面中，请重试后再退出。</span>}
          <button type="button" onClick={ready ? onRetrySave : onRetryLoad} className="font-medium underline underline-offset-2">
            {ready ? "重试保存" : "重新加载"}
          </button>
        </div>
      </div>
    );
  }
  if (!ready || status === "saving") {
    return <span role="status" className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />{ready ? "正在保存…" : "正在加载文稿库…"}</span>;
  }
  if (status === "pending") return <span role="status">有更改待保存…</span>;
  return (
    <span role="status" className="inline-flex items-center gap-1.5">
      <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759]" />
      {lastSavedAt ? `已自动保存 ${lastSavedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "文稿已保存"}
    </span>
  );
}

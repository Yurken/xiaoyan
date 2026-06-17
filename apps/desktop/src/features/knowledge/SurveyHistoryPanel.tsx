import { useEffect, useRef, useState } from "react";
import { History, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { Card } from "@research-copilot/ui";
import SurveyHistoryDetailModal from "./SurveyHistoryDetailModal";
import { useSurveyHistory } from "./useSurveyHistory";

function formatTime(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function SurveyHistoryPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const history = useSurveyHistory();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const isFirstRun = useRef(true);

  // 生成完成后由父级递增 refreshKey 触发刷新；首次挂载由 hook 自身加载，避免重复请求。
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    void history.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <>
      <Card padding="sm" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-ink-tertiary" />
            <p className="text-sm font-semibold text-ink-primary">历史综述</p>
            {history.items.length > 0 ? (
              <span className="rc-accent-chip rounded-full px-2 py-0.5 text-[11px]">{history.items.length}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void history.reload()}
            className="flex items-center gap-1 text-xs text-ink-tertiary transition-colors hover:text-ink-primary"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${history.loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>

        {history.error ? <p className="text-xs text-apple-red">{history.error}</p> : null}

        {history.loading && history.items.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-xs text-ink-tertiary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载中…
          </div>
        ) : history.items.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-tertiary">生成综述后会自动保存到这里，并随 WebDAV 同步到其他设备。</p>
        ) : (
          <ul className="space-y-1.5">
            {history.items.map((item) => (
              <li
                key={item.id}
                className="group flex items-center gap-2 rounded-2xl px-3 py-2 transition-colors hover:bg-black/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => void history.open(item.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm text-ink-primary">{item.query || "未命名综述"}</p>
                  <p className="mt-0.5 text-[11px] text-ink-tertiary">{formatTime(item.created_at)}</p>
                </button>

                {confirmId === item.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        void history.remove(item.id);
                        setConfirmId(null);
                      }}
                      className="rounded-lg bg-apple-red px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-apple-red/90"
                    >
                      {history.removingId === item.id ? "删除中" : "确认删除"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-lg px-1.5 py-1 text-ink-tertiary transition-colors hover:text-ink-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(item.id)}
                    className="flex-shrink-0 rounded-lg p-1.5 text-ink-tertiary opacity-0 transition-all hover:text-apple-red group-hover:opacity-100"
                    aria-label="删除综述"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {history.active ? <SurveyHistoryDetailModal survey={history.active} onClose={history.close} /> : null}
    </>
  );
}

import { useEffect, useRef } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { UserMemory } from "../../lib/client";

interface MemorySectionProps {
  memories: UserMemory[];
  loading: boolean;
  clearingAuto: boolean;
  onEnter: () => void;
  onDelete: (id: string) => void;
  onClearAuto: () => void;
}

export default function MemorySection({
  memories,
  loading,
  clearingAuto,
  onEnter,
  onDelete,
  onClearAuto,
}: MemorySectionProps) {
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  useEffect(() => {
    onEnterRef.current();
  }, []);

  const manualList = memories.filter((m) => m.type === "manual");
  const autoList = memories.filter((m) => m.type === "auto");

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp.slice(0, 16);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <Card padding="md" className="flex items-center gap-2 text-sm text-ink-tertiary">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载记忆中…
        </Card>
      ) : null}

      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">手动备忘</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">
              在「小妍」页侧边栏的「添加记忆」面板中写入，永久保留，每次对话均会参考。
            </p>
          </div>
          <span className="text-xs text-ink-tertiary">{manualList.length} 条</span>
        </div>
        {manualList.length === 0 ? (
          <p className="text-xs text-ink-tertiary">暂无手动备忘。前往「小妍」页侧边栏添加。</p>
        ) : (
          <div className="space-y-2">
            {manualList.map((memory) => (
              <div
                key={memory.id}
                className="flex items-start gap-2 rounded-2xl px-3 py-2.5"
                style={{
                  background: "rgba(0,122,255,0.05)",
                  borderLeft: "3px solid rgba(0,122,255,0.3)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-ink-primary leading-relaxed">{memory.summary}</p>
                  <p className="text-[11px] text-ink-tertiary mt-1">{formatTimestamp(memory.created_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(memory.id)}
                  className="flex-shrink-0 text-ink-tertiary/50 hover:text-apple-red transition-colors mt-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">自动操作记录</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">
              系统自动记录的操作轨迹，最近3小时逐条、近7天按天聚合后注入对话。最多保留1000条。
            </p>
          </div>
          <button
            type="button"
            onClick={onClearAuto}
            disabled={clearingAuto || autoList.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 disabled:opacity-40"
            style={{
              background: "var(--rc-chip-bg)",
              color: "#FF3B30",
              boxShadow: "var(--rc-chip-shadow)",
            }}
          >
            {clearingAuto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            清除所有自动记录
          </button>
        </div>
        {autoList.length === 0 ? (
          <p className="text-xs text-ink-tertiary">暂无自动记录。</p>
        ) : (
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            {autoList.map((memory) => (
              <div
                key={memory.id}
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: "rgba(0,0,0,0.03)" }}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-ink-primary leading-relaxed">{memory.summary}</span>
                  <span className="ml-2 text-[11px] text-ink-tertiary">{formatTimestamp(memory.created_at)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(memory.id)}
                  className="flex-shrink-0 text-ink-tertiary/40 hover:text-apple-red transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

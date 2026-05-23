import { useEffect, useRef } from "react";
import { Loader2, LockKeyhole, Trash2, X } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { MemoryObservation, UserMemory } from "../../lib/client";
import MemoryPrivacyPanel from "./MemoryPrivacyPanel";
import type { MemoryPrivacyGate } from "./useMemoryPrivacyGate";

interface MemorySectionProps {
  memories: UserMemory[];
  observations: MemoryObservation[];
  loading: boolean;
  loadError: string;
  clearingAuto: boolean;
  privacy: MemoryPrivacyGate;
  onEnter: () => void;
  onDelete: (id: string) => void;
  onClearAuto: () => void;
}

function ProtectedDetailsState({
  label,
  pending,
}: {
  label: string;
  pending: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-2xl px-4 py-4 text-sm text-ink-tertiary"
      style={{
        background: "var(--rc-chip-inset-bg)",
        boxShadow: "var(--rc-chip-inset-shadow)",
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
      {pending ? "正在检查详情密码…" : `输入密码后查看${label}详情。`}
    </div>
  );
}

export default function MemorySection({
  memories,
  observations,
  loading,
  loadError,
  clearingAuto,
  privacy,
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
  const detailsProtected = privacy.loading || (privacy.enabled && !privacy.unlocked);

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

  const formatObservationSource = (source: string) => {
    if (source === "chat") return "聊天";
    if (source === "agent") return "小妍步骤";
    if (source === "knowledge_note") return "知识笔记";
    return source;
  };

  const formatImportance = (importance: number) => {
    if (importance >= 3) return "高相关";
    if (importance >= 2) return "常规";
    return "记录";
  };

  return (
    <div className="space-y-4">
      <MemoryPrivacyPanel privacy={privacy} />

      {loading ? (
        <Card padding="md" className="flex items-center gap-2 text-sm text-ink-tertiary">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载记忆中…
        </Card>
      ) : null}

      {loadError ? (
        <Card padding="md" className="border border-rose-200 bg-rose-50 text-xs leading-5 text-rose-700">
          {loadError}
        </Card>
      ) : null}

      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">手动备忘</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">
              在「小妍」页侧边栏的「添加记忆」面板中写入，永久保留；启用长期记忆时，每次对话都会参考。
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
              系统自动记录的操作轨迹；启用长期记忆时，最近3小时逐条、近7天按天聚合后注入对话。最多保留1000条。
            </p>
          </div>
          {!detailsProtected ? (
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
          ) : null}
        </div>
        {detailsProtected ? (
          <ProtectedDetailsState label="自动操作记录" pending={privacy.loading} />
        ) : autoList.length === 0 ? (
          <p className="text-xs text-ink-tertiary">暂无自动记录。</p>
        ) : (
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            {autoList.map((memory) => (
              <div
                key={memory.id}
                className="flex items-start gap-2 rounded-xl px-3 py-2"
                style={{ background: "rgba(0,0,0,0.03)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {memory.action ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: "rgba(10,132,255,0.1)", color: "#0A84FF" }}
                      >
                        {memory.action}
                      </span>
                    ) : null}
                    <span className="text-xs text-ink-primary leading-relaxed">{memory.summary}</span>
                    <span className="text-[11px] text-ink-tertiary">{formatTimestamp(memory.created_at)}</span>
                  </div>
                  {memory.detail ? (
                    <p className="mt-1.5 break-all rounded-xl px-2.5 py-2 text-[11px] leading-5 text-ink-tertiary" style={{ background: "rgba(255,255,255,0.48)" }}>
                      {memory.detail}
                    </p>
                  ) : null}
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

      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">长期记忆观察</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">
              当前已接入聊天主链路、小妍步骤运行和知识笔记操作。高价值过程会沉淀为结构化观察，并在对话时按当前问题做相关召回。
            </p>
          </div>
          <span className="text-xs text-ink-tertiary">{detailsProtected ? "已锁定" : `${observations.length} 条`}</span>
        </div>
        {detailsProtected ? (
          <ProtectedDetailsState label="长期记忆观察" pending={privacy.loading} />
        ) : observations.length === 0 ? (
          <p className="text-xs text-ink-tertiary">暂无长期记忆观察。先和小妍对话几轮后，这里会开始出现过程记录。</p>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {observations.map((observation) => (
              <div
                key={observation.id}
                className="rounded-2xl px-3.5 py-3"
                style={{
                  background: "rgba(10,132,255,0.05)",
                  border: "1px solid rgba(10,132,255,0.12)",
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: "rgba(10,132,255,0.12)", color: "#0A84FF" }}
                  >
                    {formatObservationSource(observation.source)}
                  </span>
                  <span className="text-xs font-semibold text-ink-primary">{observation.title}</span>
                  <span className="text-[11px] text-ink-tertiary">{formatTimestamp(observation.created_at)}</span>
                  <span className="text-[11px] text-ink-tertiary">· {formatImportance(observation.importance)}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-primary">{observation.summary}</p>
                <p className="mt-1.5 text-[11px] leading-5 text-ink-tertiary">{observation.narrative}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { BookMarked, CheckCircle2, Maximize2, Minimize2, PanelRightOpen, PanelRightClose } from "lucide-react";
import { MarkdownRenderer } from "@research-copilot/ui";
import type { AgentArtifact, AgentPlanStep, AgentRun } from "@research-copilot/types";
import AgentStateGraphPanel from "./AgentStateGraphPanel";

interface CopilotOverviewSidebarProps {
  activeRequestId?: string;
  plan: AgentPlanStep[];
  runs: AgentRun[];
  sending: boolean;
  updatingSessionContext: boolean;
  artifacts: AgentArtifact[];
  memoryInput: string;
  memorySaved: boolean;
  savingMemory: boolean;
  onMemoryInputChange: (value: string) => void;
  onSaveMemory: () => void | Promise<void>;
  onArtifactLinkClick: (href: string) => void | Promise<void>;
}

const CARD_STYLE = {
  background: "var(--rc-card-bg)",
  boxShadow: "var(--rc-raised-shadow)",
} as const;

export default function CopilotOverviewSidebar({
  activeRequestId,
  plan,
  runs,
  sending,
  updatingSessionContext,
  artifacts,
  memoryInput,
  memorySaved,
  savingMemory,
  onMemoryInputChange,
  onSaveMemory,
  onArtifactLinkClick,
}: CopilotOverviewSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!expanded) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded]);

  const visibleArtifacts = expanded ? artifacts : artifacts.slice(0, 4);

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label="展开任务纵览"
        onClick={() => setCollapsed(false)}
        className="absolute top-3 right-3 z-10 h-9 w-9 flex items-center justify-center rounded-2xl transition-all duration-150 hover:scale-[1.02] active:scale-95"
        style={{
          background: "var(--rc-card-inset-bg)",
          boxShadow: "var(--rc-inset-shadow)",
          color: "var(--rc-text-secondary)",
        }}
        title="展开任务纵览"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      className={
        expanded
          ? "absolute inset-0 z-20 overflow-hidden"
          : "w-[300px] flex-shrink-0 overflow-y-auto p-3.5"
      }
      style={
        expanded
          ? {
              background:
                "linear-gradient(90deg, rgba(243,246,250,0.96) 0%, rgba(243,246,250,0.92) 28%, rgba(248,250,252,0.98) 100%)",
              boxShadow: "-10px 0 24px rgba(15,23,42,0.16)",
            }
          : {
              background: "linear-gradient(180deg, var(--rc-elevated) 0%, var(--rc-surface) 100%)",
              boxShadow: "-6px 0 16px rgba(0,0,0,0.35)",
            }
      }
    >
      <div
        className={expanded ? "h-full overflow-y-auto p-4" : ""}
      >
        <div
          className={
            expanded
              ? "grid min-h-full auto-rows-min grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)] gap-4"
              : "space-y-3.5"
          }
        >
          <div className={`flex items-center justify-between ${expanded ? "col-span-2" : ""}`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={expanded ? "退出全屏" : "全屏任务总览"}
                onClick={() => setExpanded((currentExpanded) => !currentExpanded)}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-150 hover:scale-[1.02] active:scale-95"
                style={{
                  background: "var(--rc-chip-bg)",
                  boxShadow: "var(--rc-card-shadow)",
                  color: "var(--rc-text-secondary)",
                }}
                title={expanded ? "退出全屏" : "全屏任务总览"}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                aria-label="折叠任务纵览"
                onClick={() => setCollapsed(true)}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-150 hover:scale-[1.02] active:scale-95"
                style={{
                  background: "var(--rc-chip-bg)",
                  boxShadow: "var(--rc-card-shadow)",
                  color: "var(--rc-text-secondary)",
                }}
                title="折叠任务纵览"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            </div>
            <div
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: "var(--rc-card-bg)",
                color: updatingSessionContext ? "#007AFF" : sending ? "#FF9500" : "#34C759",
                boxShadow: "var(--rc-chip-shadow)",
              }}
            >
              {updatingSessionContext ? "正在更新归属" : sending ? "处理中" : "就绪"}
            </div>
          </div>

          <section
            className={expanded ? "col-span-2 rounded-[28px] p-5" : "rounded-3xl p-4"}
            style={CARD_STYLE}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.22em] text-ink-tertiary">任务总览</div>
                <div className="mt-1 text-base font-semibold text-ink-primary">调度视图</div>
                <p className="mt-1 text-xs leading-5 text-ink-tertiary">
                  {expanded ? "已切换为专注视图，可覆盖当前对话区查看任务推进细节。按 Esc 收起。" : "查看小妍当前的调度路径、状态图和结构化产物。"}
                </p>
              </div>
            </div>

            {activeRequestId ? (
              <div
                className="mt-3 rounded-2xl px-3 py-2 text-[11px] text-white break-all"
                style={{ background: "linear-gradient(145deg, #111827, #334155)" }}
              >
                {activeRequestId}
              </div>
            ) : null}
          </section>

          <section
            className={expanded ? "rounded-[28px] p-5" : "rounded-3xl p-4"}
            style={CARD_STYLE}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-ink-primary">状态图执行轨迹</div>
              {expanded ? <span className="text-[11px] text-ink-tertiary">展开后显示完整编排</span> : null}
            </div>
            <AgentStateGraphPanel
              plan={plan}
              runs={runs}
              sending={sending}
              compact={!expanded}
              emptyText="提交问题后，小妍会在这里展示状态图中的节点状态与边流转。"
            />
          </section>

          <section
            className={expanded ? "row-span-2 rounded-[28px] p-5" : "rounded-3xl p-4"}
            style={CARD_STYLE}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-ink-primary">结构化产物</div>
              <span className="rounded-full px-2 py-1 text-[11px] text-ink-tertiary" style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}>
                {artifacts.length} 条
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: expanded ? 620 : 220 }}>
              {visibleArtifacts.length === 0 ? (
                <p className="text-xs leading-5 text-ink-tertiary">当前对话暂无结构化产物。</p>
              ) : (
                visibleArtifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="rounded-2xl px-3 py-3"
                    style={{
                      background: "var(--rc-card-inset-bg)",
                      boxShadow: "var(--rc-inset-shadow)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-ink-primary">{artifact.title}</div>
                      {expanded ? (
                        <span className="text-[10px] uppercase tracking-[0.16em] text-ink-tertiary">{artifact.artifact_type}</span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-ink-tertiary">
                      <MarkdownRenderer
                        content={artifact.content}
                        className={expanded ? "text-sm leading-6 text-ink-secondary" : "text-xs leading-5"}
                        onLinkClick={onArtifactLinkClick}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section
            className={expanded ? "rounded-[28px] p-5 self-start" : "rounded-3xl p-4"}
            style={CARD_STYLE}
          >
            <div className="mb-3 flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-apple-blue" />
              <div className="text-sm font-semibold text-ink-primary">添加记忆</div>
            </div>
            <p className="mb-2.5 text-[11px] leading-5 text-ink-tertiary">
              将重要信息、研究思路或背景告诉小妍，下次对话时会自动参考。
            </p>
            <textarea
              rows={expanded ? 5 : 3}
              value={memoryInput}
              onChange={(event) => onMemoryInputChange(event.target.value)}
              placeholder="例如：我正在研究 LoRA 微调在医疗 NLP 上的应用，重点关注低资源场景…"
              className="w-full resize-none rounded-2xl px-3 py-2.5 text-xs text-ink-primary placeholder:text-ink-tertiary outline-none transition-shadow duration-150"
              style={{
                background: "var(--rc-card-inset-bg)",
                boxShadow: "var(--rc-inset-shadow)",
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              {memorySaved ? (
                <span className="flex items-center gap-1 text-[11px] text-apple-green">
                  <CheckCircle2 className="h-3 w-3" /> 已记住
                </span>
              ) : (
                <span className="text-[11px] text-ink-tertiary">{expanded ? "建议只写稳定背景和长期目标。" : "长期背景会跨会话参考。"}</span>
              )}
              <button
                type="button"
                disabled={!memoryInput.trim() || savingMemory}
                onClick={() => void onSaveMemory()}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                  boxShadow: memoryInput.trim() ? "3px 3px 8px rgba(0,62,204,0.3)" : "none",
                }}
              >
                <BookMarked className="h-3 w-3" />
                {savingMemory ? "保存中…" : "记住这条"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

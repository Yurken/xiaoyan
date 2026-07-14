import { useMemo, useState } from "react";
import { ConfirmDialog, Select } from "@research-copilot/ui";
import { Loader2, Pencil, RefreshCw, RotateCcw, Save, Trash2, X } from "lucide-react";
import type { SettingsHistoryEntry } from "@research-copilot/types";
import RenameSavedEntryModal from "../../components/RenameSavedEntryModal";

interface ConfigHistoryManageModalProps {
  open: boolean;
  entries: SettingsHistoryEntry[];
  loading: boolean;
  loadError: string;
  actionError: string;
  actionMessage: string;
  selectedId: string;
  applyingId: string | null;
  updatingId: string | null;
  renamingId: string | null;
  deletingId: string | null;
  busy?: boolean;
  setSelectedId: (value: string) => void;
  onApplyHistory: (id: string) => Promise<void> | void;
  onUpdateHistory: (id: string) => Promise<void> | void;
  onRenameHistory: (id: string, name: string) => Promise<boolean>;
  onDeleteHistory: (id: string) => Promise<void> | void;
  onReload: () => Promise<void> | void;
  onClose: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  openai_compatible: "兼容 OpenAI",
};

const SEARCH_ENGINE_LABELS: Record<string, string> = {
  arxiv: "arXiv",
  semantic_scholar: "Semantic Scholar",
};

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function MetaChip({ label }: { label: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
    >
      {label}
    </span>
  );
}

type PendingHistoryAction =
  | { type: "apply"; id: string }
  | { type: "update"; id: string }
  | { type: "delete"; id: string };

export default function ConfigHistoryManageModal({
  open,
  entries,
  loading,
  loadError,
  actionError,
  actionMessage,
  selectedId,
  applyingId,
  updatingId,
  renamingId,
  deletingId,
  busy,
  setSelectedId,
  onApplyHistory,
  onUpdateHistory,
  onRenameHistory,
  onDeleteHistory,
  onReload,
  onClose,
}: ConfigHistoryManageModalProps) {
  const [pendingAction, setPendingAction] = useState<PendingHistoryAction | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<SettingsHistoryEntry | null>(null);
  const [renameAttempted, setRenameAttempted] = useState(false);

  const selectOptions = useMemo(
    () => entries.map((item) => ({ value: item.id, label: `${item.name} · ${formatCreatedAt(item.created_at)}` })),
    [entries],
  );

  const handleApply = (id: string) => {
    if (!id) return;
    setPendingAction({ type: "apply", id });
  };
  const handleUpdate = (id: string) => {
    if (!id) return;
    setPendingAction({ type: "update", id });
  };
  const handleDelete = (id: string) => setPendingAction({ type: "delete", id });

  const pendingEntry = pendingAction ? entries.find((item) => item.id === pendingAction.id) : undefined;
  const confirmLoading = pendingAction?.type === "apply"
    ? applyingId === pendingAction.id
    : pendingAction?.type === "update"
      ? updatingId === pendingAction.id
      : pendingAction?.type === "delete"
        ? deletingId === pendingAction.id
        : false;
  const confirmTitle = pendingAction?.type === "delete"
    ? "删除配置历史"
    : pendingAction?.type === "update"
      ? "更新这份配置"
      : "应用配置历史";
  const confirmDescription = pendingAction?.type === "delete"
    ? pendingEntry
      ? `确定要删除“${pendingEntry.name}”这条配置历史吗？删除后将无法恢复。`
      : "确定要删除这条配置历史吗？删除后将无法恢复。"
    : pendingAction?.type === "update"
      ? pendingEntry
        ? `把当前生效配置保存到“${pendingEntry.name}”，原来的快照会被覆盖。继续吗？`
        : "把当前生效配置保存到这条历史，原来的快照会被覆盖。继续吗？"
      : pendingEntry
        ? `应用“${pendingEntry.name}”后，当前配置会被覆盖并立即生效。继续吗？`
        : "应用这份历史配置后，当前配置会被覆盖并立即生效。继续吗？";
  const confirmLabel = pendingAction?.type === "delete"
    ? "确认删除"
    : pendingAction?.type === "update"
      ? "确认更新"
      : "确认应用";

  const confirmPendingAction = () => {
    if (!pendingAction || confirmLoading) return;
    const action = pendingAction;
    const task = action.type === "apply"
      ? onApplyHistory(action.id)
      : action.type === "update"
        ? onUpdateHistory(action.id)
        : onDeleteHistory(action.id);
    void Promise.resolve(task)
      .catch(() => undefined)
      .finally(() => setPendingAction(null));
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl"
          style={{ background: "var(--rc-card-bg)", boxShadow: "var(--rc-raised-shadow)" }}
        >
          <div className="flex items-center gap-2 border-b px-5 py-3.5" style={{ borderColor: "var(--rc-border)" }}>
            <div>
              <h2 className="text-base font-bold text-ink-primary">切换与管理</h2>
              <p className="mt-0.5 text-xs text-ink-tertiary">应用历史配置后，当前生效设置会立刻更新。</p>
            </div>
            <button
              type="button"
              onClick={() => void onReload()}
              disabled={loading}
              className="rc-icon-button ml-auto h-8 w-8 disabled:opacity-50"
              title="刷新列表"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <button type="button" onClick={onClose} className="rc-icon-button h-8 w-8" title="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {loadError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
                {loadError}
              </div>
            ) : null}
            {actionError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
                {actionError}
              </div>
            ) : null}
            {actionMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700">
                {actionMessage}
              </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),auto] lg:items-end">
              <Select
                label="快速切换"
                value={selectedId}
                onChange={setSelectedId}
                options={selectOptions}
                placeholder={entries.length > 0 ? "请选择历史配置" : "暂无历史配置"}
                disabled={entries.length === 0}
              />
              <button
                type="button"
                onClick={() => handleApply(selectedId)}
                disabled={!selectedId || applyingId !== null || busy}
                className="flex items-center justify-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
              >
                {applyingId === selectedId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                应用选中配置
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-4 text-sm text-ink-tertiary">
                正在加载配置历史…
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-nm-dark/10 bg-white/25 px-4 py-6 text-sm text-ink-tertiary">
                还没有保存过配置历史。可以先在「配置历史」里把当前设置存一份，后面再一键切换。
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => {
                  const isApplying = applyingId === entry.id;
                  const isUpdating = updatingId === entry.id;
                  const isRenaming = renamingId === entry.id;
                  const isDeleting = deletingId === entry.id;
                  const isSelected = selectedId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-[24px] px-4 py-4 transition-all duration-150"
                      style={{
                        background: isSelected ? "color-mix(in srgb, var(--rc-accent) 8%, var(--rc-elevated))" : "var(--rc-card-inset-bg)",
                        border: isSelected
                          ? "1px solid color-mix(in srgb, var(--rc-accent) 24%, var(--rc-border))"
                          : "1px solid var(--rc-card-inset-outline)",
                        boxShadow: isSelected ? "var(--rc-card-flat-shadow)" : "var(--rc-card-inset-shadow)",
                      }}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink-primary">{entry.name}</p>
                            <MetaChip label={formatCreatedAt(entry.created_at)} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <MetaChip label={PROVIDER_LABELS[entry.llm_provider] ?? entry.llm_provider} />
                            <MetaChip label={entry.chat_model || "未配置主模型"} />
                            <MetaChip label={SEARCH_ENGINE_LABELS[entry.paper_search_engine] ?? entry.paper_search_engine} />
                            <MetaChip label={entry.multi_agent_enabled ? `小妍步骤 ${entry.enabled_agents_count} 个` : "已关闭小妍步骤"} />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleApply(entry.id)}
                            disabled={applyingId !== null || busy}
                            className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                            style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
                          >
                            {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            应用
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenameAttempted(false);
                              setRenamingEntry(entry);
                            }}
                            disabled={renamingId !== null || busy}
                            className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                            style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
                          >
                            {isRenaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                            重命名
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdate(entry.id)}
                            disabled={updatingId !== null || busy}
                            className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                            style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
                            title="把当前生效配置保存到这条历史"
                          >
                            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            更新
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            disabled={deletingId !== null || busy}
                            className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                            style={{ background: "rgba(255,59,48,0.08)", color: "#D92D20" }}
                          >
                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        cancelLabel="取消"
        tone={pendingAction?.type === "delete" ? "danger" : "default"}
        loading={confirmLoading}
        onClose={() => {
          if (!confirmLoading) setPendingAction(null);
        }}
        onConfirm={confirmPendingAction}
      />

      <RenameSavedEntryModal
        open={renamingEntry !== null}
        title="重命名配置方案"
        description="只修改方案名称，不会覆盖其中保存的 API、模型或小妍步骤配置。"
        label="方案名称"
        initialValue={renamingEntry?.name ?? ""}
        placeholder="例如：主力 API 配置"
        error={renameAttempted ? actionError : ""}
        busy={renamingEntry !== null && renamingId === renamingEntry.id}
        onClose={() => {
          if (!renamingId) {
            setRenamingEntry(null);
            setRenameAttempted(false);
          }
        }}
        onRename={async (name) => {
          if (!renamingEntry) return false;
          setRenameAttempted(true);
          return onRenameHistory(renamingEntry.id, name);
        }}
      />
    </>
  );
}

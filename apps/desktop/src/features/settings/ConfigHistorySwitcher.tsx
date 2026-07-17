import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@research-copilot/ui";
import { Check, ChevronDown, History, Loader2, Plus, RotateCcw, Save, Settings2 } from "lucide-react";
import type { SettingsHistoryEntry } from "@research-copilot/types";

export interface ConfigHistorySwitcherProps {
  entries: SettingsHistoryEntry[];
  loading: boolean;
  selectedId: string;
  saving: boolean;
  applyingId: string | null;
  updatingId: string | null;
  actionError: string;
  actionMessage: string;
  busy?: boolean;
  draftName: string;
  setDraftName: (value: string) => void;
  onSaveCurrent: () => Promise<void> | void;
  onApplyHistory: (id: string) => Promise<void> | void;
  onUpdateHistory: (id: string) => Promise<void> | void;
  onManage?: () => void;
}

export type ConfigHistoryControls = Omit<ConfigHistorySwitcherProps, "onManage">;

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function ConfigHistorySwitcher({
  entries,
  loading,
  selectedId,
  saving,
  applyingId,
  updatingId,
  actionError,
  actionMessage,
  busy,
  draftName,
  setDraftName,
  onSaveCurrent,
  onApplyHistory,
  onUpdateHistory,
  onManage,
}: ConfigHistorySwitcherProps) {
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeEntry = useMemo(
    () => entries.find((item) => item.id === selectedId),
    [entries, selectedId],
  );
  const pendingEntry = useMemo(
    () => (pendingId ? entries.find((item) => item.id === pendingId) : undefined),
    [entries, pendingId],
  );
  const confirmLoading = pendingId !== null && applyingId === pendingId;
  const updateEntry = useMemo(
    () => (pendingUpdateId ? entries.find((item) => item.id === pendingUpdateId) : undefined),
    [entries, pendingUpdateId],
  );
  const updateConfirmLoading = pendingUpdateId !== null && updatingId === pendingUpdateId;

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setComposing(false);
  }, [open]);

  const confirmApply = () => {
    if (!pendingId || confirmLoading) return;
    void Promise.resolve(onApplyHistory(pendingId))
      .catch(() => undefined)
      .finally(() => setPendingId(null));
  };

  const confirmUpdate = () => {
    if (!pendingUpdateId || updateConfirmLoading) return;
    void Promise.resolve(onUpdateHistory(pendingUpdateId))
      .catch(() => undefined)
      .finally(() => setPendingUpdateId(null));
  };

  const handleSave = () => {
    void Promise.resolve(onSaveCurrent())
      .catch(() => undefined)
      .finally(() => setComposing(false));
  };

  const triggerLabel = activeEntry?.name ?? (entries.length > 0 ? "未保存配置" : "配置历史");

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="小妍配置历史·快速切换"
        className="flex max-w-[200px] items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-95"
        style={{
          background: "var(--rc-chip-bg)",
          color: "var(--rc-text-soft)",
          boxShadow: "var(--rc-chip-shadow)",
        }}
      >
        <History className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#AF52DE" }} />
        <span className="min-w-0 truncate">{triggerLabel}</span>
        <ChevronDown
          className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-[20px] p-2"
          style={{
            background: "var(--rc-elevated)",
            border: "1px solid var(--rc-border)",
            boxShadow: "var(--rc-card-pop-shadow, 0 12px 32px rgba(0,0,0,0.18))",
          }}
        >
          <div className="px-2 pb-1.5 pt-1">
            <p className="text-[13px] font-semibold text-ink-primary">小妍配置历史</p>
            <p className="mt-0.5 text-[11px] leading-4 text-ink-tertiary">点选方案即可一键切换当前配置。</p>
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto py-1">
            {loading ? (
              <div className="px-2 py-3 text-xs text-ink-tertiary">正在加载…</div>
            ) : entries.length === 0 ? (
              <div className="px-2 py-3 text-xs leading-5 text-ink-tertiary">
                还没有保存过方案。先把当前配置存一份。
              </div>
            ) : (
              entries.map((entry) => {
                const isActive = selectedId === entry.id;
                const isApplying = applyingId === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setPendingId(entry.id);
                      setOpen(false);
                    }}
                    disabled={applyingId !== null || busy}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 disabled:opacity-50"
                    style={{ background: isActive ? "color-mix(in srgb, var(--rc-accent) 10%, transparent)" : "transparent" }}
                    onMouseEnter={(event) => {
                      if (!isActive) event.currentTarget.style.background = "var(--rc-chip-bg)";
                    }}
                    onMouseLeave={(event) => {
                      if (!isActive) event.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center" style={{ color: "var(--rc-accent)" }}>
                      {isApplying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isActive ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5 text-ink-tertiary" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-[13px] font-medium"
                        style={{ color: isActive ? "var(--rc-text)" : "var(--rc-text-soft)" }}
                      >
                        {entry.name}
                      </span>
                      <span className="block truncate text-[11px] text-ink-tertiary">
                        {entry.chat_model || "未配置主模型"} · {formatCreatedAt(entry.created_at)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {actionMessage ? (
            <p className="px-2 py-1 text-[11px] leading-4 text-emerald-600">{actionMessage}</p>
          ) : null}
          {actionError ? (
            <p className="px-2 py-1 text-[11px] leading-4 text-rose-600">{actionError}</p>
          ) : null}

          <div className="mt-1 border-t pt-1" style={{ borderColor: "var(--rc-border)" }}>
            {composing ? (
              <div className="space-y-1.5 p-1.5">
                <input
                  type="text"
                  value={draftName}
                  autoFocus
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSave();
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setComposing(false);
                    }
                  }}
                  placeholder="方案名称（可选）"
                  className="w-full rounded-xl border-0 px-3 py-2 text-xs text-ink-primary outline-none placeholder:text-ink-tertiary"
                  style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || busy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
                    style={{ background: "var(--rc-button-primary-bg)" }}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {saving ? "保存中…" : "保存"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposing(false)}
                    disabled={saving}
                    className="rounded-xl px-3 py-2 text-xs font-medium text-ink-tertiary transition-colors hover:text-ink-secondary disabled:opacity-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                {activeEntry ? (
                  <button
                    type="button"
                    onClick={() => setPendingUpdateId(activeEntry.id)}
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-ink-secondary transition-colors duration-150 hover:bg-[var(--rc-chip-bg)] disabled:opacity-50"
                  >
                    {updatingId === activeEntry.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span className="min-w-0 truncate">保存修改到「{activeEntry.name}」</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setComposing(true)}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-ink-secondary transition-colors duration-150 hover:bg-[var(--rc-chip-bg)] disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  保存当前为新方案
                </button>
              </>
            )}

            {onManage ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onManage();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-ink-tertiary transition-colors duration-150 hover:bg-[var(--rc-chip-bg)]"
              >
                <Settings2 className="h-3.5 w-3.5" />
                更多管理（重命名、删除、导入导出）
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingId !== null}
        title="切换小妍配置"
        description={
          pendingEntry
            ? `切换到“${pendingEntry.name}”后，当前小妍配置会被覆盖并立即生效。继续吗？`
            : "切换后当前小妍配置会被覆盖并立即生效。继续吗？"
        }
        confirmLabel="确认切换"
        cancelLabel="取消"
        loading={confirmLoading}
        onClose={() => {
          if (!confirmLoading) setPendingId(null);
        }}
        onConfirm={confirmApply}
      />

      <ConfirmDialog
        open={pendingUpdateId !== null}
        title="更新这份方案"
        description={
          updateEntry
            ? `把当前小妍配置保存到“${updateEntry.name}”，原来的快照会被覆盖。继续吗？`
            : "把当前小妍配置保存到所选方案，原来的快照会被覆盖。继续吗？"
        }
        confirmLabel="确认更新"
        cancelLabel="取消"
        loading={updateConfirmLoading}
        onClose={() => {
          if (!updateConfirmLoading) setPendingUpdateId(null);
        }}
        onConfirm={confirmUpdate}
      />
    </div>
  );
}

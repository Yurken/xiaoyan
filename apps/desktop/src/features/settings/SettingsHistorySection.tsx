import { useMemo } from "react";
import { Card, Select } from "@research-copilot/ui";
import { History, Loader2, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import type { SettingsHistoryEntry } from "@research-copilot/types";
import { SectionIcon, SettingInput } from "./shared";

interface SettingsHistorySectionProps {
  entries: SettingsHistoryEntry[];
  loading: boolean;
  loadError: string;
  draftName: string;
  selectedId: string;
  saving: boolean;
  applyingId: string | null;
  deletingId: string | null;
  actionError: string;
  actionMessage: string;
  busy?: boolean;
  setDraftName: (value: string) => void;
  setSelectedId: (value: string) => void;
  onSaveCurrent: () => Promise<void> | void;
  onApplyHistory: (id: string) => Promise<void> | void;
  onDeleteHistory: (id: string) => Promise<void> | void;
  onReload: () => Promise<void> | void;
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
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function MetaChip({ label }: { label: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{
        background: "var(--rc-chip-bg)",
        color: "var(--rc-text-soft)",
        boxShadow: "var(--rc-chip-shadow)",
      }}
    >
      {label}
    </span>
  );
}

export default function SettingsHistorySection({
  entries,
  loading,
  loadError,
  draftName,
  selectedId,
  saving,
  applyingId,
  deletingId,
  actionError,
  actionMessage,
  busy,
  setDraftName,
  setSelectedId,
  onSaveCurrent,
  onApplyHistory,
  onDeleteHistory,
  onReload,
}: SettingsHistorySectionProps) {
  const selectOptions = useMemo(
    () =>
      entries.map((item) => ({
        value: item.id,
        label: `${item.name} · ${formatCreatedAt(item.created_at)}`,
      })),
    [entries],
  );

  const handleApply = (id: string) => {
    if (!id) return;
    const target = entries.find((item) => item.id === id);
    const confirmed = window.confirm(
      target
        ? `应用“${target.name}”后，当前配置会被覆盖并立即生效。继续吗？`
        : "应用这份历史配置后，当前配置会被覆盖并立即生效。继续吗？",
    );
    if (!confirmed) return;
    void onApplyHistory(id);
  };

  const handleDelete = (id: string) => {
    const target = entries.find((item) => item.id === id);
    const confirmed = window.confirm(
      target
        ? `确定要删除“${target.name}”这条配置历史吗？删除后将无法恢复。`
        : "确定要删除这条配置历史吗？删除后将无法恢复。",
    );
    if (!confirmed) return;
    void onDeleteHistory(id);
  };

  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-3">
          <SectionIcon icon={History} color="#0A84FF" />
          <div>
            <h2 className="text-base font-semibold text-ink-primary">配置历史</h2>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              把当前小妍配置保存成一条历史记录，后面需要时可以一键切回来。
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),auto] lg:items-end">
          <SettingInput
            label="历史配置名称（可选）"
            value={draftName}
            onChange={setDraftName}
            placeholder="例如：论文精读方案 / 本地 Ollama / Survey 写作"
            hint="不填名称时，会自动用当前时间生成一条历史记录。"
          />
          <button
            type="button"
            onClick={() => void onSaveCurrent()}
            disabled={saving || busy}
            className="flex items-center justify-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{
              background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
              boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.15)",
            }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "保存中…" : "保存当前配置"}
          </button>
        </div>

        {actionMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700">
            {actionMessage}
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
            {actionError}
          </div>
        ) : null}
      </Card>

      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">切换与管理</h2>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              应用历史配置后，当前生效设置会立刻更新。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onReload()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{
              background: "var(--rc-chip-bg)",
              color: "var(--rc-text-soft)",
              boxShadow: "var(--rc-chip-shadow)",
            }}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            刷新列表
          </button>
        </div>

        {loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
            {loadError}
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
            style={{
              background: "var(--rc-chip-bg)",
              color: "var(--rc-text-soft)",
              boxShadow: "var(--rc-chip-shadow)",
            }}
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
            还没有保存过配置历史。可以先把当前设置存一份，后面再一键切换。
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const isApplying = applyingId === entry.id;
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
                        <MetaChip label={entry.multi_agent_enabled ? `多能力域模型 ${entry.enabled_agents_count} 个` : "已关闭多能力域模型"} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleApply(entry.id)}
                        disabled={applyingId !== null || busy}
                        className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                        style={{
                          background: "var(--rc-chip-bg)",
                          color: "var(--rc-text-soft)",
                          boxShadow: "var(--rc-chip-shadow)",
                        }}
                      >
                        {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        应用
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deletingId !== null || busy}
                        className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                        style={{
                          background: "rgba(255,59,48,0.08)",
                          color: "#D92D20",
                        }}
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
      </Card>
    </div>
  );
}

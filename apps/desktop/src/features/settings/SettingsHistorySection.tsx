import { Card } from "@research-copilot/ui";
import { History, Loader2, Save, Settings2 } from "lucide-react";
import DataConfigTransferCard from "./DataConfigTransferCard";
import { SectionIcon } from "./shared";
import SyncSection from "./SyncSection";

interface SettingsHistorySectionProps {
  draftName: string;
  saving: boolean;
  actionError: string;
  actionMessage: string;
  busy?: boolean;
  settingsTransferBusy?: boolean;
  dataTransferBusy?: boolean;
  setDraftName: (value: string) => void;
  onExportSettings: () => void;
  onImportSettings: () => Promise<void> | void;
  onExportAllData: () => void;
  onImportAllData: () => Promise<void> | void;
  onSaveCurrent: () => Promise<void> | void;
  onManageHistory: () => void;
}

// 配置历史统一在「数据与配置」中保存、切换和管理，覆盖全局可同步设置。
export default function SettingsHistorySection({
  draftName,
  saving,
  actionError,
  actionMessage,
  busy,
  settingsTransferBusy,
  dataTransferBusy,
  setDraftName,
  onExportSettings,
  onImportSettings,
  onExportAllData,
  onImportAllData,
  onSaveCurrent,
  onManageHistory,
}: SettingsHistorySectionProps) {
  return (
    <div className="space-y-4">
      <DataConfigTransferCard
        onExportSettings={onExportSettings}
        onImportSettings={onImportSettings}
        onExportAllData={onExportAllData}
        onImportAllData={onImportAllData}
        settingsBusy={settingsTransferBusy}
        dataBusy={dataTransferBusy}
      />

      <SyncSection />

      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-3">
          <SectionIcon icon={History} color="#0A84FF" />
          <div>
            <h2 className="text-base font-semibold text-ink-primary">全局设置配置历史</h2>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              保存当前全部可同步设置，包含小妍、任务分工、检索与论文导入等；本机应用锁和界面布局不会被覆盖。
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 block text-xs font-medium text-ink-tertiary">历史配置名称（可选）</label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="例如：论文精读方案 / 本地 Ollama / Survey 写作"
                className="w-full rounded-2xl border-0 px-4 py-2.5 text-sm text-ink-primary shadow-none outline-none transition-shadow duration-150 placeholder:text-ink-tertiary"
                style={{
                  background: "var(--rc-chip-inset-bg)",
                  boxShadow: "var(--rc-chip-inset-shadow)",
                }}
                onFocus={(event) => {
                  event.currentTarget.style.boxShadow =
                    "var(--rc-chip-inset-shadow), 0 0 0 2px rgba(0,122,255,0.25)";
                }}
                onBlur={(event) => {
                  event.currentTarget.style.boxShadow = "var(--rc-chip-inset-shadow)";
                }}
              />
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={onManageHistory}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium text-ink-secondary transition-all duration-150 active:scale-95 disabled:opacity-50"
                style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
              >
                <Settings2 className="h-4 w-4" />
                管理历史
              </button>
              <button
                type="button"
                onClick={() => void onSaveCurrent()}
                disabled={saving || busy}
                className="flex items-center justify-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
                style={{
                  background: "var(--rc-button-primary-bg)",
                  boxShadow: "var(--rc-button-primary-shadow)",
                }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "保存中…" : "保存当前设置"}
              </button>
            </div>
          </div>
          <p className="ml-1 text-xs leading-5 text-ink-tertiary">
            不填名称时，会自动用当前时间生成一条全局设置快照。
          </p>
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
    </div>
  );
}

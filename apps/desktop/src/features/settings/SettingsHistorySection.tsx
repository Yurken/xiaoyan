import { Card } from "@research-copilot/ui";
import { History, Loader2, Save } from "lucide-react";
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
}

// 「切换与管理」已迁移到「小妍配置 → 更多管理」弹窗（ConfigHistoryManageModal），此处只保留保存当前配置。
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
            <h2 className="text-base font-semibold text-ink-primary">配置历史</h2>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              把当前小妍配置保存成一条历史记录，后面需要时可以在「小妍配置 → 更多管理」里一键切回来。
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
            <button
              type="button"
              onClick={() => void onSaveCurrent()}
              disabled={saving || busy}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
                boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.15)",
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "保存中…" : "保存当前配置"}
            </button>
          </div>
          <p className="ml-1 text-xs leading-5 text-ink-tertiary">
            不填名称时，会自动用当前时间生成一条历史记录。
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

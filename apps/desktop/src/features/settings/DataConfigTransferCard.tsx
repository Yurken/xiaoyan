import { Card } from "@research-copilot/ui";
import { Database, Download, FileKey2, Upload } from "lucide-react";
import { SectionIcon } from "./shared";

interface DataConfigTransferCardProps {
  onExportSettings: () => void;
  onImportSettings: () => void | Promise<void>;
  onExportAllData: () => void;
  onImportAllData: () => void | Promise<void>;
  settingsBusy?: boolean;
  dataBusy?: boolean;
}

interface TransferButtonProps {
  icon: typeof Download;
  label: string;
  description: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
}

function TransferButton({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
  danger,
}: TransferButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled}
      className="flex min-w-0 items-start gap-3 rounded-3xl px-4 py-4 text-left transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
      style={{
        background: danger ? "rgba(255,59,48,0.08)" : "var(--rc-chip-bg)",
        color: danger ? "#D92D20" : "var(--rc-text)",
        boxShadow: danger ? "none" : "var(--rc-chip-shadow)",
      }}
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl"
        style={{
          background: danger ? "rgba(255,59,48,0.12)" : "var(--rc-chip-inset-bg)",
          boxShadow: danger ? "none" : "var(--rc-chip-inset-shadow)",
        }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-ink-tertiary">{description}</span>
      </span>
    </button>
  );
}

export default function DataConfigTransferCard({
  onExportSettings,
  onImportSettings,
  onExportAllData,
  onImportAllData,
  settingsBusy,
  dataBusy,
}: DataConfigTransferCardProps) {
  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={Database} color="#0A84FF" />
        <div>
          <h2 className="text-base font-semibold text-ink-primary">导入与导出</h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            配置文件只迁移小妍设置；全部数据备份会包含配置历史、论文、会话、记忆、投稿、实验数据和托管文件。
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-3xl px-4 py-4" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
          <div className="mb-3 flex items-center gap-2">
            <FileKey2 className="h-4 w-4 text-[#0A84FF]" />
            <p className="text-sm font-semibold text-ink-primary">配置文件</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TransferButton
              icon={Download}
              label="导出配置"
              description="生成加密 .rcconf 文件。"
              onClick={onExportSettings}
              disabled={settingsBusy}
            />
            <TransferButton
              icon={Upload}
              label="导入配置"
              description="从 .rcconf 恢复设置。"
              onClick={onImportSettings}
              disabled={settingsBusy}
            />
          </div>
        </div>

        <div className="rounded-3xl px-4 py-4" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-[#34C759]" />
            <p className="text-sm font-semibold text-ink-primary">全部数据</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TransferButton
              icon={Download}
              label="导出全部数据"
              description="生成加密 .rcbak 备份。"
              onClick={onExportAllData}
              disabled={dataBusy}
            />
            <TransferButton
              icon={Upload}
              label="导入全部数据"
              description="覆盖本机现有数据。"
              onClick={onImportAllData}
              disabled={dataBusy}
              danger
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

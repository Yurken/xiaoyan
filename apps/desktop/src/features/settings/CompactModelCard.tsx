import { useState, type ComponentType } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MASK, SettingInput, SectionIcon } from "./shared";

interface CompactModelCardProps {
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  description: string;
  recommendation: string;
  affectedScopes: string;
  modelValue: string;
  temperatureValue: string;
  baseUrlValue: string;
  apiKeyValue: string;
  mixedBaseUrl: boolean;
  mixedApiKey: boolean;
  onModelChange: (value: string) => void;
  onTemperatureChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  modelPlaceholder: string;
  temperaturePlaceholder: string;
  secondaryFieldLabel?: string;
  secondaryFieldHint?: string;
  /** 简短状态文本（外部计算） */
  statusSummary: string;
  /** 是否有自定义值 */
  isCustomized: boolean;
}

export function CompactModelCard({
  icon: Icon,
  iconColor,
  title,
  description,
  recommendation,
  affectedScopes,
  modelValue,
  temperatureValue,
  baseUrlValue,
  apiKeyValue,
  mixedBaseUrl,
  mixedApiKey,
  onModelChange,
  onTemperatureChange,
  onBaseUrlChange,
  onApiKeyChange,
  modelPlaceholder,
  temperaturePlaceholder,
  secondaryFieldLabel,
  secondaryFieldHint,
  statusSummary,
  isCustomized,
}: CompactModelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showApiAdvanced, setShowApiAdvanced] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "var(--rc-chip-bg)",
        boxShadow: "var(--rc-chip-shadow)",
      }}
    >
      {/* Compact header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.02]"
      >
        <SectionIcon icon={Icon} color={iconColor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-primary">
              {title}
            </span>
            {isCustomized && (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: iconColor }}
                title="已自定义"
              />
            )}
          </div>
          <span className="text-[11px] text-ink-tertiary block truncate">
            {statusSummary}
          </span>
        </div>
        <div className="flex items-center flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-ink-tertiary" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-ink-tertiary" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Description + scope */}
          <div className="rounded-xl border border-white/70 bg-white/45 px-3 py-2 space-y-1">
            <p className="text-[11px] leading-4 text-ink-secondary">
              {description}
            </p>
            <p className="text-[10px] leading-4 text-ink-tertiary">
              适用范围：{affectedScopes}
            </p>
            <p className="text-[10px] leading-4 text-ink-tertiary italic">
              {recommendation}
            </p>
          </div>

          {/* Model + Temperature */}
          <div className="grid gap-2.5">
            <SettingInput
              label="统一模型"
              value={modelValue}
              onChange={onModelChange}
              placeholder={modelPlaceholder}
              hint="留空则沿用上方主模型。"
            />
            <SettingInput
              label={secondaryFieldLabel ?? "统一温度"}
              value={temperatureValue}
              onChange={onTemperatureChange}
              placeholder={temperaturePlaceholder}
              hint={
                secondaryFieldHint ?? "留空沿用现有温度，填写则统一覆盖。"
              }
            />
          </div>

          {/* Advanced API config toggle */}
          <button
            type="button"
            onClick={() => setShowApiAdvanced((prev) => !prev)}
            className="flex items-center gap-1.5 text-[11px] text-ink-tertiary hover:text-ink-secondary transition-colors"
          >
            {showApiAdvanced ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {showApiAdvanced ? "收起独立接口" : "独立接口配置"}
          </button>

          {showApiAdvanced && (
            <div className="grid gap-2.5 pt-1 border-t border-nm-dark/10">
              {mixedBaseUrl || mixedApiKey ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2">
                  <p className="text-[11px] leading-4 text-amber-800">
                    组内已有不同接口配置。重新填写将统一覆盖。
                  </p>
                </div>
              ) : null}
              <SettingInput
                label="接口地址"
                value={baseUrlValue}
                onChange={onBaseUrlChange}
                placeholder="留空继承主服务商"
                hint="为该组单独指定接口地址。"
              />
              <SettingInput
                label="接口密钥"
                value={apiKeyValue}
                onChange={onApiKeyChange}
                placeholder="sk-..."
                sensitive
                hint={`留空或输入 ${MASK} 表示不更改`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

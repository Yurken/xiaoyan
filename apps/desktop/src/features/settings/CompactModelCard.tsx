import { useState, type ComponentType } from "react";
import { AlertCircle, Check, ChevronDown, ChevronRight, Loader2, Wifi } from "lucide-react";
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
  /** 该角色测试连接状态：以卡片红/绿配色展示 */
  roleTestState?: "idle" | "testing" | "ok" | "error";
  onTestRole?: () => void;
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
  roleTestState = "idle",
  onTestRole,
}: CompactModelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showApiAdvanced, setShowApiAdvanced] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background:
          roleTestState === "ok"
            ? "rgba(52,199,89,0.12)"
            : roleTestState === "error"
              ? "rgba(255,69,58,0.12)"
              : "var(--rc-chip-bg)",
        boxShadow:
          roleTestState === "ok"
            ? "0 0 0 1px rgba(52,199,89,0.5)"
            : roleTestState === "error"
              ? "0 0 0 1px rgba(255,69,58,0.5)"
              : "var(--rc-chip-shadow)",
      }}
    >
      {/* Compact header — always visible */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer transition-colors hover:bg-black/[0.02]"
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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onTestRole ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onTestRole();
              }}
              disabled={roleTestState === "testing"}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-60"
              style={{
                background:
                  roleTestState === "ok"
                    ? "rgba(52,199,89,0.18)"
                    : roleTestState === "error"
                      ? "rgba(255,69,58,0.18)"
                      : "var(--rc-chip-inset-bg)",
                color:
                  roleTestState === "ok"
                    ? "#1f9d4d"
                    : roleTestState === "error"
                      ? "#D92D20"
                      : "var(--rc-text-soft)",
              }}
              title="测试该角色模型连接"
            >
              {roleTestState === "testing" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : roleTestState === "ok" ? (
                <Check className="h-3 w-3" />
              ) : roleTestState === "error" ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <Wifi className="h-3 w-3" />
              )}
              测试
            </button>
          ) : null}
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-ink-tertiary" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-ink-tertiary" />
          )}
        </div>
      </div>

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

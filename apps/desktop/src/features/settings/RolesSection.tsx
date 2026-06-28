import { useState } from "react";
import { Bot, Check, ChevronRight, Route, Sparkles, Wand2 } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { AppSettings } from "@research-copilot/types";
import { apiClient } from "../../lib/client";
import {
  AGENT_GUIDES,
  AGENT_OPTIONS,
  AgentChip,
  CHARACTERISTIC_MODEL_CARDS,
  MASK,
  RecommendationList,
  SectionIcon,
  SettingInput,
  ToggleRow,
} from "./shared";

export type RoleTestState = "idle" | "testing" | "ok" | "error";
import { CompactModelCard } from "./CompactModelCard";
import {
  MODEL_PRESETS,
  detectModelPreset,
  applyModelPreset,
  isCardCustomized,
  getCardStatusSummary,
} from "./modelPresets";

interface RolesSectionProps {
  form: AppSettings;
  enabledAgents: string[];
  set: (key: keyof AppSettings) => (value: string) => void;
  setMany: (keys: (keyof AppSettings)[]) => (value: string) => void;
  getSharedValue: (keys: (keyof AppSettings)[]) => string;
  hasMixedValue: (keys: (keyof AppSettings)[]) => boolean;
  toggleAgent: (agentName: string) => void;
  /** 批量设置多个 key（用于预设应用） */
  setManyFlat: (updates: Partial<Record<keyof AppSettings, string>>) => void;
  /** 主服务商可用模型查询（供各角色「统一模型」下拉） */
  availableModels: string[];
  loadingModels: boolean;
  modelsError: string;
  loadModels: () => Promise<void>;
}

export default function RolesSection({
  form,
  enabledAgents,
  set,
  setMany,
  getSharedValue,
  hasMixedValue,
  toggleAgent,
  setManyFlat,
  availableModels,
  loadingModels,
  modelsError,
  loadModels,
}: RolesSectionProps) {
  const [showAllCards, setShowAllCards] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [roleTestStates, setRoleTestStates] = useState<Record<string, RoleTestState>>({});
  const activePreset = detectModelPreset(form);

  // Count how many cards have custom values
  const customizedCount = CHARACTERISTIC_MODEL_CARDS.filter((card) =>
    isCardCustomized(form, card),
  ).length;

  // 当前主服务商对应的「主聊天模型 / 地址 / 密钥」字段，用于把某角色的配置覆盖进去单独测试。
  const providerChatModelKey = (): "openai_chat_model" | "anthropic_chat_model" | "openai_compatible_chat_model" =>
    form.llm_provider === "openai" ? "openai_chat_model"
      : form.llm_provider === "anthropic" ? "anthropic_chat_model"
        : "openai_compatible_chat_model";
  const providerBaseUrlKey = (): "openai_base_url" | "openai_compatible_base_url" | null =>
    form.llm_provider === "openai" ? "openai_base_url"
      : form.llm_provider === "anthropic" ? null
        : "openai_compatible_base_url";
  const providerApiKeyKey = (): "openai_api_key" | "anthropic_api_key" | "openai_compatible_api_key" =>
    form.llm_provider === "openai" ? "openai_api_key"
      : form.llm_provider === "anthropic" ? "anthropic_api_key"
        : "openai_compatible_api_key";

  // 测试某个角色：把该角色的模型（及独立地址/密钥，若有）覆盖进表单后调用 settings.test，
  // 结果只反映到该角色卡片，不影响全局连接状态。
  const handleTestRole = async (item: (typeof CHARACTERISTIC_MODEL_CARDS)[number]) => {
    const key = item.title;
    setRoleTestStates((prev) => ({ ...prev, [key]: "testing" }));
    try {
      // 视觉模型需发送真实测试图确认多模态能力，走专用的视觉连接测试（直接读 form 里的 vision_* 字段）。
      if (item.modelKeys.includes("vision_model")) {
        await apiClient.settings.testVision(form);
      } else {
        const testForm: Partial<AppSettings> = { ...form };
        const roleModel = getSharedValue(item.modelKeys).trim();
        if (roleModel) testForm[providerChatModelKey()] = roleModel;
        const baseKey = providerBaseUrlKey();
        const roleBaseUrl = baseKey ? getSharedValue(item.baseUrlKeys).trim() : "";
        if (baseKey && roleBaseUrl) testForm[baseKey] = roleBaseUrl;
        const roleApiKey = getSharedValue(item.apiKeyKeys).trim();
        if (roleApiKey && roleApiKey !== MASK) testForm[providerApiKeyKey()] = roleApiKey;
        await apiClient.settings.test(testForm);
      }
      setRoleTestStates((prev) => ({ ...prev, [key]: "ok" }));
      window.setTimeout(
        () => setRoleTestStates((prev) => (prev[key] === "ok" ? { ...prev, [key]: "idle" } : prev)),
        4000,
      );
    } catch (error) {
      console.error("Role test failed:", error);
      setRoleTestStates((prev) => ({ ...prev, [key]: "error" }));
      window.setTimeout(
        () => setRoleTestStates((prev) => (prev[key] === "error" ? { ...prev, [key]: "idle" } : prev)),
        5000,
      );
    }
  };

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={Sparkles} color="#0A84FF" />
        <div>
          <h2 className="text-base font-semibold text-ink-primary">任务分工</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">
            为各专项任务指定模型。留空则沿用上方的小妍默认模型。
          </p>
        </div>
      </div>

      {/* Model Preset Selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-[#AF52DE]" />
          <span className="text-xs font-semibold text-ink-secondary">
            快速配置
          </span>
          {customizedCount > 0 && activePreset == null && (
            <span className="text-[10px] text-ink-tertiary">
              （{customizedCount} 项已自定义）
            </span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {MODEL_PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const updates = applyModelPreset(preset.id);
                  setManyFlat(updates);
                }}
                className="rounded-2xl px-3 py-2 text-left transition-all duration-150 min-w-[140px]"
                style={
                  isActive
                    ? {
                        background:
                          "linear-gradient(145deg, #1A8AFF, #0062CC)",
                        color: "#FFFFFF",
                        boxShadow:
                          "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)",
                      }
                    : {
                        background: "var(--rc-chip-bg)",
                        color: "var(--rc-text-soft)",
                        boxShadow: "var(--rc-chip-shadow)",
                      }
                }
              >
                <div className="flex items-center gap-1.5">
                  {/* <span className="text-sm">{preset.icon}</span> */}
                  <span className="text-xs font-semibold">{preset.label}</span>
                  {isActive && <Check className="w-3 h-3 ml-auto" />}
                </div>
                <p
                  className="mt-1 text-[10px] leading-3.5"
                  style={{ opacity: isActive ? 0.85 : 0.65 }}
                >
                  {preset.description}
                </p>
              </button>
            );
          })}

          {/* "Custom" indicator when no preset matches */}
          {activePreset == null && customizedCount > 0 && (
            <div
              className="rounded-2xl px-3 py-2 min-w-[100px] flex items-center"
              style={{
                background: "var(--rc-chip-bg)",
                boxShadow: "var(--rc-chip-shadow)",
                border: "1px dashed rgba(0,122,255,0.3)",
              }}
            >
              <span className="text-xs font-medium text-ink-secondary">
                自定义配置
              </span>
            </div>
          )}
        </div>
      </div>

      <RecommendationList
        items={[
          "流光是极速轻量应答，谋策负责深度推理，洞见做长文精读，翰章做结构化写作，构域处理代码工程，溯源负责向量化和检索，视界负责多模态，探知负责联网搜索。按场景分配，效果与成本更优。",
          "全部留空也可正常使用，所有角色回退到上方默认模型。",
        ]}
      />

      {/* Compact Model Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
            角色模型配置
          </span>
          <button
            type="button"
            onClick={() => setShowAllCards((prev) => !prev)}
            className="text-[11px] text-ink-tertiary hover:text-ink-secondary transition-colors"
          >
            {showAllCards ? "收起未修改项" : "展开全部"}
          </button>
        </div>

        <div className="space-y-1.5">
          {CHARACTERISTIC_MODEL_CARDS.map((item) => {
            const customized = isCardCustomized(form, item);
            // If not showing all, only show customized cards
            if (!showAllCards && !customized) {
              return null;
            }
            return (
              <CompactModelCard
                key={item.title}
                icon={item.icon}
                iconColor={item.iconColor}
                title={item.title}
                description={item.description}
                recommendation={item.recommendation}
                affectedScopes={item.affectedScopes}
                modelValue={getSharedValue(item.modelKeys)}
                temperatureValue={getSharedValue(item.temperatureKeys)}
                baseUrlValue={getSharedValue(item.baseUrlKeys)}
                apiKeyValue={getSharedValue(item.apiKeyKeys)}
                mixedBaseUrl={hasMixedValue(item.baseUrlKeys)}
                mixedApiKey={hasMixedValue(item.apiKeyKeys)}
                onModelChange={setMany(item.modelKeys)}
                onTemperatureChange={setMany(item.temperatureKeys)}
                onBaseUrlChange={setMany(item.baseUrlKeys)}
                onApiKeyChange={setMany(item.apiKeyKeys)}
                modelPlaceholder={item.modelPlaceholder}
                temperaturePlaceholder={item.temperaturePlaceholder}
                secondaryFieldLabel={item.secondaryFieldLabel}
                secondaryFieldHint={item.secondaryFieldHint}
                availableModels={availableModels}
                loadingModels={loadingModels}
                modelsError={modelsError}
                onQueryModels={() => void loadModels()}
                statusSummary={getCardStatusSummary(form, item)}
                isCustomized={customized}
                roleTestState={roleTestStates[item.title] ?? "idle"}
                onTestRole={() => handleTestRole(item)}
              />
            );
          })}

          {/* Show "all default" message when collapsed and nothing customized */}
          {!showAllCards && customizedCount === 0 && (
            <div
              className="rounded-xl px-3 py-3 text-center"
              style={{
                background: "var(--rc-surface)",
                boxShadow: "var(--rc-inset-shadow)",
              }}
            >
              <p className="text-xs text-ink-tertiary">
                所有角色均沿用主模型配置。
              </p>
              <p className="text-[10px] text-ink-tertiary mt-1">
                选择上方快速配置预设，或点击"展开全部"手动设置各角色模型。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Multi-agent collaboration section */}
      <div className="pt-4 border-t border-nm-dark/10 space-y-4">
        <div className="flex items-center gap-3">
          <SectionIcon icon={Bot} color="#34C759" />
          <div>
            <h2 className="text-base font-semibold text-ink-primary">
              小妍步骤协作
            </h2>
            <p className="text-xs text-ink-tertiary mt-0.5">
              开启后，复杂问题会自动拆分成多步协作完成。
            </p>
          </div>
        </div>

        <ToggleRow
          title="启用小妍步骤协作"
          description="关闭后仅使用默认模型直接回复，不拆分复杂任务。"
          checked={form.multi_agent_enabled === "true"}
          onToggle={() =>
            set("multi_agent_enabled")(
              form.multi_agent_enabled === "true" ? "false" : "true",
            )
          }
        />

        {/* 高级设置：参与步骤与执行上限，默认折叠，普通用户无需关心 */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-tertiary hover:text-ink-secondary transition-colors"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
            />
            高级设置（参与步骤与执行上限）
          </button>

          {showAdvanced && (
            <div className="space-y-4 pt-1">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-[#1A8AFF]" />
                  <p className="text-sm font-semibold text-ink-primary">
                    小妍步骤开关
                  </p>
                </div>
                <p className="text-xs text-ink-tertiary">
                  默认全部开启。如需限制小妍可调度的能力步骤，可在此关闭，关闭后不会被纳入考量。
                </p>

                <div className="flex gap-2 flex-wrap pb-2">
                  {AGENT_OPTIONS.map(([value, label]) => (
                    <AgentChip
                      key={value}
                      label={label}
                      active={enabledAgents.includes(value)}
                      onClick={() => toggleAgent(value)}
                    />
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {AGENT_GUIDES.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3 shadow-sm"
                    >
                      <p className="text-xs font-semibold text-ink-primary">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-ink-tertiary">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <SettingInput
                  label="单次最多调用的小妍步骤上限"
                  value={form.multi_agent_max_steps}
                  onChange={set("multi_agent_max_steps")}
                  placeholder="6"
                  hint="超过该步数将强制中断小妍步骤流程。"
                />
                <SettingInput
                  label="文献检索模型抓取条数上限"
                  value={form.multi_agent_search_limit}
                  onChange={set("multi_agent_search_limit")}
                  placeholder="8"
                  hint="搜索接口每次返回的文献条数上限。"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

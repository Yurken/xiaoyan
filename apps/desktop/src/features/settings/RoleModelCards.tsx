import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AppSettings } from "@research-copilot/types";
import { apiClient } from "../../lib/client";
import { CompactModelCard } from "./CompactModelCard";
import { MASK } from "./shared";
import type { EndpointModelConfig } from "./useEndpointModels";
import {
  ADVANCED_ROLE_CARDS,
  PRIMARY_ROLE_CARDS,
  getCardStatusSummary,
  isCardCustomized,
  type ModelRoleCard,
} from "./roleRegistry";

type RoleTestState = "idle" | "testing" | "ok" | "error";

interface RoleModelCardsProps {
  form: AppSettings;
  getSharedValue: (keys: (keyof AppSettings)[]) => string;
  hasMixedValue: (keys: (keyof AppSettings)[]) => boolean;
  setMany: (keys: (keyof AppSettings)[]) => (value: string) => void;
}

/**
 * 角色模型卡片区。
 *
 * 默认只展示 `primary` 槽位（主模型之外的硬能力边界：视觉、向量化）；纯文本任务的
 * 成本 / 延迟微调折叠在「高级：按任务指定模型」里——它们留空即继承主模型。
 */
export default function RoleModelCards({
  form,
  getSharedValue,
  hasMixedValue,
  setMany,
}: RoleModelCardsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [roleTestStates, setRoleTestStates] = useState<Record<string, RoleTestState>>({});
  const [roleTestErrors, setRoleTestErrors] = useState<Record<string, string>>({});

  const customizedAdvancedCount = ADVANCED_ROLE_CARDS.filter((card) =>
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

  // 主服务商的端点配置，供未填独立地址的角色卡片回退使用。
  const mainEndpointConfig = (): EndpointModelConfig | null => {
    if (form.llm_provider === "anthropic") {
      return {
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: form.anthropic_api_key.trim(),
      };
    }
    const isOpenAI = form.llm_provider === "openai";
    const baseUrl = isOpenAI
      ? form.openai_base_url.trim()
      : form.openai_compatible_base_url.trim();
    const apiKey = isOpenAI
      ? form.openai_api_key.trim()
      : form.openai_compatible_api_key.trim();
    if (!baseUrl) return null;
    return { baseUrl, apiKey };
  };

  const effectiveApiKey = (value: string) => (value.trim() === MASK ? "" : value.trim());

  const cardEndpointConfig = (
    baseUrlValue: string,
    apiKeyValue: string,
    mixedBaseUrl: boolean,
    mixedApiKey: boolean,
  ): EndpointModelConfig | null => {
    if (mixedBaseUrl || mixedApiKey) return null;
    const main = mainEndpointConfig();
    const baseUrl = baseUrlValue.trim() || main?.baseUrl || "";
    const apiKey = effectiveApiKey(apiKeyValue) || main?.apiKey || "";
    if (!baseUrl) return null;
    return { baseUrl, apiKey };
  };

  // 测试某个角色：把该角色的模型（及独立地址/密钥，若有）覆盖进表单后调用 settings.test，
  // 结果只反映到该角色卡片，不影响全局连接状态。
  const handleTestRole = async (item: ModelRoleCard) => {
    const key = item.id;
    setRoleTestStates((prev) => ({ ...prev, [key]: "testing" }));
    setRoleTestErrors((prev) => ({ ...prev, [key]: "" }));
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
      setRoleTestErrors((prev) => ({ ...prev, [key]: "" }));
      window.setTimeout(
        () => setRoleTestStates((prev) => (prev[key] === "ok" ? { ...prev, [key]: "idle" } : prev)),
        4000,
      );
    } catch (error) {
      console.error("Role test failed:", error);
      const message =
        typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
      setRoleTestStates((prev) => ({ ...prev, [key]: "error" }));
      setRoleTestErrors((prev) => ({ ...prev, [key]: message }));
      window.setTimeout(
        () => setRoleTestStates((prev) => (prev[key] === "error" ? { ...prev, [key]: "idle" } : prev)),
        5000,
      );
    }
  };

  const renderCard = (item: ModelRoleCard) => {
    const customized = isCardCustomized(form, item);
    const mixedBaseUrl = hasMixedValue(item.baseUrlKeys);
    const mixedApiKey = hasMixedValue(item.apiKeyKeys);
    return (
      <CompactModelCard
        key={item.id}
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
        mixedBaseUrl={mixedBaseUrl}
        mixedApiKey={mixedApiKey}
        onModelChange={setMany(item.modelKeys)}
        onTemperatureChange={setMany(item.temperatureKeys)}
        onBaseUrlChange={setMany(item.baseUrlKeys)}
        onApiKeyChange={setMany(item.apiKeyKeys)}
        modelPlaceholder={item.modelPlaceholder}
        temperaturePlaceholder={item.temperaturePlaceholder}
        secondaryFieldLabel={item.secondaryFieldLabel}
        secondaryFieldHint={item.secondaryFieldHint}
        endpointConfig={() =>
          cardEndpointConfig(
            getSharedValue(item.baseUrlKeys),
            getSharedValue(item.apiKeyKeys),
            mixedBaseUrl,
            mixedApiKey,
          )
        }
        statusSummary={getCardStatusSummary(form, item)}
        isCustomized={customized}
        roleTestState={roleTestStates[item.id] ?? "idle"}
        roleTestError={roleTestErrors[item.id] ?? ""}
        onTestRole={() => void handleTestRole(item)}
      />
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
          需要单独确认的模型
        </p>
        {PRIMARY_ROLE_CARDS.map(renderCard)}
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide hover:text-ink-secondary transition-colors"
        >
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
          />
          高级：按任务指定模型
          {!showAdvanced && customizedAdvancedCount > 0 && (
            <span className="normal-case tracking-normal text-ink-tertiary">
              （{customizedAdvancedCount} 项已自定义）
            </span>
          )}
        </button>

        {showAdvanced ? (
          <div className="space-y-1.5">{ADVANCED_ROLE_CARDS.map(renderCard)}</div>
        ) : (
          <p className="text-[11px] leading-4 text-ink-tertiary">
            {customizedAdvancedCount > 0
              ? `其余 ${ADVANCED_ROLE_CARDS.length} 个文本任务中有 ${customizedAdvancedCount} 个使用了指定模型，其余沿用主模型。`
              : `其余 ${ADVANCED_ROLE_CARDS.length} 个文本任务全部沿用主模型。只有在想按任务分摊成本或延迟时才需要展开。`}
          </p>
        )}
      </div>
    </div>
  );
}
import type { Dispatch, SetStateAction } from "react";
import { Brain, Loader2, Wifi } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { AppSettings, LlmProvider, PaperSearchEngine } from "@research-copilot/types";
import { MASK, SectionIcon, SettingInput } from "./shared";
import { ANTHROPIC_ENDPOINT, PROVIDER_PRESETS, type ProviderPresetId } from "./providerPresets";
import ConfigHistorySwitcher, { type ConfigHistoryControls } from "./ConfigHistorySwitcher";
import OllamaEmbeddingPanel from "./OllamaEmbeddingPanel";
import ProviderIcon from "./ProviderIcon";
import ModelCombobox from "./ModelCombobox";
import WebSearchSection from "./WebSearchSection";

interface ConnectionSectionProps {
  contentUnavailable: boolean;
  provider: LlmProvider;
  activePreset: ProviderPresetId;
  form: AppSettings;
  ollamaModels: string[];
  loadingOllamaModels: boolean;
  availableModels: string[];
  loadingModels: boolean;
  modelsError: string;
  loadModels: () => Promise<void>;
  configHistory: ConfigHistoryControls;
  onManageConfigHistory: () => void;
  setForm: Dispatch<SetStateAction<AppSettings>>;
  set: (key: keyof AppSettings) => (value: string) => void;
  applyPreset: (presetId: ProviderPresetId) => void;
  loadOllamaModels: () => Promise<void>;
  connectionActions: ConnectionActions;
}

/** 全局「测试连接」操作 + 自动保存状态（按钮从设置页头移到小妍卡片头部；保存改为自动）。 */
export interface ConnectionActions {
  testState: "idle" | "testing" | "ok" | "error";
  testMsg: string;
  saveState: "idle" | "saving" | "saved" | "error";
  busy: boolean;
  onTest: () => void;
}

function PresetCard({
  active,
  id,
  label,
  onClick,
}: {
  active: boolean;
  id: ProviderPresetId;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[18px] px-3 py-2.5 text-left transition-all duration-150"
      style={
        active
          ? {
              background: "color-mix(in srgb, var(--rc-accent) 10%, var(--rc-elevated))",
              border: "1px solid color-mix(in srgb, var(--rc-accent) 26%, var(--rc-border))",
              boxShadow: "var(--rc-card-flat-shadow)",
            }
          : {
              background: "var(--rc-card-inset-bg)",
              border: "1px solid var(--rc-card-inset-outline)",
              boxShadow: "var(--rc-card-inset-shadow)",
            }
      }
    >
      <ProviderIcon
        id={id}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[20px] text-ink-primary [&>svg]:h-[1em] [&>svg]:w-[1em]"
      />
      <span className="truncate text-sm font-semibold text-ink-primary">{label}</span>
    </button>
  );
}

function ReadonlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="space-y-1.5 md:col-span-2">
      <label className="ml-1 block text-xs font-medium text-ink-tertiary">{label}</label>
      <div
        className="rounded-2xl border px-4 py-2.5 text-sm text-ink-primary"
        style={{
          background: "var(--rc-control-bg)",
          borderColor: "var(--rc-control-border)",
          boxShadow: "var(--rc-control-shadow)",
        }}
      >
        {value}
      </div>
      <p className="ml-1 text-xs leading-5 text-ink-tertiary">{hint}</p>
    </div>
  );
}

const SEARCH_ENGINE_OPTIONS: { value: PaperSearchEngine; label: string; description: string }[] = [
  { value: "arxiv", label: "arXiv", description: "免费开源预印本平台，覆盖物理、数学、计算机等领域。" },
  { value: "semantic_scholar", label: "Semantic Scholar", description: "AI 驱动的学术搜索引擎，覆盖更广、支持中文关键词直接检索。" },
];

export default function ConnectionSection({
  contentUnavailable,
  provider,
  activePreset,
  form,
  ollamaModels,
  loadingOllamaModels,
  availableModels,
  loadingModels,
  modelsError,
  loadModels,
  configHistory,
  onManageConfigHistory,
  setForm,
  set,
  applyPreset,
  loadOllamaModels,
  connectionActions,
}: ConnectionSectionProps) {
  const { testState, testMsg, saveState, busy: actionsBusy, onTest } = connectionActions;
  const activePresetMeta = PROVIDER_PRESETS.find((preset) => preset.id === activePreset);
  const isOpenAI = provider === "openai";
  const isAnthropic = provider === "anthropic";
  const isOpenAICompatible = provider === "openai_compatible";

  const baseUrlValue = isOpenAI
    ? form.openai_base_url
    : isOpenAICompatible
      ? form.openai_compatible_base_url
      : "";
  const apiKeyValue = isOpenAI
    ? form.openai_api_key
    : isAnthropic
      ? form.anthropic_api_key
      : form.openai_compatible_api_key;
  const chatModelValue = isOpenAI
    ? form.openai_chat_model
    : isAnthropic
      ? form.anthropic_chat_model
      : form.openai_compatible_chat_model;
  const embeddingModelValue = isOpenAI
    ? form.openai_embedding_model
    : form.openai_compatible_embedding_model;

  const embeddingHint = isOpenAI
    ? "默认向量模型，可在下方分工区覆盖。"
    : activePreset === "moonshot" || activePreset === "gemini"
      ? "该服务商无向量接口，建议在分工区为溯源模型单独配置。"
      : activePreset === "custom"
        ? "如无 embedding 可留空，在下方分工区补充。"
        : "留空则沿用当前主服务商的默认向量模型。";

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <SectionIcon icon={Brain} color="#AF52DE" />
          <div>
            <h2 className="text-base font-semibold text-ink-primary">小妍</h2>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              点击厂商卡片自动填入接口地址和推荐模型，之后仍可手动修改。
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={onTest}
              disabled={testState === "testing" || actionsBusy}
              className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background:
                  testState === "ok"
                    ? "linear-gradient(145deg,#40D466,#28A844)"
                    : testState === "error"
                      ? "linear-gradient(145deg,#FF5555,#CC2200)"
                      : "var(--rc-chip-bg)",
                color: testState === "ok" || testState === "error" ? "#fff" : "var(--rc-text-soft)",
                boxShadow: testState === "idle" || testState === "testing" ? "var(--rc-chip-shadow)" : "none",
              }}
            >
              {testState === "testing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
              {testState === "testing" ? "测试中…" : testState === "ok" ? "连接正常" : testState === "error" ? "连接失败" : "测试连接"}
            </button>
            {testState === "error" && testMsg ? (
              <span className="absolute right-0 top-full z-10 mt-0.5 whitespace-nowrap text-xs text-red-500">
                {testMsg.slice(0, 30)}
              </span>
            ) : null}
          </div>
          <span
            className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-ink-tertiary"
            style={saveState === "saved" ? { color: "#1f9d4d" } : saveState === "error" ? { color: "#D92D20" } : undefined}
            title="设置改动会自动保存"
          >
            {saveState === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {saveState === "saving" ? "保存中…" : saveState === "saved" ? "已保存" : saveState === "error" ? "保存失败" : "自动保存"}
          </span>
          {!contentUnavailable ? (
            <ConfigHistorySwitcher {...configHistory} onManage={onManageConfigHistory} />
          ) : null}
        </div>
      </div>

      {!contentUnavailable ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="ml-1 block text-xs font-medium text-ink-tertiary">常见厂商</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROVIDER_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  active={activePreset === preset.id}
                  id={preset.id}
                  label={preset.label}
                  onClick={() => applyPreset(preset.id)}
                />
              ))}
            </div>
          </div>

          <div
            className="rounded-2xl px-4 py-3 text-xs leading-5 text-ink-tertiary"
            style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-card-inset-outline)" }}
          >
            当前预设：<span className="font-medium text-ink-secondary">{activePresetMeta?.label ?? "自定义兼容服务"}</span>。下方可继续配置任务分工与高级选项。
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {isAnthropic ? (
              <ReadonlyField
                label="接口地址"
                value={ANTHROPIC_ENDPOINT}
                hint="Anthropic 使用原生 Messages API，不支持自定义 URL。"
              />
            ) : (
              <SettingInput
                label="接口地址"
                value={baseUrlValue}
                onChange={set(isOpenAI ? "openai_base_url" : "openai_compatible_base_url")}
                placeholder={activePresetMeta?.baseUrl || "https://api.example.com/v1"}
                hint={activePreset === "custom" ? "填写 OpenAI 兼容接口的根地址，通常以 /v1 结尾（如 https://api.example.com/v1）。" : undefined}
              />
            )}

            <SettingInput
              label="接口密钥"
              value={apiKeyValue}
              onChange={set(
                isOpenAI
                  ? "openai_api_key"
                  : isAnthropic
                    ? "anthropic_api_key"
                    : "openai_compatible_api_key",
              )}
              placeholder={activePresetMeta?.apiKeyPlaceholder ?? "sk-..."}
              sensitive
              hint={
                activePreset === "ollama"
                  ? "本地 Ollama 可留空。"
                  : `留空或输入 ${MASK} 表示不更改`
              }
            />

            <div className="md:col-span-2">
              <ModelCombobox
                label="默认对话模型"
                value={chatModelValue}
                onChange={set(
                  isOpenAI
                    ? "openai_chat_model"
                    : isAnthropic
                      ? "anthropic_chat_model"
                      : "openai_compatible_chat_model",
                )}
                placeholder={activePresetMeta?.defaultChatModel || "模型名称"}
                hint="小妍主对话默认模型；专项任务可在下方分工区单独指定。点右侧按钮查询可用模型。"
                models={availableModels}
                loading={loadingModels}
                error={modelsError}
                onQuery={() => void loadModels()}
              />
            </div>

            <div className="md:col-span-2">
              {!isAnthropic ? (
                <ModelCombobox
                  label="默认向量模型"
                  value={embeddingModelValue}
                  onChange={set(isOpenAI ? "openai_embedding_model" : "openai_compatible_embedding_model")}
                  placeholder={activePresetMeta?.defaultEmbedModel || "text-embedding-3-small"}
                  hint={embeddingHint}
                  models={availableModels}
                  loading={loadingModels}
                  error={modelsError}
                  onQuery={() => void loadModels()}
                />
              ) : (
                <div
                  className="rounded-2xl px-4 py-3 text-xs leading-5 text-ink-tertiary"
                  style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-card-inset-outline)" }}
                >
                  Anthropic 不提供向量模型。如需 embedding 请在下方分工区为溯源模型配置。
                </div>
              )}
            </div>
          </div>

          {activePreset === "ollama" ? (
            <OllamaEmbeddingPanel
              ollamaModels={ollamaModels}
              loadingOllamaModels={loadingOllamaModels}
              loadOllamaModels={loadOllamaModels}
              chatModel={form.openai_compatible_chat_model}
              embeddingModel={form.openai_compatible_embedding_model}
              onPickChat={(model) =>
                setForm((current) => ({ ...current, openai_compatible_chat_model: model }))
              }
              onPickEmbedding={(model) =>
                setForm((current) => ({ ...current, openai_compatible_embedding_model: model }))
              }
            />
          ) : null}

          <div className="space-y-3 border-t border-nm-dark/10 pt-1">
            <p className="text-xs font-medium text-ink-tertiary">外部学术服务</p>
            <div className="space-y-2">
              <label className="ml-1 block text-xs font-medium text-ink-tertiary">默认论文搜索引擎</label>
              <div className="grid gap-2 md:grid-cols-2">
                {SEARCH_ENGINE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set("paper_search_engine")(option.value)}
                    className="rounded-[22px] p-3 text-left transition-all duration-150"
                    style={
                      form.paper_search_engine === option.value
                        ? {
                            background: "color-mix(in srgb, var(--rc-accent) 10%, var(--rc-elevated))",
                            border: "1px solid color-mix(in srgb, var(--rc-accent) 26%, var(--rc-border))",
                            boxShadow: "var(--rc-card-flat-shadow)",
                          }
                        : {
                            background: "var(--rc-card-inset-bg)",
                            border: "1px solid var(--rc-card-inset-outline)",
                            boxShadow: "var(--rc-card-inset-shadow)",
                          }
                    }
                  >
                    <p className="text-sm font-semibold text-ink-primary">{option.label}</p>
                    <p className="mt-1.5 text-xs leading-5 text-ink-tertiary">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>
            {form.paper_search_engine === "semantic_scholar" ? (
              <SettingInput
                label="Semantic Scholar 接口密钥"
                value={form.semantic_scholar_api_key}
                onChange={set("semantic_scholar_api_key")}
                placeholder="留空使用免费限速额度"
                sensitive
                hint={`留空或输入 ${MASK} 表示不更改`}
              />
            ) : null}

            <WebSearchSection form={form} set={set} />
          </div>
        </>
      ) : null}
    </Card>
  );
}

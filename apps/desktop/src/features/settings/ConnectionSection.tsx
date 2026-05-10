import { useState, type Dispatch, type SetStateAction } from "react";
import { Brain, ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { AppSettings, LlmProvider, PaperSearchEngine } from "@research-copilot/types";
import { MASK, SectionIcon, SettingInput } from "./shared";
import { ANTHROPIC_ENDPOINT, PROVIDER_PRESETS, type ProviderPresetId } from "./providerPresets";

interface ConnectionSectionProps {
  contentUnavailable: boolean;
  provider: LlmProvider;
  activePreset: ProviderPresetId;
  form: AppSettings;
  ollamaModels: string[];
  loadingOllamaModels: boolean;
  setForm: Dispatch<SetStateAction<AppSettings>>;
  set: (key: keyof AppSettings) => (value: string) => void;
  applyPreset: (presetId: ProviderPresetId) => void;
  loadOllamaModels: () => Promise<void>;
}

function PresetCard({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[22px] p-3 text-left transition-all duration-150"
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
      <p className="text-sm font-semibold text-ink-primary">{label}</p>
      <p className="mt-1.5 text-xs leading-5 text-ink-tertiary">{description}</p>
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
  setForm,
  set,
  applyPreset,
  loadOllamaModels,
}: ConnectionSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
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
      <div className="flex items-center gap-3">
        <SectionIcon icon={Brain} color="#AF52DE" />
        <div>
          <h2 className="text-base font-semibold text-ink-primary">小妍</h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            点击厂商卡片自动填入接口地址和推荐模型，之后仍可手动修改。
          </p>
        </div>
      </div>

      {!contentUnavailable ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="ml-1 block text-xs font-medium text-ink-tertiary">常见厂商</label>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {PROVIDER_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  active={activePreset === preset.id}
                  label={preset.label}
                  description={preset.description}
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
                hint={activePreset === "custom" ? "填写兼容 OpenAI 接口格式的地址。" : undefined}
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
              <SettingInput
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
                hint="小妍主对话默认模型；专项任务可在下方分工区单独指定。"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="flex items-center gap-1.5 text-xs text-ink-tertiary transition-colors hover:text-ink-secondary"
          >
            {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {showAdvanced ? "收起高级设置" : "展开高级设置"}
          </button>

          {showAdvanced ? (
            <div className="space-y-3 rounded-[24px] border border-nm-dark/10 p-4">
              {!isAnthropic ? (
                <SettingInput
                  label="默认向量模型"
                  value={embeddingModelValue}
                  onChange={set(isOpenAI ? "openai_embedding_model" : "openai_compatible_embedding_model")}
                  placeholder={activePresetMeta?.defaultEmbedModel || "text-embedding-3-small"}
                  hint={embeddingHint}
                />
              ) : (
                <div
                  className="rounded-2xl px-4 py-3 text-xs leading-5 text-ink-tertiary"
                  style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-card-inset-outline)" }}
                >
                  Anthropic 不提供向量模型。如需 embedding 请在下方分工区为溯源模型配置。
                </div>
              )}

              {activePreset === "ollama" ? (
                <div className="space-y-3 rounded-2xl border border-green-200 bg-green-50/80 px-4 py-3">
                  <p className="text-xs leading-5 text-green-800">
                    默认地址 <code className="font-mono">http://localhost:11434/v1</code>。点击下方按钮获取本地模型列表。
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={loadingOllamaModels}
                      onClick={() => void loadOllamaModels()}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 disabled:opacity-60"
                      style={{ background: "rgba(52,199,89,0.15)", color: "#1A7A2E" }}
                    >
                      {loadingOllamaModels ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      获取本地模型
                    </button>
                    {ollamaModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, openai_compatible_chat_model: model }))}
                        className="rounded-lg px-2.5 py-1 text-xs font-mono transition-colors hover:bg-green-100"
                        style={{ color: "#1A7A2E" }}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
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
            <SettingInput
              label="Semantic Scholar 接口密钥"
              value={form.semantic_scholar_api_key}
              onChange={set("semantic_scholar_api_key")}
              placeholder="留空使用免费限速额度"
              sensitive
              hint={`留空或输入 ${MASK} 表示不更改`}
            />
          </div>
        </>
      ) : null}
    </Card>
  );
}

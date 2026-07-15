import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "@research-copilot/types";
import { formatErrorMessage, settingsApi } from "../../lib/client";
import type { CodeModelOption } from "./shared";

interface UseCodeModelOptionsOptions {
  onToast: (message: string) => void;
}

export function useCodeModelOptions({ onToast }: UseCodeModelOptionsOptions) {
  const [currentModel, setCurrentModel] = useState<string>("");
  const [modelOptions, setModelOptions] = useState<CodeModelOption[]>([]);
  const [activeModelOptionId, setActiveModelOptionId] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");

  const loadModelOptions = useCallback(async (provider: AppSettings["llm_provider"], settings: AppSettings) => {
    setModelsLoading(true);
    setModelsError("");
    try {
      const remoteModels = await settingsApi.listModels(settings);
      const options: CodeModelOption[] = remoteModels.map((model) => ({
        id: `${provider}:${model}`,
        provider,
        providerLabel: providerLabelForProvider(provider),
        model,
        label: model,
      }));
      setModelOptions(options);

      const current = resolveReproductionModel(settings);
      const matchId = options.find((option) => option.model === current)?.id ?? options[0]?.id ?? "";
      setCurrentModel(current || (options[0]?.model ?? ""));
      setActiveModelOptionId(matchId);
    } catch (err) {
      setModelsError(formatErrorMessage(err));
      const options = buildCodeModelOptions(settings);
      const current = resolveReproductionModel(settings);
      setModelOptions(options);
      setCurrentModel(current || (options[0]?.model ?? ""));
      setActiveModelOptionId(options.find((option) => option.model === current)?.id ?? options[0]?.id ?? "");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    settingsApi
      .get()
      .then((settings) => {
        loadModelOptions(settings.llm_provider, settings);
      })
      .catch(() => setCurrentModel(""));
  }, [loadModelOptions]);

  async function changeModelOption(optionId: string) {
    const option = modelOptions.find((item) => item.id === optionId);
    if (!option) return;

    setCurrentModel(option.model);
    setActiveModelOptionId(option.id);

    try {
      await settingsApi.update({
        paper_reproduction_model: option.model,
        multi_agent_reproduction_model: option.model,
      });
    } catch (err) {
      onToast(formatErrorMessage(err));
    }
  }

  return {
    currentModel,
    modelOptions,
    activeModelOptionId,
    changeModelOption,
    modelsLoading,
    modelsError,
  };
}

function resolveReproductionModel(settings: AppSettings): string {
  return settings.multi_agent_reproduction_model || settings.paper_reproduction_model || "";
}

function providerLabelForProvider(provider: AppSettings["llm_provider"]): string {
  switch (provider) {
    case "openai": return "OpenAI";
    case "anthropic": return "Anthropic";
    case "openai_compatible": return "OpenAI-Compatible";
    default: return provider;
  }
}

function buildCodeModelOptions(settings: AppSettings): CodeModelOption[] {
  const candidates: { provider: AppSettings["llm_provider"]; providerLabel: string; model: string }[] = [
    { provider: "openai", providerLabel: "OpenAI", model: settings.openai_chat_model },
    { provider: "anthropic", providerLabel: "Anthropic", model: settings.anthropic_chat_model },
    { provider: "openai_compatible", providerLabel: "OpenAI-Compatible", model: settings.openai_compatible_chat_model },
  ];

  return candidates
    .filter((candidate) => candidate.model)
    .map((item) => ({
      id: `${item.provider}:${item.model}`,
      provider: item.provider,
      providerLabel: item.providerLabel,
      model: item.model,
      label: item.model,
    }));
}

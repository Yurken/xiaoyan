import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "@research-copilot/types";
import { formatErrorMessage, settingsApi } from "../../lib/client";
import { buildCodeModelOptions, resolveCodeModel, type CodeModelOption } from "./shared";

interface UseCodeModelOptionsOptions {
  onToast: (message: string) => void;
}

export function useCodeModelOptions({ onToast }: UseCodeModelOptionsOptions) {
  const [currentModel, setCurrentModel] = useState<string>("");
  const [modelOptions, setModelOptions] = useState<CodeModelOption[]>([]);
  const [activeModelOptionId, setActiveModelOptionId] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");

  const loadModelOptions = useCallback(async (settings: AppSettings) => {
    setModelsLoading(true);
    setModelsError("");
    try {
      const remoteModels = await settingsApi.listModels(settings);
      const options = buildCodeModelOptions(settings, remoteModels);
      setModelOptions(options);

      const current = resolveCodeModel(settings);
      const matchId = options.find((option) => option.model === current)?.id ?? options[0]?.id ?? "";
      setCurrentModel(current || (options[0]?.model ?? ""));
      setActiveModelOptionId(matchId);
    } catch (err) {
      setModelsError(formatErrorMessage(err));
      const options = buildCodeModelOptions(settings);
      const current = resolveCodeModel(settings);
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
        loadModelOptions(settings);
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

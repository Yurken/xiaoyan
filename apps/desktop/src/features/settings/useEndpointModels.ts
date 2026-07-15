import { useCallback, useState } from "react";
import { settingsApi } from "../../lib/client";
import type { AppSettings } from "@research-copilot/types";

export interface EndpointModelConfig {
  /** 端点根地址，如 https://api.example.com/v1 */
  baseUrl: string;
  /** API Key；为空时会尝试用主服务商 key */
  apiKey: string;
}

interface UseEndpointModelsResult {
  models: string[];
  loading: boolean;
  error: string;
  load: () => Promise<void>;
}

/**
 * 为某个独立端点（角色模型、embedding、视觉等）维护一份可用模型列表。
 * 查询时使用该端点自己的 base_url/api_key，而不是主服务商配置。
 */
export function useEndpointModels(
  getConfig: () => EndpointModelConfig | null,
): UseEndpointModelsResult {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const config = getConfig();
    if (!config || !config.baseUrl.trim()) {
      setError("请先填写接口地址。");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload: Partial<AppSettings> & {
        list_models_base_url?: string;
        list_models_api_key?: string;
      } = {
        list_models_base_url: config.baseUrl.trim(),
      };
      const apiKey = config.apiKey.trim();
      if (apiKey && apiKey !== "***") {
        payload.list_models_api_key = apiKey;
      }
      const result = await settingsApi.listModels(payload);
      setModels(result);
      if (result.length === 0) {
        setError("未获取到模型，请检查接口地址与密钥。");
      }
    } catch (err) {
      setModels([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getConfig]);

  return { models, loading, error, load };
}

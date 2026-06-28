import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { openLink } from "../../lib/links";
import {
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_HOMEPAGE,
  RECOMMENDED_EMBEDDING_MODELS,
} from "./embeddingModels";

interface OllamaEmbeddingPanelProps {
  ollamaModels: string[];
  loadingOllamaModels: boolean;
  loadOllamaModels: () => Promise<void>;
  chatModel: string;
  embeddingModel: string;
  onPickChat: (model: string) => void;
  onPickEmbedding: (model: string) => void;
}

/**
 * 本地向量模型（Ollama）面板：提供官网入口、推荐模型与下载页地址，
 * 并把本地已下载的模型一键填入对话 / 向量模型。不代用户安装或拉取。
 */
export default function OllamaEmbeddingPanel({
  ollamaModels,
  loadingOllamaModels,
  loadOllamaModels,
  chatModel,
  embeddingModel,
  onPickChat,
  onPickEmbedding,
}: OllamaEmbeddingPanelProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-green-200 bg-green-50/80 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-green-800">
          默认地址 <code className="font-mono">{OLLAMA_DEFAULT_BASE_URL}</code>，本地运行无需密钥。
        </p>
        <button
          type="button"
          onClick={() => void openLink(OLLAMA_HOMEPAGE)}
          className="flex items-center gap-1 text-xs font-medium text-green-700 transition-colors hover:text-green-900"
        >
          未安装？前往 Ollama 官网
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* 推荐向量模型 + 下载页地址（不代拉取，点开官方库自行 ollama pull） */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-green-800">推荐向量模型</p>
        {RECOMMENDED_EMBEDDING_MODELS.map((rec) => (
          <div
            key={rec.name}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-xs font-mono font-semibold text-green-900">
                {rec.name}
                <span className="ml-2 font-sans font-normal text-green-700">{rec.dim} 维</span>
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-green-700">{rec.advice}</p>
            </div>
            <button
              type="button"
              onClick={() => void openLink(rec.libraryUrl)}
              className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors hover:bg-green-100"
              style={{ color: "#1A7A2E" }}
            >
              下载页
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        ))}
        <p className="text-[11px] leading-4 text-green-700/90">
          换用不同维度的向量模型后，历史向量需重新生成才能参与检索。
        </p>
      </div>

      {/* 本地已下载模型：一键填入 */}
      <div className="space-y-2">
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
          <span className="text-[11px] text-green-700">列出已 pull 的模型，点击填入对话或向量模型。</span>
        </div>

        {ollamaModels.length > 0 ? (
          <div className="space-y-1.5">
            {ollamaModels.map((model) => (
              <div
                key={model}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-1.5"
              >
                <span className="min-w-0 truncate text-xs font-mono text-green-900">{model}</span>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <PickButton active={chatModel === model} label="对话" onClick={() => onPickChat(model)} />
                  <PickButton active={embeddingModel === model} label="向量" onClick={() => onPickEmbedding(model)} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PickButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-2 py-1 text-[11px] font-medium transition-colors"
      style={
        active
          ? { background: "#1A7A2E", color: "#fff" }
          : { background: "rgba(52,199,89,0.15)", color: "#1A7A2E" }
      }
    >
      {label}
    </button>
  );
}

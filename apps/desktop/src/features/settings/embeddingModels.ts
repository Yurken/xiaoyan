/** Ollama 本地向量模型：官网与推荐清单（供设置页「本地向量模型」面板使用）。 */

export const OLLAMA_HOMEPAGE = "https://ollama.com";
export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434/v1";

export interface EmbeddingModelRec {
  /** Ollama 模型名，可直接 `ollama pull <name>`。 */
  name: string;
  /** 向量维度。换模型会因维度不同导致历史向量作废，需重算。 */
  dim: number;
  /** 选型建议（按内存与语种）。 */
  advice: string;
  /** Ollama 官方库页面，点开可见 `ollama pull` 命令与体积。 */
  libraryUrl: string;
}

/** 仅收录 Ollama 官方库可直接 pull 的 embedding 模型。 */
export const RECOMMENDED_EMBEDDING_MODELS: EmbeddingModelRec[] = [
  {
    name: "nomic-embed-text",
    dim: 768,
    advice: "约 270MB，8GB 内存即可，追求速度、英文为主",
    libraryUrl: "https://ollama.com/library/nomic-embed-text",
  },
  {
    name: "bge-m3",
    dim: 1024,
    advice: "约 1.2GB，建议 16GB+，中文/多语效果最佳",
    libraryUrl: "https://ollama.com/library/bge-m3",
  },
  {
    name: "mxbai-embed-large",
    dim: 1024,
    advice: "约 670MB，英文检索质量高",
    libraryUrl: "https://ollama.com/library/mxbai-embed-large",
  },
];

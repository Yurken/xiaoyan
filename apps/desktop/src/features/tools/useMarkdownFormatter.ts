import { useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

interface MarkdownProgress {
  current: number;
  total: number;
}

// 分块上限。受限于模型输出 token 上限（排版输出≈输入等长），
// 单块过大可能被截断丢失内容，因此保留分块，仅放宽阈值。
export const CHUNK_SIZE = 6000;

// 按空行切块，但把围栏代码块（``` ... ```）视为不可分割整体，避免把半个代码块送给模型。
function splitIntoBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  const flush = () => {
    if (current.length) {
      blocks.push(current.join("\n"));
      current = [];
    }
  };
  for (const line of text.split("\n")) {
    const isFence = /^\s*```/.test(line);
    if (isFence) {
      inFence = !inFence;
      current.push(line);
      continue;
    }
    if (!inFence && line.trim() === "") {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks;
}

/**
 * 把 Markdown 源文本切成不超过 maxSize 的块：保持代码块完整、按空行对齐边界，
 * 单个超大块（极少见的超长段/代码）兜底硬切，避免被模型截断丢内容。
 */
export function chunkMarkdownSource(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const block of splitIntoBlocks(text)) {
    if (block.length > maxSize) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < block.length; i += maxSize) {
        chunks.push(block.slice(i, i + maxSize));
      }
      continue;
    }
    if (current && current.length + block.length + 2 > maxSize) {
      chunks.push(current);
      current = block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function useMarkdownFormatter() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<MarkdownProgress | null>(null);

  const submit = async () => {
    const text = input.trim();
    if (!text || processing) return;

    const chunks = chunkMarkdownSource(text, CHUNK_SIZE);

    setProcessing(true);
    setError("");
    setResult("");
    setProgress({ current: 0, total: chunks.length });

    let styleSummary = "";
    const parts: string[] = [];

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        setProgress({ current: index + 1, total: chunks.length });
        const { formatted, styleSummary: nextSummary } = await apiClient.markdown.formatChunk(
          chunks[index],
          styleSummary,
        );
        parts.push(formatted);
        styleSummary = nextSummary;
      }
      setResult(parts.join("\n\n"));
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  };

  const upload = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      filters: [{ name: "文本文件", extensions: ["md", "txt"] }],
      multiple: false,
    });
    if (typeof path === "string") {
      const content = await readTextFile(path);
      setInput(content);
    }
  };

  const save = async () => {
    if (!result) return;
    const { save: saveDialog } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await saveDialog({
      filters: [{ name: "Markdown", extensions: ["md"] }],
      defaultPath: "formatted.md",
    });
    if (path) {
      await writeTextFile(path, result);
    }
  };

  return {
    input,
    result,
    processing,
    error,
    progress,
    setInput,
    submit,
    upload,
    save,
  };
}

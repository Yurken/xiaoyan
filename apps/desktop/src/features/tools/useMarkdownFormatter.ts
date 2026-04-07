import { useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

interface MarkdownProgress {
  current: number;
  total: number;
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

    const paragraphs = text.split(/\n{2,}/);
    const chunks: string[] = [];
    let currentChunk = "";
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > 1500 && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());

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

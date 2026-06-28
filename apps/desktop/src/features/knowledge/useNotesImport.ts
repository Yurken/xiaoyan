import { useCallback, useState } from "react";
import type { KnowledgeNote } from "@research-copilot/types";
import { parseNoteFromFile } from "./notesShared";

export interface ImportableNote {
  fileName: string;
  title: string;
  content: string;
}

interface UseNotesImportOptions {
  onCreate: (draft: { title: string; content: string; research_interest_id?: string }) => Promise<KnowledgeNote>;
}

export function useNotesImport({ onCreate }: UseNotesImportOptions) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importError, setImportError] = useState("");
  const [lastResult, setLastResult] = useState<{ created: number; failed: string[] } | null>(null);

  const clearError = useCallback(() => setImportError(""), []);
  const resetResult = useCallback(() => setLastResult(null), []);

  const pickFiles = useCallback(async (): Promise<string[]> => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: true,
      filters: [{ name: "Markdown / 文本", extensions: ["md", "txt", "markdown"] }],
    });
    if (!selected) return [];
    return (Array.isArray(selected) ? selected : [selected])
      .map((item) => (typeof item === "string" ? item : String((item as { path: unknown }).path)))
      .filter(Boolean);
  }, []);

  const importFiles = useCallback(async (
    filePaths: string[],
    researchInterestId?: string,
  ): Promise<{ created: number; failed: string[] }> => {
    if (filePaths.length === 0) return { created: 0, failed: [] };
    setImporting(true);
    setImportError("");
    setProgress({ done: 0, total: filePaths.length });
    const failed: string[] = [];
    let created = 0;

    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      for (let i = 0; i < filePaths.length; i++) {
        const path = filePaths[i];
        try {
          const raw = await readTextFile(path);
          const { title, content } = parseNoteFromFile(path, raw);
          if (!content && !title) {
            failed.push(`${path}：文件为空`);
            continue;
          }
          await onCreate({ title, content, research_interest_id: researchInterestId });
          created++;
        } catch (err) {
          failed.push(`${path}：${err instanceof Error ? err.message : String(err)}`);
        }
        setProgress({ done: i + 1, total: filePaths.length });
      }
      const result = { created, failed };
      setLastResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setImportError(message);
      return { created, failed: [...failed, message] };
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }, [onCreate]);

  return {
    importing,
    progress,
    importError,
    lastResult,
    pickFiles,
    importFiles,
    clearError,
    resetResult,
  };
}

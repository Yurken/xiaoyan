import { useCallback, useState } from "react";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { formatErrorMessage } from "../../lib/client";
import { buildNotesMarkdown, sanitizeNoteFileName } from "./notesShared";

/**
 * 知识卡片导出：把选中的笔记合并为单个 Markdown 文件，经系统保存对话框写入磁盘。
 */
export function useNotesExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const clearError = useCallback(() => setError(""), []);

  const exportMarkdown = useCallback(async (
    notes: KnowledgeNote[],
    interestMap: Record<string, ResearchInterest> = {},
  ): Promise<boolean> => {
    if (notes.length === 0) return false;
    setExporting(true);
    setError("");
    try {
      const content = buildNotesMarkdown(notes, interestMap);
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");

      const stamp = new Date().toISOString().slice(0, 10);
      const defaultPath = notes.length === 1
        ? `${sanitizeNoteFileName(notes[0].title)}.md`
        : `知识卡片导出-${stamp}.md`;

      const path = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath,
      });
      if (!path) return false;

      await writeTextFile(path, content);
      return true;
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      return false;
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, exportError: error, clearExportError: clearError, exportMarkdown };
}

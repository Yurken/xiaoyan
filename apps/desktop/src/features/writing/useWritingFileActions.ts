import { useCallback, useState } from "react";
import { formatErrorMessage } from "../../lib/client";
import {
  EXPORT_TARGET_LABELS,
  type WritingExportTarget,
} from "./shared";
import { buildLatexProjectFiles, sanitizeLatexProjectName } from "./latexProject";
import { buildZipArchive } from "./zip";

interface UseWritingFileActionsOptions {
  projectName: string;
  mainTex: string;
  bibtex: string;
  notes: string;
  setMainTex: (value: string) => void;
  setBibtex: (value: string) => void;
  setActiveSource: (value: "main" | "bib") => void;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
  clearStatus: () => void;
}

export function useWritingFileActions({
  projectName,
  mainTex,
  bibtex,
  notes,
  setMainTex,
  setBibtex,
  setActiveSource,
  onMessage,
  onError,
  clearStatus,
}: UseWritingFileActionsOptions) {
  const [exportingTarget, setExportingTarget] = useState<WritingExportTarget | null>(null);

  const importTexFile = useCallback(async () => {
    try {
      clearStatus();
      const text = await readLocalTextFile(["tex", "txt"]);
      if (text === null) return;
      setMainTex(text);
      setActiveSource("main");
      onMessage("已导入 main.tex 内容");
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [clearStatus, onError, onMessage, setActiveSource, setMainTex]);

  const importBibFile = useCallback(async () => {
    try {
      clearStatus();
      const text = await readLocalTextFile(["bib", "txt"]);
      if (text === null) return;
      setBibtex(text);
      setActiveSource("bib");
      onMessage("已导入 references.bib 内容");
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [clearStatus, onError, onMessage, setActiveSource, setBibtex]);

  const copyMainTex = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mainTex);
      onMessage("已复制 main.tex 源码");
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [mainTex, onError, onMessage]);

  const exportProject = useCallback(async (target: WritingExportTarget) => {
    setExportingTarget(target);
    clearStatus();
    try {
      const files = buildLatexProjectFiles({ projectName, mainTex, bibtex, notes }, target);
      const zip = buildZipArchive(files);
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        filters: [{ name: "LaTeX Zip", extensions: ["zip"] }],
        defaultPath: `${sanitizeLatexProjectName(projectName)}-${target}.zip`,
      });
      if (!path) return;
      await writeFile(path, zip);
      onMessage(`已导出 ${EXPORT_TARGET_LABELS[target]} 项目包：${path.split("/").pop() ?? path}`);
    } catch (err) {
      onError(formatErrorMessage(err));
    } finally {
      setExportingTarget(null);
    }
  }, [bibtex, clearStatus, mainTex, notes, onError, onMessage, projectName]);

  return {
    exportingTarget,
    importTexFile,
    importBibFile,
    copyMainTex,
    exportProject,
  };
}

async function readLocalTextFile(extensions: string[]): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const path = await open({
    filters: [{ name: "文本文件", extensions }],
    multiple: false,
  });
  if (typeof path !== "string") return null;
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  return readTextFile(path);
}

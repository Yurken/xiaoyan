import { useCallback, useState } from "react";
import { formatErrorMessage, writingApi } from "../../lib/client";
import { sanitizeLatexProjectName } from "./latexProject";
import type { WritingCompileStatus, WritingCompileSummary } from "./shared";

interface UseWritingCompilerOptions {
  projectName: string;
  mainTex: string;
  bibtex: string;
  notes: string;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
  clearStatus: () => void;
}

export function useWritingCompiler({
  projectName,
  mainTex,
  bibtex,
  notes,
  onMessage,
  onError,
  clearStatus,
}: UseWritingCompilerOptions) {
  const [compileStatus, setCompileStatus] = useState<WritingCompileStatus>("idle");
  const [compileResult, setCompileResult] = useState<WritingCompileSummary | null>(null);

  const compilePdf = useCallback(async () => {
    setCompileStatus("compiling");
    setCompileResult(null);
    clearStatus();
    try {
      const result = await writingApi.compilePdf({ projectName, mainTex, bibtex, notes });
      setCompileResult(result);
      if (result.success && result.pdfPath) {
        setCompileStatus("ready");
        onMessage(`PDF 编译完成：${result.pdfPath.split("/").pop() ?? "main.pdf"}`);
      } else {
        setCompileStatus("failed");
        onError("PDF 编译失败，请展开编译日志查看具体错误。");
      }
    } catch (err) {
      setCompileStatus("failed");
      onError(formatErrorMessage(err));
    }
  }, [bibtex, clearStatus, mainTex, notes, onError, onMessage, projectName]);

  const openCompiledPdf = useCallback(async () => {
    if (!compileResult?.pdfPath) return;
    try {
      const { open: openPath } = await import("@tauri-apps/plugin-shell");
      await openPath(compileResult.pdfPath);
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [compileResult, onError]);

  const saveCompiledPdf = useCallback(async () => {
    if (!compileResult?.pdfPath) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        defaultPath: `${sanitizeLatexProjectName(projectName)}.pdf`,
      });
      if (!path) return;
      await writingApi.copyPdf(compileResult.pdfPath, path);
      onMessage(`已保存 PDF：${path.split("/").pop() ?? path}`);
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [compileResult, onError, onMessage, projectName]);

  return {
    compileStatus,
    compileResult,
    compilePdf,
    openCompiledPdf,
    saveCompiledPdf,
  };
}

import { useCallback, useEffect, useState } from "react";
import { formatErrorMessage, writingApi } from "../../lib/client";
import { sanitizeLatexProjectName } from "./latexProject";
import {
  isLatexCompilerMissing,
  type WritingCompileStatus,
  type WritingCompileSummary,
} from "./shared";

const WRITING_COMPILE_RESULT_KEY = "rc:writing:compile:v1";

function compileResultStorageKey(draftId: string) {
  return `${WRITING_COMPILE_RESULT_KEY}:${draftId}`;
}

function loadCompileResult(storageKey: string): WritingCompileSummary | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as WritingCompileSummary;
  } catch {
    return null;
  }
}

interface UseWritingCompilerOptions {
  draftId: string;
  projectName: string;
  mainTex: string;
  bibtex: string;
  notes: string;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
  clearStatus: () => void;
}

export function useWritingCompiler({
  draftId,
  projectName,
  mainTex,
  bibtex,
  notes,
  onMessage,
  onError,
  clearStatus,
}: UseWritingCompilerOptions) {
  const storageKey = compileResultStorageKey(draftId);
  const [compileStatus, setCompileStatus] = useState<WritingCompileStatus>("idle");
  const [compileResult, setCompileResult] = useState<WritingCompileSummary | null>(() => loadCompileResult(storageKey));
  const [latexInstallerStatus, setLatexInstallerStatus] = useState<"idle" | "opening">("idle");

  useEffect(() => {
    setCompileStatus("idle");
    setCompileResult(loadCompileResult(storageKey));
  }, [storageKey]);

  const compilePdf = useCallback(async () => {
    setCompileStatus("compiling");
    setCompileResult(null);
    localStorage.removeItem(storageKey);
    clearStatus();
    try {
      const result = await writingApi.compilePdf({ projectName, mainTex, bibtex, notes });
      setCompileResult(result);
      localStorage.setItem(storageKey, JSON.stringify(result));
      if (result.success && result.pdfPath) {
        setCompileStatus("ready");
      } else if (isLatexCompilerMissing(result)) {
        setCompileStatus("failed");
        onError("未找到 LaTeX 编译器。请安装 MacTeX / TeX Live，或使用下方按钮下载 MacTeX 安装器。");
      } else {
        setCompileStatus("failed");
        onError("PDF 编译失败，请展开编译日志查看具体错误。");
      }
    } catch (err) {
      setCompileStatus("failed");
      onError(formatErrorMessage(err));
    }
  }, [bibtex, clearStatus, mainTex, notes, onError, projectName, storageKey]);

  const openLatexInstaller = useCallback(async () => {
    setLatexInstallerStatus("opening");
    clearStatus();
    try {
      await writingApi.openMactexInstaller();
      onMessage("已打开 MacTeX 官方安装器下载。下载完成后运行 MacTeX.pkg，安装完成再重新编译。");
    } catch (err) {
      onError(formatErrorMessage(err));
    } finally {
      setLatexInstallerStatus("idle");
    }
  }, [clearStatus, onError, onMessage]);

  const openLatexDownloadPage = useCallback(async () => {
    try {
      await writingApi.openMactexDownloadPage();
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [onError]);

  const openCompiledPdf = useCallback(async () => {
    if (!compileResult?.pdfPath) return;
    try {
      await writingApi.openCompiledPdf(compileResult.pdfPath);
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
    latexInstallerStatus,
    compilePdf,
    openLatexInstaller,
    openLatexDownloadPage,
    openCompiledPdf,
    saveCompiledPdf,
  };
}

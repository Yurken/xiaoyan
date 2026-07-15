import { useCallback, useEffect, useState } from "react";
import { formatErrorMessage, writingApi } from "../../lib/client";
import { sanitizeLatexProjectName } from "./latexProject";
import {
  isLatexCompilerMissing,
  LATEX_INSTALL_SUPPORT,
  type WritingCompileStatus,
  type WritingCompileSummary,
  type WritingImageAsset,
  type WritingTexFile,
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
  texFiles: WritingTexFile[];
  notes: string;
  imageAssets: WritingImageAsset[];
  onMessage: (message: string) => void;
  onError: (error: string) => void;
  clearStatus: () => void;
}

export function useWritingCompiler({
  draftId,
  projectName,
  mainTex,
  bibtex,
  texFiles,
  notes,
  imageAssets,
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
      const result = await writingApi.compilePdf({ projectName, mainTex, bibtex, texFiles, notes, imageAssets });
      setCompileResult(result);
      localStorage.setItem(storageKey, JSON.stringify(result));
      if (result.success && result.pdfPath) {
        setCompileStatus("ready");
      } else if (isLatexCompilerMissing(result)) {
        setCompileStatus("failed");
        onError(LATEX_INSTALL_SUPPORT.missingCompilerMessage);
      } else {
        setCompileStatus("failed");
        onError("PDF 编译失败，请展开编译日志查看具体错误。");
      }
    } catch (err) {
      setCompileStatus("failed");
      onError(formatErrorMessage(err));
    }
  }, [bibtex, clearStatus, imageAssets, mainTex, notes, onError, projectName, storageKey, texFiles]);

  const openLatexInstaller = useCallback(async () => {
    setLatexInstallerStatus("opening");
    clearStatus();
    try {
      await writingApi.openMactexInstaller();
      onMessage(
        LATEX_INSTALL_SUPPORT.installerOpenedMessage ??
          "已打开 LaTeX 安装器，请完成安装后重新编译。",
      );
    } catch (err) {
      onError(formatErrorMessage(err));
    } finally {
      setLatexInstallerStatus("idle");
    }
  }, [clearStatus, onError, onMessage]);

  const openLatexDownloadPage = useCallback(async () => {
    try {
      await writingApi.openMactexDownloadPage();
      onMessage(LATEX_INSTALL_SUPPORT.installGuideOpenedMessage);
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [onError, onMessage]);

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

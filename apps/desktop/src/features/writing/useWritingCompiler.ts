import { useCallback, useLayoutEffect, useRef, useState } from "react";
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

interface CompileSession {
  scope: { storageKey: string };
  status: WritingCompileStatus;
  result: WritingCompileSummary | null;
}

interface CompileLifetime {
  scope: CompileSession["scope"];
  compiling: boolean;
}

function createCompileSession(storageKey: string): CompileSession {
  return { scope: { storageKey }, status: "idle", result: loadCompileResult(storageKey) };
}

function cacheCompileResult(storageKey: string, result: WritingCompileSummary | null) {
  try {
    if (result) localStorage.setItem(storageKey, JSON.stringify(result));
    else localStorage.removeItem(storageKey);
  } catch {
    // This cache is optional; storage quota/access failures are not compile failures.
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
  const [session, setSession] = useState(() => createCompileSession(storageKey));
  let currentSession = session;
  if (session.scope.storageKey !== storageKey) {
    // Reset only compile state during render: the new draft must never receive
    // the previous draft's PDF, even before effects run. A -> B -> A gets a new scope.
    currentSession = createCompileSession(storageKey);
    setSession(currentSession);
  }
  const { scope, status: compileStatus, result: compileResult } = currentSession;
  const activeLifetime = useRef<CompileLifetime | null>(null);
  const [latexInstallerStatus, setLatexInstallerStatus] = useState<"idle" | "opening">("idle");

  useLayoutEffect(() => {
    // Publish the committed scope, not a ref mutated by an uncommitted render.
    // A fresh lifetime also invalidates work across cleanup/setup in StrictMode.
    const lifetime: CompileLifetime = { scope, compiling: false };
    activeLifetime.current = lifetime;
    return () => {
      if (activeLifetime.current === lifetime) activeLifetime.current = null;
    };
  }, [scope]);

  const compilePdf = useCallback(async () => {
    const lifetime = activeLifetime.current;
    if (!lifetime || lifetime.scope !== scope || lifetime.compiling) return;
    // Reserve synchronously so two clicks before the next render start one job.
    lifetime.compiling = true;
    const isCurrent = () => activeLifetime.current === lifetime;
    const update = (status: WritingCompileStatus, result: WritingCompileSummary | null) => {
      setSession((current) => current.scope === scope ? { ...current, status, result } : current);
    };
    update("compiling", null);
    cacheCompileResult(scope.storageKey, null);
    try {
      clearStatus();
      const result = await writingApi.compilePdf({ projectName, mainTex, bibtex, texFiles, notes, imageAssets });
      // Native compilation may finish after switching drafts or unmounting.
      // Ignore its feedback and cache write; this does not cancel the native job.
      if (!isCurrent()) return;
      cacheCompileResult(scope.storageKey, result);
      if (result.success && result.pdfPath) {
        update("ready", result);
      } else if (isLatexCompilerMissing(result)) {
        update("failed", result);
        onError(LATEX_INSTALL_SUPPORT.missingCompilerMessage);
      } else {
        update("failed", result);
        onError("PDF 编译失败，请展开编译日志查看具体错误。");
      }
    } catch (err) {
      if (!isCurrent()) return;
      update("failed", null);
      onError(formatErrorMessage(err));
    } finally {
      lifetime.compiling = false;
    }
  }, [bibtex, clearStatus, imageAssets, mainTex, notes, onError, projectName, scope, texFiles]);

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

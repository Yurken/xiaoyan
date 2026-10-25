import { useCallback, useEffect, useRef, useState } from "react";
import { formatErrorMessage, writingApi } from "../../lib/client";
import { sanitizeLatexProjectName } from "./latexProject";
import {
  compileResultStorageKey,
  loadAutoCompileEnabled,
  loadCompileRecord,
  saveCompileRecord,
} from "./writingCompilerStorage";
import {
  isLatexCompilerMissing,
  LATEX_INSTALL_SUPPORT,
  WRITING_AUTO_COMPILE_ENABLED_KEY,
  WRITING_COMPILE_AUTO_DEBOUNCE_MS,
  writingCompileSourceSignature,
  type WritingCompileStatus,
  type WritingCompileSummary,
  type WritingCompileTrigger,
  type WritingImageAsset,
  type WritingTexFile,
} from "./shared";

interface CompileSourceSnapshot {
  draftId: string;
  projectName: string;
  mainTex: string;
  bibtex: string;
  texFiles: WritingTexFile[];
  notes: string;
  imageAssets: WritingImageAsset[];
}

interface UseWritingCompilerOptions extends CompileSourceSnapshot {
  onMessage: (message: string) => void;
  onError: (error: string) => void;
  clearStatus: () => void;
}

interface CompileJob {
  draftId: string;
  generation: number;
  trigger: WritingCompileTrigger;
  signature: string;
  /** 与 writingApi.compilePdf 的参数一致。 */
  payload: CompileSourceSnapshot;
}

/** 最后成功编译的标记：previewResult 与 previewStale 的数据源。 */
interface LastSuccessMarker {
  draftId: string;
  signature: string;
  result: WritingCompileSummary;
}

function buildCompileJob(
  snapshot: CompileSourceSnapshot,
  trigger: WritingCompileTrigger,
  generation: number,
): CompileJob {
  const { draftId } = snapshot;
  return {
    draftId,
    generation,
    trigger,
    signature: writingCompileSourceSignature(snapshot),
    payload: { ...snapshot },
  };
}

/**
 * LaTeX 实时预览编译调度：
 * - 自动编译默认开启（全局偏好持久化），源内容停止变化 1200ms 后发起；
 * - manual/auto 统一进串行 latest-only 队列：飞行中只保留最新一次尾随任务，
 *   飞行中的内容变化不会堆积每次击键；
 * - compileResult 表示最近一次尝试（失败日志可回看），previewResult 只记最后成功
 *   的 PDF，失败/编译中不清空；previewStale 表示当前签名与最后成功签名不同；
 * - 自动编译的错误只进 compileResult，不调用全局 onError；检测到缺少编译器时
 *   暂停自动重试，手动重试成功后恢复。
 */
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
  const [compileResult, setCompileResult] = useState<WritingCompileSummary | null>(
    () => loadCompileRecord(storageKey)?.summary ?? null,
  );
  const [lastSuccess, setLastSuccess] = useState<LastSuccessMarker | null>(null);
  const [latexInstallerStatus, setLatexInstallerStatus] = useState<"idle" | "opening">("idle");
  const [autoCompileEnabled, setAutoCompileEnabledState] = useState(loadAutoCompileEnabled);
  const [autoCompilePending, setAutoCompilePending] = useState(false);
  const [compilerMissing, setCompilerMissing] = useState(false);

  const contentRef = useRef<CompileSourceSnapshot>({
    draftId, projectName, mainTex, bibtex, texFiles, notes, imageAssets,
  });
  contentRef.current = { draftId, projectName, mainTex, bibtex, texFiles, notes, imageAssets };

  const mountedRef = useRef(true);
  /** 每切一次草稿 +1，旧草稿在飞的编译任务凭此被整体丢弃。 */
  const generationRef = useRef(0);
  const queueRef = useRef<{ running: boolean; trailing: CompileJob | null }>({
    running: false,
    trailing: null,
  });
  const lastAttemptRef = useRef<{ draftId: string; signature: string } | null>(null);

  const signature = writingCompileSourceSignature({ mainTex, bibtex, texFiles, imageAssets });
  const previewResult = lastSuccess?.result ?? null;
  const previewStale =
    lastSuccess !== null && (lastSuccess.draftId !== draftId || lastSuccess.signature !== signature);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    queueRef.current.trailing = null;
    setAutoCompilePending(false);
    setCompileStatus("idle");
    const record = loadCompileRecord(storageKey);
    setCompileResult(record?.summary ?? null);
    lastAttemptRef.current = { draftId, signature: record?.signature ?? "" };
    if (record && record.summary.success && record.summary.pdfPath) {
      setLastSuccess({ draftId, signature: record.signature, result: record.summary });
    } else {
      setLastSuccess(null);
    }
  }, [draftId, storageKey]);

  const runQueue = useCallback(async (firstJob: CompileJob) => {
    const queue = queueRef.current;
    if (queue.running) {
      queue.trailing = firstJob;
      if (firstJob.trigger === "auto") setAutoCompilePending(true);
      return;
    }
    const isCurrentJob = (job: CompileJob) =>
      mountedRef.current &&
      job.generation === generationRef.current &&
      job.draftId === contentRef.current.draftId;

    queue.running = true;
    let job: CompileJob | null = firstJob;
    try {
      while (job) {
        lastAttemptRef.current = { draftId: job.draftId, signature: job.signature };
        if (job.trigger === "auto") setAutoCompilePending(false);
        setCompileStatus("compiling");
        clearStatus();
        let result: WritingCompileSummary | null = null;
        let failureMessage: string | null = null;
        try {
          result = await writingApi.compilePdf(job.payload);
        } catch (err) {
          failureMessage = formatErrorMessage(err);
        }
        if (isCurrentJob(job)) {
          if (failureMessage !== null) {
            setCompileStatus("failed");
            if (job.trigger === "manual") onError(failureMessage);
          } else if (result) {
            setCompileResult(result);
            saveCompileRecord(compileResultStorageKey(job.draftId), {
              signature: job.signature,
              summary: result,
            });
            if (result.success && result.pdfPath) {
              setCompileStatus("ready");
              setCompilerMissing(false);
              setLastSuccess({ draftId: job.draftId, signature: job.signature, result });
            } else {
              setCompileStatus("failed");
              if (isLatexCompilerMissing(result)) {
                setCompilerMissing(true);
                if (job.trigger === "manual") onError(LATEX_INSTALL_SUPPORT.missingCompilerMessage);
              } else if (job.trigger === "manual") {
                onError("PDF 编译失败，请展开编译日志查看具体错误。");
              }
            }
          }
        }
        const next = queue.trailing;
        queue.trailing = null;
        if (!next) {
          job = null;
        } else {
          if (next.trigger === "auto") setAutoCompilePending(false);
          // 旧草稿的尾随任务直接丢弃；与刚完成的任务同签名说明内容没变，不再重复编译。
          job = isCurrentJob(next) && next.signature !== job.signature ? next : null;
        }
      }
    } finally {
      queue.running = false;
    }
  }, [clearStatus, onError]);

  const enqueueAutoCompile = useCallback(() => {
    const snapshot = contentRef.current;
    if (!snapshot.draftId) return;
    const job = buildCompileJob(snapshot, "auto", generationRef.current);
    const last = lastAttemptRef.current;
    if (last && last.draftId === job.draftId && last.signature === job.signature) return;
    void runQueue(job);
  }, [runQueue]);

  useEffect(() => {
    if (!autoCompileEnabled || !draftId || compilerMissing) return;
    const last = lastAttemptRef.current;
    if (last && last.draftId === draftId && last.signature === signature) return;
    setAutoCompilePending(true);
    const timer = window.setTimeout(() => {
      setAutoCompilePending(false);
      enqueueAutoCompile();
    }, WRITING_COMPILE_AUTO_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      setAutoCompilePending(false);
    };
  }, [autoCompileEnabled, draftId, signature, compilerMissing, enqueueAutoCompile]);

  const compilePdf = useCallback(async () => {
    const snapshot = contentRef.current;
    if (!snapshot.draftId) return;
    await runQueue(buildCompileJob(snapshot, "manual", generationRef.current));
  }, [runQueue]);

  const setAutoCompileEnabled = useCallback((enabled: boolean) => {
    setAutoCompileEnabledState(enabled);
    try {
      localStorage.setItem(WRITING_AUTO_COMPILE_ENABLED_KEY, JSON.stringify(enabled));
    } catch {
      // 存储不可用时仅保留内存态。
    }
    if (!enabled) {
      const queue = queueRef.current;
      if (queue.trailing?.trigger === "auto") {
        queue.trailing = null;
        setAutoCompilePending(false);
      }
    }
  }, []);

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
    if (!previewResult?.pdfPath) return;
    try {
      await writingApi.openCompiledPdf(previewResult.pdfPath);
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [previewResult, onError]);

  const saveCompiledPdf = useCallback(async () => {
    if (!previewResult?.pdfPath) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        defaultPath: `${sanitizeLatexProjectName(projectName)}.pdf`,
      });
      if (!path) return;
      await writingApi.copyPdf(previewResult.pdfPath, path);
      onMessage(`已保存 PDF：${path.split("/").pop() ?? path}`);
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [previewResult, onError, onMessage, projectName]);

  return {
    compileStatus,
    compileResult,
    latexInstallerStatus,
    compilePdf,
    openLatexInstaller,
    openLatexDownloadPage,
    openCompiledPdf,
    saveCompiledPdf,
    autoCompileEnabled,
    setAutoCompileEnabled,
    autoCompilePending,
    previewResult,
    previewStale,
  };
}

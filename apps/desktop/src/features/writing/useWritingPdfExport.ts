import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { formatErrorMessage } from "../../lib/client";

interface ExportScope {
  pdfPath: string | null;
}

interface ExportFeedback {
  scope: ExportScope;
  message: string;
  error: string;
}

interface ExportOperation {
  scope: ExportScope;
}

function emptyFeedback(pdfPath: string | null): ExportFeedback {
  return { scope: { pdfPath }, message: "", error: "" };
}

/** Own one export across PDF/tab changes; only its originating visit receives feedback. */
export function useWritingPdfExport(pdfPath: string | null) {
  const [feedback, setFeedback] = useState(() => emptyFeedback(pdfPath));
  let currentFeedback = feedback;
  if (feedback.scope.pdfPath !== pdfPath) {
    currentFeedback = emptyFeedback(pdfPath);
    setFeedback(currentFeedback);
  }
  const { scope } = currentFeedback;
  const committedScope = useRef<ExportScope | null>(null);
  const pending = useRef<ExportOperation | null>(null);
  const [operation, setOperation] = useState<ExportOperation | null>(null);

  useLayoutEffect(() => {
    committedScope.current = scope;
    return () => {
      if (committedScope.current === scope) committedScope.current = null;
    };
  }, [scope]);

  const savePdf = useCallback(async () => {
    const source = scope.pdfPath;
    if (!source || committedScope.current !== scope || pending.current) return;
    const request: ExportOperation = { scope };
    pending.current = request;
    setOperation(request);
    setFeedback((current) => current.scope === scope ? { ...current, message: "", error: "" } : current);
    const report = (message: string, error: string) => {
      if (committedScope.current !== scope) return;
      setFeedback((current) => current.scope === scope ? { ...current, message, error } : current);
    };

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      // Do not open a delayed native dialog after its initiating view has gone.
      if (committedScope.current !== scope) return;
      const destination = await save({
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        defaultPath: "paper.pdf",
      });
      if (!destination) return;

      // A confirmed export keeps the clicked source, even if the preview changes.
      // Read before writing also preserves the existing same-path save behavior.
      const { readFile, writeFile } = await import("@tauri-apps/plugin-fs");
      const bytes = await readFile(source);
      await writeFile(destination, bytes);
      const fileName = destination.split(/[\\/]/).pop() || "PDF";
      report(`PDF 已保存：${fileName}`, "");
    } catch (error) {
      report("", `PDF 保存失败：${formatErrorMessage(error)}`);
    } finally {
      if (pending.current === request) {
        pending.current = null;
        if (committedScope.current) setOperation(null);
      }
    }
  }, [scope]);

  const saving = operation !== null;
  const message = saving
    ? operation.scope === scope ? "正在保存 PDF…" : "正在保存之前选择的 PDF…"
    : currentFeedback.message;

  return { saving, message, error: currentFeedback.error, savePdf };
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PreviewOptions {
  isFullscreen: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  canvasRefs: RefObject<Map<number, HTMLCanvasElement>>;
  setZoomLevel: (value: number) => void;
  clampZoom: (value: number) => number;
}
interface PreviewScope { pdfPath: string | null; }
interface PreviewState {
  scope: PreviewScope;
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pdfLoading: boolean;
  pdfError: boolean;
}
interface PreviewLifetime {
  scope: PreviewScope;
  disposed: boolean;
  renderFailed: boolean;
  loadingTask: pdfjsLib.PDFDocumentLoadingTask | null;
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  renderTasks: Set<pdfjsLib.RenderTask>;
}

function emptyPreview(pdfPath: string | null): PreviewState {
  return { scope: { pdfPath }, pdfDoc: null, pdfLoading: Boolean(pdfPath), pdfError: false };
}
function cancelTask(lifetime: PreviewLifetime, task: pdfjsLib.RenderTask) {
  if (!lifetime.renderTasks.delete(task)) return;
  try { task.cancel(); } catch { /* Already stopped; still release the document owner. */ }
}

/** Own the PDF loading task and its render work for one committed source visit. */
export function useWritingPdfPreview(pdfPath: string | null, {
  isFullscreen, scrollRef, canvasRefs, setZoomLevel, clampZoom,
}: PreviewOptions) {
  const [state, setState] = useState(() => emptyPreview(pdfPath));
  let preview = state;
  if (state.scope.pdfPath !== pdfPath) {
    preview = emptyPreview(pdfPath);
    setState(preview);
  }
  const { scope, pdfDoc, pdfError } = preview;
  const committedScope = useRef<PreviewScope | null>(null);
  const owner = useRef<PreviewLifetime | null>(null);

  useLayoutEffect(() => {
    committedScope.current = scope;
    return () => {
      if (committedScope.current === scope) committedScope.current = null;
    };
  }, [scope]);

  const isCurrent = useCallback((lifetime: PreviewLifetime) =>
    !lifetime.disposed && committedScope.current === lifetime.scope, []);
  const reportRenderError = useCallback((lifetime: PreviewLifetime) => {
    if (!isCurrent(lifetime) || lifetime.renderFailed) return;
    lifetime.renderFailed = true;
    lifetime.renderTasks.forEach((task) => cancelTask(lifetime, task));
    setState((current) => current.scope === lifetime.scope
      ? { ...current, pdfError: true } : current);
  }, [isCurrent]);

  useEffect(() => {
    const lifetime: PreviewLifetime = {
      scope, disposed: false, renderFailed: false, loadingTask: null, pdfDoc: null, renderTasks: new Set(),
    };
    owner.current = lifetime;
    const dispose = () => {
      if (lifetime.disposed) return;
      lifetime.disposed = true;
      lifetime.renderTasks.forEach((task) => cancelTask(lifetime, task));
      const task = lifetime.loadingTask;
      lifetime.loadingTask = null;
      lifetime.pdfDoc = null;
      if (!task) return;
      // LoadingTask owns both pending and loaded documents, including its worker.
      try {
        void Promise.resolve(task.destroy()).catch((error: unknown) => {
          console.warn("PDF 预览资源释放失败", error);
        });
      } catch (error) {
        console.warn("PDF 预览资源释放失败", error);
      }
    };

    async function load() {
      if (!scope.pdfPath) return;
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        if (!isCurrent(lifetime)) return;
        const bytes = await readFile(scope.pdfPath);
        if (!isCurrent(lifetime)) return;
        lifetime.loadingTask = pdfjsLib.getDocument({ data: bytes });
        const nextDocument = await lifetime.loadingTask.promise;
        if (!isCurrent(lifetime)) return;
        lifetime.pdfDoc = nextDocument;
        setState((current) => current.scope === scope
          ? { ...current, pdfDoc: nextDocument, pdfLoading: false, pdfError: false } : current);
        setZoomLevel(1);
      } catch {
        if (isCurrent(lifetime)) {
          setState((current) => current.scope === scope
            ? { ...current, pdfDoc: null, pdfLoading: false, pdfError: true } : current);
        }
        dispose();
      }
    }
    void load();
    return dispose;
  }, [scope, isCurrent, setZoomLevel]);

  // Fit once per loaded document; fullscreen keeps the user's current zoom.
  useEffect(() => {
    const lifetime = owner.current;
    if (pdfError || !pdfDoc || pdfDoc.numPages === 0 || !lifetime || lifetime.pdfDoc !== pdfDoc) return;
    const document = pdfDoc;
    const fitOwner = lifetime;
    let cancelled = false;
    async function fit() {
      try {
        const page = await document.getPage(1);
        if (cancelled || fitOwner.renderFailed || !isCurrent(fitOwner)) return;
        const viewport = page.getViewport({ scale: 1.5 });
        const element = scrollRef.current;
        const width = element?.clientWidth ?? 0;
        const height = element?.clientHeight ?? 0;
        if (width > 0 && height > 0) {
          setZoomLevel(clampZoom(Math.max(width / viewport.width, height / viewport.height)));
        } else if (width > 0) {
          setZoomLevel(clampZoom(width / viewport.width));
        }
      } catch {
        if (!cancelled) reportRenderError(fitOwner);
      }
    }
    void fit();
    return () => { cancelled = true; };
  }, [pdfDoc, pdfError, scrollRef, setZoomLevel, clampZoom, isCurrent, reportRenderError]);

  useEffect(() => {
    const lifetime = owner.current;
    if (pdfError || !pdfDoc || pdfDoc.numPages === 0 || !lifetime || lifetime.pdfDoc !== pdfDoc) return;
    const document = pdfDoc;
    const renderOwner = lifetime;
    let cancelled = false;
    const tasks = new Set<pdfjsLib.RenderTask>();
    async function renderPages() {
      try {
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
          if (cancelled || renderOwner.renderFailed || !isCurrent(renderOwner)) return;
          const page = await document.getPage(pageNumber);
          if (cancelled || renderOwner.renderFailed || !isCurrent(renderOwner)) return;
          const canvas = canvasRefs.current.get(pageNumber);
          if (!canvas) continue;
          const viewport = page.getViewport({ scale: 1.5 });
          const pixelRatio = window.devicePixelRatio || 1;
          canvas.width = viewport.width * pixelRatio;
          canvas.height = viewport.height * pixelRatio;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("无法创建 PDF 画布");
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          const task = page.render({ canvasContext: context, viewport, canvas });
          tasks.add(task);
          renderOwner.renderTasks.add(task);
          try {
            await task.promise;
          } finally {
            tasks.delete(task);
            renderOwner.renderTasks.delete(task);
          }
        }
      } catch {
        if (!cancelled) reportRenderError(renderOwner);
      }
    }
    void renderPages();
    return () => {
      cancelled = true;
      tasks.forEach((task) => cancelTask(renderOwner, task));
      tasks.clear();
    };
  }, [pdfDoc, pdfError, isFullscreen, canvasRefs, isCurrent, reportRenderError]);

  return {
    pdfDoc: preview.pdfDoc,
    numPages: preview.pdfDoc?.numPages ?? 0,
    pdfLoading: preview.pdfLoading,
    pdfError: preview.pdfError,
  };
}

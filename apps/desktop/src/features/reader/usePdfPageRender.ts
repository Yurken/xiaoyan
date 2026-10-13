import { useEffect, useRef, useState, type RefObject } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask, TextLayer } from "pdfjs-dist";
import { resolveCanvasOutputScale, type PdfLink } from "./pdfRenderingShared";
import type { PdfRenderQueue } from "./pdfRenderQueue";

interface Options {
  pdfDoc: PDFDocumentProxy;
  pageNum: number;
  renderScale: number;
  devicePixelRatio: number;
  shouldRender: boolean;
  retainResources: boolean;
  renderQueue: PdfRenderQueue;
  renderPriority: () => number;
  textLayerRef: RefObject<HTMLDivElement | null>;
}

/** Owns bitmap URLs, transient canvases and text layers independently of annotations. */
export function usePdfPageRender({
  pdfDoc, pageNum, renderScale, devicePixelRatio, shouldRender, retainResources,
  renderQueue, renderPriority, textLayerRef,
}: Options) {
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [renderedScale, setRenderedScale] = useState(renderScale);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [links, setLinks] = useState<PdfLink[]>([]);
  const signature = useRef("");
  const owned = useRef<{ url: string; layer: HTMLDivElement | null; text: TextLayer | null } | null>(null);
  const priority = useRef(renderPriority);
  priority.current = renderPriority;

  useEffect(() => {
    signature.current = "";
    setPageSize(null);
    setImgSrc(null);
    setLinks([]);
    return () => {
      if (owned.current) {
        URL.revokeObjectURL(owned.current.url);
        owned.current.layer?.remove();
        owned.current = null;
      }
    };
  }, [pdfDoc, pageNum]);

  useEffect(() => {
    if (retainResources || shouldRender) return;
    if (owned.current) {
      URL.revokeObjectURL(owned.current.url);
      owned.current.layer?.remove();
      owned.current = null;
    }
    signature.current = "";
    setImgSrc(null);
    setLinks([]);
    // Keep pageSize/renderedScale: eviction must not collapse scroll geometry.
  }, [retainResources, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    return renderQueue.enqueue(() => priority.current(), async (signal) => {
      let task: RenderTask | null = null;
      let textLayer: TextLayer | null = null;
      let buffer: HTMLCanvasElement | null = null;
      let staging: HTMLDivElement | null = null;
      let nextUrl: string | null = null;
      const cancel = () => { task?.cancel(); textLayer?.cancel(); };
      signal.addEventListener("abort", cancel, { once: true });
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (signal.aborted) return;
        const viewport = page.getViewport({ scale: renderScale });
        const outputScale = resolveCanvasOutputScale(viewport, devicePixelRatio);
        const width = Math.max(1, Math.floor(viewport.width * outputScale));
        const height = Math.max(1, Math.floor(viewport.height * outputScale));
        const nextSignature = `${renderScale}:${width}:${height}`;
        if (signature.current === nextSignature) return;
        buffer = document.createElement("canvas");
        buffer.width = width;
        buffer.height = height;
        const context = buffer.getContext("2d", { alpha: false });
        if (!context) throw new Error("无法创建 PDF 画布");
        task = page.render({ canvasContext: context, canvas: buffer, viewport,
          transform: [outputScale, 0, 0, outputScale, 0, 0], background: "white" });
        await task.promise;
        if (signal.aborted) return;
        const renderedCanvas = buffer;
        const blob = await new Promise<Blob | null>((resolve) => renderedCanvas.toBlob(resolve, "image/png"));
        if (signal.aborted || !blob) return;
        nextUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.src = nextUrl;
        if (image.decode) await image.decode();
        if (signal.aborted) return;

        const host = textLayerRef.current;
        // Build text once per retained page; zoom updates its geometry at bitmap commit.
        try {
          const content = owned.current?.layer ? null : await page.getTextContent();
          if (signal.aborted) return;
          if (host && content) {
            staging = document.createElement("div");
            staging.className = "textLayer rc-selectable";
            staging.style.visibility = "hidden";
            staging.style.setProperty("--scale-factor", String(renderScale));
            staging.style.setProperty("--total-scale-factor", String(renderScale * viewport.userUnit));
            host.append(staging);
            pdfjsLib.setLayerDimensions(staging, viewport);
            textLayer = new pdfjsLib.TextLayer({ textContentSource: content, container: staging, viewport });
            await textLayer.render();
            if (signal.aborted) return;
            staging.querySelectorAll("span").forEach((span) => {
              span.style.userSelect = "text";
              span.style.webkitUserSelect = "text";
              span.style.cursor = "text";
            });
          }
        } catch (error) {
          if (signal.aborted) return;
          staging?.remove();
          staging = null;
          console.error(`[PDF] 第 ${pageNum} 页文本层渲染失败`, error);
        }
        const nextLinks: PdfLink[] = [];
        try {
          const annotations = await page.getAnnotations();
          if (signal.aborted) return;
          for (const annotation of annotations) {
            if (annotation.subtype !== "Link" || (!annotation.url && annotation.dest == null)) continue;
            const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(annotation.rect);
            nextLinks.push({ left: Math.min(x1, x2), top: Math.min(y1, y2),
              width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), url: annotation.url, dest: annotation.dest });
          }
        } catch (error) {
          if (signal.aborted) return;
          console.error(`[PDF] 第 ${pageNum} 页链接解析失败`, error);
        }
        if (signal.aborted) return;
        const old = owned.current;
        const reused = old?.layer ? old : null;
        // Zoom changes geometry, not text identity: keep native Range endpoints alive.
        if (reused?.layer) {
          reused.layer.style.setProperty("--scale-factor", String(renderScale));
          reused.layer.style.setProperty("--total-scale-factor", String(renderScale * viewport.userUnit));
          pdfjsLib.setLayerDimensions(reused.layer, viewport);
          reused.text?.update({ viewport });
        }
        const committedLayer = staging;
        if (committedLayer) {
          committedLayer.style.visibility = "";
        }
        owned.current = {
          url: nextUrl, layer: reused?.layer ?? committedLayer, text: reused?.text ?? textLayer,
        };
        setImgSrc(nextUrl);
        setPageSize({ w: viewport.width, h: viewport.height });
        setRenderedScale(renderScale);
        setLinks(nextLinks);
        signature.current = nextSignature;
        nextUrl = null;
        staging = null;
        if (!reused) old?.layer?.remove();
        if (old) URL.revokeObjectURL(old.url);
      } catch (error) {
        if (!signal.aborted) console.error(`[PDF] 第 ${pageNum} 页渲染失败`, error);
      } finally {
        signal.removeEventListener("abort", cancel);
        staging?.remove();
        if (nextUrl) URL.revokeObjectURL(nextUrl);
        if (buffer) { buffer.width = 0; buffer.height = 0; }
      }
    });
  }, [shouldRender, pdfDoc, pageNum, renderScale, devicePixelRatio, renderQueue, textLayerRef]);

  return { pageSize, renderedScale, imgSrc, links };
}

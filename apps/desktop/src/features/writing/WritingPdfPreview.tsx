import { createPortal } from "react-dom";
import { Download, FileCheck2, Loader2, Maximize, Minimize, Minus, Plus, RotateCcw, X } from "lucide-react";
import type { WritingCompileSummary } from "./shared";
import { useWritingPdfPreview, ZOOM_MAX, ZOOM_MIN } from "./useWritingPdfPreview";

export interface WritingPdfPreviewProps {
  /** 最后一次编译成功的结果；失败结果由工作区另一侧处理，这里只负责呈现成功产出的 PDF。 */
  compileResult: WritingCompileSummary | null;
  draftId: string;
  /** 注入时保存动作完全由宿主接管；缺省保留内置的「另存为 PDF」实现。 */
  onSave?: () => void;
}

/**
 * 论文 PDF 阅读器：灰色阅读背景 + 底部悬浮工具栏（缩放 / 下载 / 全屏）。
 * 文档加载、懒渲染、拖拽、快捷键等逻辑都在 useWritingPdfPreview 里。
 */
export default function WritingPdfPreview({ compileResult, draftId, onSave }: WritingPdfPreviewProps) {
  const preview = useWritingPdfPreview({ compileResult, draftId, onSave });

  if (!preview.pdfPath) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-apple-blue/5 text-apple-blue/30 shadow-sm">
          <FileCheck2 className="h-8 w-8" />
        </div>
        <div className="max-w-[200px]">
          <p className="text-sm font-bold text-ink-primary">论文预览</p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-tertiary">
            开始写作后，这里会自动生成论文预览。
          </p>
        </div>
      </div>
    );
  }

  const scrollArea = (
    <div
      ref={preview.scrollRef}
      className="min-h-0 flex-1 w-full overflow-auto select-none outline-none"
      style={{ cursor: preview.isDragging ? "grabbing" : "grab" }}
      tabIndex={-1}
      onMouseDown={preview.handleMouseDown}
      onMouseEnter={() => preview.setHovered(true)}
      onMouseLeave={() => preview.setHovered(false)}
      onFocus={() => preview.setFocused(true)}
      onBlur={() => preview.setFocused(false)}
    >
      <div className="mx-auto flex w-fit flex-col items-center gap-1 py-2" style={{ zoom: preview.zoomLevel }}>
        {Array.from({ length: preview.numPages }, (_, i) => i + 1).map((pageNum) => (
          <canvas key={pageNum} ref={preview.registerCanvas(pageNum)} className="shadow-md" />
        ))}
      </div>
    </div>
  );

  const pdfContent = (
    <>
      {preview.pdfLoading && !preview.pdfDoc ? (
        <div className="flex h-full w-full items-center justify-center gap-2 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs">加载 PDF...</span>
        </div>
      ) : preview.pdfError && !preview.pdfDoc ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/60">
          <p className="text-xs">无法加载 PDF 预览</p>
        </div>
      ) : (
        scrollArea
      )}
      {preview.pdfLoading && preview.pdfDoc && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-white/70 backdrop-blur-md">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-[10px]">更新预览...</span>
        </div>
      )}
      {preview.pdfDoc && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1.5 backdrop-blur-md">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white transition"
            onClick={preview.zoomOut}
            disabled={preview.zoomLevel <= ZOOM_MIN}
            title="缩小"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-6 min-w-[44px] items-center justify-center rounded text-[11px] font-medium text-white hover:bg-white/10 transition"
            onClick={preview.resetZoom}
            title="重置缩放"
          >
            {Math.round(preview.zoomLevel * 100)}%
          </button>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white transition"
            onClick={preview.zoomIn}
            disabled={preview.zoomLevel >= ZOOM_MAX}
            title="放大"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {preview.zoomLevel !== 1 && (
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white/80 transition"
              onClick={preview.resetZoom}
              title="恢复 100%"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          <span className="mx-0.5 h-4 w-px bg-white/15" />
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white transition"
            onClick={preview.handleSave}
            title="下载 PDF"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white transition"
            onClick={() => preview.setIsFullscreen((prev) => !prev)}
            title={preview.isFullscreen ? "退出全屏" : "全屏预览"}
          >
            {preview.isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </>
  );

  if (preview.isFullscreen) {
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "rgba(0,0,0,0.92)" }}
        onClick={() => preview.setIsFullscreen(false)}
      >
        <button
          type="button"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            preview.setIsFullscreen(false);
          }}
          title="退出全屏"
        >
          <X className="h-5 w-5" />
        </button>
        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{ background: "#525659" }}
          onClick={(e) => e.stopPropagation()}
        >
          {pdfContent}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border shadow-lg"
      style={{
        borderColor: "var(--rc-border)",
        background: "#525659",
      }}
    >
      {pdfContent}
    </div>
  );
}

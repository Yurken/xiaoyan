import { Download, Loader2, RotateCcw } from "lucide-react";

interface WritingPdfPreviewErrorProps {
  onRetry: () => void;
  onSave: () => void;
  saving: boolean;
}

export default function WritingPdfPreviewError({ onRetry, onSave, saving }: WritingPdfPreviewErrorProps) {
  return (
    <div role="alert" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center text-white/70">
      <p className="text-sm font-medium text-white">无法加载 PDF 预览</p>
      <p className="max-w-xs text-xs leading-5">可重试预览；若文件已移动或删除，请重新编译 PDF。</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          onClick={onRetry}
        >
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          重试预览
        </button>
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:opacity-50"
          onClick={onSave}
          disabled={saving}
          aria-busy={saving}
          aria-label={saving ? "正在保存 PDF" : "下载 PDF"}
          title={saving ? "正在保存 PDF" : "下载 PDF"}
        >
          {saving
            ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            : <Download aria-hidden="true" className="h-3.5 w-3.5" />}
          {saving ? "正在保存 PDF" : "下载 PDF"}
        </button>
      </div>
    </div>
  );
}

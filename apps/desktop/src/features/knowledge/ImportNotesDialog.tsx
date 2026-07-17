import { useEffect, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button, Select } from "@research-copilot/ui";
import type { ResearchInterest } from "@research-copilot/types";
import { buildInterestOptions, parseNoteFromFile } from "./notesShared";
import type { ImportableNote } from "./useNotesImport";

export default function ImportNotesDialog({
  interests,
  defaultInterestId = "",
  lockInterest = false,
  onImport,
  onClose,
}: {
  interests: ResearchInterest[];
  defaultInterestId?: string;
  lockInterest?: boolean;
  onImport: (filePaths: string[], researchInterestId?: string) => Promise<{ created: number; failed: string[] }>;
  onClose: () => void;
}) {
  const [interestId, setInterestId] = useState(defaultInterestId);
  const [files, setFiles] = useState<string[]>([]);
  const [previews, setPreviews] = useState<ImportableNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: string[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose]);

  const handlePickFiles = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: true,
      filters: [{ name: "Markdown / 文本", extensions: ["md", "txt", "markdown"] }],
    });
    if (!selected) return;
    const paths = (Array.isArray(selected) ? selected : [selected])
      .map((item) => (typeof item === "string" ? item : String((item as { path: unknown }).path)))
      .filter(Boolean);
    if (paths.length === 0) return;
    setFiles(paths);
    setResult(null);
    setError("");
    await loadPreviews(paths);
  };

  const loadPreviews = async (paths: string[]) => {
    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const next: ImportableNote[] = [];
      for (const path of paths) {
        try {
          const raw = await readTextFile(path);
          next.push(parseNoteFromFile(path, raw));
        } catch {
          const fileName = path.split(/[/\\]/).pop() ?? path;
          next.push({ fileName, title: fileName, content: "（读取失败）" });
        }
      }
      setPreviews(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取文件失败");
    }
  };

  const handleImport = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await onImport(files, (lockInterest ? defaultInterestId : interestId) || undefined);
      setResult(res);
      if (res.failed.length === 0) {
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "var(--rc-modal-backdrop)", backdropFilter: "blur(6px)" }}
      onClick={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border"
        style={{
          background: "var(--rc-modal-bg)",
          borderColor: "var(--rc-border)",
          boxShadow: "var(--rc-modal-shadow)",
        }}
      >
        <div className="flex flex-shrink-0 items-center justify-between px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink-primary">
            <Upload className="h-4 w-4 text-apple-blue" />
            导入本地笔记
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-ink-tertiary transition-colors hover:text-ink-primary disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {!lockInterest && (
              <div className="min-w-[200px] flex-1 space-y-1">
                <label className="ml-1 block text-xs font-medium text-ink-tertiary">关联研究主题（可选）</label>
                <Select
                  value={interestId}
                  onChange={setInterestId}
                  options={buildInterestOptions(interests, "不关联")}
                />
              </div>
            )}
            <Button type="button" variant="secondary" onClick={() => void handlePickFiles()} disabled={loading}>
              <FileText className="mr-1 h-4 w-4" />
              选择文件
            </Button>
          </div>

          {previews.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-10" style={{ borderColor: "var(--rc-border)" }}>
              <Upload className="h-8 w-8 text-ink-tertiary/40" />
              <p className="text-sm text-ink-tertiary">选择 Markdown / 文本文件导入为知识笔记</p>
              <p className="text-xs text-ink-tertiary/60">支持 .md、.txt、.markdown</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl px-1 py-2" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
              {previews.map((preview, index) => (
                <div key={`${files[index]}-${index}`} className="flex items-start gap-3 rounded-xl bg-white/40 px-3 py-2.5">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--rc-surface)" }}>
                    <FileText className="h-4 w-4 text-apple-blue" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-primary">{preview.title}</p>
                    <p className="truncate text-xs text-ink-tertiary">{preview.content || "（无内容）"}</p>
                    <p className="mt-0.5 text-[10px] text-ink-tertiary/60">{files[index]?.split(/[/\\]/).pop()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={loading}
                    className="text-ink-tertiary/60 transition-colors hover:text-apple-red disabled:opacity-40"
                    aria-label="移除"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-apple-red">{error}</p>}

          {result && (
            <div className="rounded-xl px-3 py-2 text-xs" style={{ background: result.failed.length === 0 ? "rgba(52,199,89,0.08)" : "rgba(255,204,0,0.08)" }}>
              <span style={{ color: result.failed.length === 0 ? "#1D6E35" : "#9A6C00" }}>
                成功导入 {result.created} 条{result.failed.length > 0 ? `，${result.failed.length} 条失败` : ""}
              </span>
              {result.failed.length > 0 && (
                <ul className="mt-1 max-h-24 overflow-y-auto text-[10px] text-ink-tertiary">
                  {result.failed.map((msg, i) => <li key={i}>• {msg}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-shrink-0 justify-end gap-2">
            <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>
              取消
            </Button>
            <Button type="button" loading={loading} disabled={files.length === 0} onClick={() => void handleImport()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {loading ? "导入中…" : `导入 ${files.length > 0 ? `（${files.length}）` : ""}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

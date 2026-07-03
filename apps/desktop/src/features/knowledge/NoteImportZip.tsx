import { useEffect, useState } from "react";
import { FileArchive, Loader2, X } from "lucide-react";
import { Button, Select } from "@research-copilot/ui";
import type { KnowledgeImportZipResult } from "../../lib/client";
import type { ResearchInterest } from "@research-copilot/types";

interface NoteImportZipProps {
  interests: ResearchInterest[];
  researchInterestId?: string;
  onImport: (filePath: string, targetInterestId?: string) => Promise<KnowledgeImportZipResult>;
}

function interestDisplayName(interest: ResearchInterest) {
  return interest.folder_name?.trim() || interest.topic;
}

export default function NoteImportZip({
  interests,
  researchInterestId,
  onImport,
}: NoteImportZipProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedInterestId, setSelectedInterestId] = useState(researchInterestId ?? "");
  const [result, setResult] = useState<KnowledgeImportZipResult | null>(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  const reset = () => {
    setError("");
    setResult(null);
    setSelectedInterestId(researchInterestId ?? "");
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      setOpen(false);
      reset();
    }, 200);
  };

  const handleSelectFile = async () => {
    setError("");
    setResult(null);

    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "压缩包", extensions: ["zip"] }],
      });
      if (typeof selected !== "string") return;

      setImporting(true);
      const importResult = await onImport(
        selected,
        researchInterestId || selectedInterestId || undefined,
      );
      setResult(importResult);
      if (importResult.errors.length > 0 && importResult.imported === 0) {
        setError(importResult.errors.join("；"));
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        className="whitespace-nowrap"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <FileArchive className="h-4 w-4" />
        导入压缩包
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: visible ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0)",
            transition: "background 0.2s ease",
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 shadow-xl"
            style={{
              background: "linear-gradient(160deg, #F3F6FA 0%, var(--rc-surface) 100%)",
              transform: visible ? "scale(1)" : "scale(0.96)",
              opacity: visible ? 1 : 0,
              transition: "transform 0.2s ease, opacity 0.2s ease",
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-primary">导入 Markdown 压缩包</p>
              <button
                type="button"
                onClick={handleClose}
                className="text-ink-tertiary transition-colors hover:text-ink-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-ink-tertiary">
              支持导入包含多个 .md 文件及图片资源的 ZIP 压缩包。系统会自动解压、复制图片并重写笔记中的相对路径。
            </p>

            {!researchInterestId && (
              <div className="mt-4 space-y-1">
                <label className="ml-1 block text-xs font-medium text-ink-tertiary">关联研究主题（可选）</label>
                <Select
                  value={selectedInterestId}
                  onChange={setSelectedInterestId}
                  options={[{ value: "", label: "不关联" }, ...interests.map((item) => ({
                    value: item.id,
                    label: interestDisplayName(item),
                  }))]}
                />
              </div>
            )}

            {error && <p className="mt-3 text-xs text-apple-red ml-1">{error}</p>}

            {result && (
              <div className="mt-3 rounded-xl bg-white/50 px-3 py-2 text-xs text-ink-secondary">
                <p>成功导入 {result.imported} 条笔记。</p>
                {result.errors.length > 0 && (
                  <p className="mt-1 text-apple-red">
                    {result.errors.length} 个文件处理失败：{result.errors.join("；")}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={handleClose}>
                关闭
              </Button>
              <Button size="sm" disabled={importing} onClick={() => void handleSelectFile()}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                {importing ? "导入中…" : "选择压缩包"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

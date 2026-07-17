import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen, Upload, X } from "lucide-react";
import { Button, Select } from "@research-copilot/ui";
import type { ResearchInterest } from "@research-copilot/types";
import { buildFolderSelectOptions } from "./interestTree";

interface PaperImportDialogProps {
  interests: ResearchInterest[];
  defaultInterestId: string;
  uploading: boolean;
  batchProgress: { done: number; total: number } | null;
  onImport: (interestId: string) => Promise<unknown>;
  onClose: () => void;
}

export default function PaperImportDialog({
  interests,
  defaultInterestId,
  uploading,
  batchProgress,
  onImport,
  onClose,
}: PaperImportDialogProps) {
  const [interestId, setInterestId] = useState(defaultInterestId);
  const folderOptions = useMemo(() => [{ value: "", label: "未归档" }, ...buildFolderSelectOptions(interests)], [interests]);

  useEffect(() => {
    setInterestId(defaultInterestId);
  }, [defaultInterestId]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: "var(--rc-modal-backdrop)", backdropFilter: "blur(6px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !uploading) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[28px] border"
        style={{
          background: "var(--rc-modal-bg)",
          borderColor: "var(--rc-border)",
          boxShadow: "var(--rc-modal-shadow)",
        }}
      >
        <header className="flex items-start gap-3 border-b px-5 py-4" style={{ borderColor: "var(--rc-border)" }}>
          <div
            className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "var(--rc-card-inset-bg)", color: "var(--rc-accent)" }}
          >
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink-primary">导入 PDF</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-tertiary">
              先选择这批论文要放入的文件夹，再选择本地 PDF。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-tertiary transition-colors hover:bg-[var(--rc-list-item-hover-bg)] hover:text-ink-primary disabled:opacity-40"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <Select
            label="导入到"
            value={interestId}
            onChange={setInterestId}
            options={folderOptions}
            disabled={uploading}
          />
          <div
            className="flex items-start gap-3 rounded-2xl border px-3 py-3"
            style={{ background: "var(--rc-card-inset-bg)", borderColor: "var(--rc-border)" }}
          >
            <FolderOpen className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-tertiary" />
            <p className="text-xs leading-relaxed text-ink-tertiary">
              拖拽 PDF 到论文库仍会导入到上次选择的文件夹；这里的选择会作为新的默认导入目标。
            </p>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t px-5 py-4" style={{ borderColor: "var(--rc-border)" }}>
          <Button type="button" variant="secondary" disabled={uploading} onClick={onClose}>
            取消
          </Button>
          <Button type="button" onClick={() => void onImport(interestId)} loading={uploading}>
            <Upload className="h-4 w-4" />
            {batchProgress ? `导入中 (${batchProgress.done}/${batchProgress.total})` : "选择 PDF"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

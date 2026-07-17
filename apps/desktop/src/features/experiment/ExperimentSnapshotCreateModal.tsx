import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Camera, X } from "lucide-react";
import { Button, Input } from "@research-copilot/ui";

interface ExperimentSnapshotCreateModalProps {
  open: boolean;
  experimentTitle: string;
  capturesCodeState: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (title: string) => Promise<boolean>;
}

function defaultSnapshotTitle() {
  return `快照 ${new Date().toLocaleString("zh-CN")}`;
}

export function ExperimentSnapshotCreateModal({
  open,
  experimentTitle,
  capturesCodeState,
  creating,
  onClose,
  onCreate,
}: ExperimentSnapshotCreateModalProps) {
  const [title, setTitle] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const creatingRef = useRef(creating);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    creatingRef.current = creating;
    onCloseRef.current = onClose;
  }, [creating, onClose]);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultSnapshotTitle());
    window.requestAnimationFrame(() => inputRef.current?.select());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creatingRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || creating) return;
    if (await onCreate(title)) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "var(--rc-modal-backdrop)", backdropFilter: "blur(6px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !creating) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-[28px] border p-5"
        style={{
          background: "var(--rc-modal-bg)",
          borderColor: "var(--rc-border)",
          boxShadow: "var(--rc-modal-shadow)",
        }}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "var(--rc-card-inset-bg)", color: "var(--rc-accent)" }}
          >
            <Camera className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-base font-semibold text-ink-primary">创建实验快照</h3>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-ink-tertiary">
              将保存「{experimentTitle}」的配置、结果和备注
              {capturesCodeState ? "，并记录当前 Git 分支、提交与未提交变更。" : "。选择代码目录后还可记录 Git 状态。"}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            disabled={creating}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-tertiary transition-colors hover:bg-[var(--rc-list-item-hover-bg)] hover:text-ink-primary disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <Input
            ref={inputRef}
            label="快照标题"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：学习率调优后"
            disabled={creating}
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" disabled={creating} onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={creating} disabled={!title.trim()}>
            创建快照
          </Button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Pencil, X } from "lucide-react";
import { Button, Input } from "@research-copilot/ui";

interface RenameSavedEntryModalProps {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  initialValue: string;
  placeholder?: string;
  error?: string;
  busy?: boolean;
  onClose: () => void;
  onRename: (name: string) => Promise<boolean> | boolean;
}

export default function RenameSavedEntryModal({
  open,
  title,
  description,
  label = "新名称",
  initialValue,
  placeholder,
  error,
  busy = false,
  onClose,
  onRename,
}: RenameSavedEntryModalProps) {
  const [name, setName] = useState(initialValue);
  const titleId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialValue);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [initialValue, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  const normalizedName = name.trim();
  const unchanged = normalizedName === initialValue.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!normalizedName || unchanged || busy) return;
    if (await onRename(normalizedName)) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(23, 25, 29, 0.28)", backdropFilter: "blur(6px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-md rounded-[28px] border p-5"
        style={{
          background: "var(--rc-elevated, var(--rc-surface))",
          borderColor: "var(--rc-border)",
          boxShadow: "var(--rc-card-shadow)",
        }}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "var(--rc-card-inset-bg)", color: "var(--rc-accent)" }}
          >
            <Pencil className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-base font-semibold text-ink-primary">{title}</h3>
            {description ? (
              <p id={descriptionId} className="mt-1 text-xs leading-5 text-ink-tertiary">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="关闭"
            disabled={busy}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-tertiary transition-colors hover:bg-black/5 hover:text-ink-primary disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <Input
            ref={inputRef}
            label={label}
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder={placeholder}
            disabled={busy}
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>取消</Button>
          <Button type="submit" loading={busy} disabled={!normalizedName || unchanged}>保存名称</Button>
        </div>
      </form>
    </div>
  );
}

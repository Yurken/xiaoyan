import { useState } from "react";
import { FolderPlus, Loader2 } from "lucide-react";

interface NewFolderButtonProps {
  label: string;
  placeholder?: string;
  onCreate: (name: string) => Promise<unknown> | void;
}

/** 内联「新建文件夹 / 子文件夹」控件：点击展开输入框，回车或确认即创建。 */
export default function NewFolderButton({ label, placeholder = "文件夹名称", onCreate }: NewFolderButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setOpen(false);
    setName("");
    setSaving(false);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    try {
      setSaving(true);
      await onCreate(trimmed);
      reset();
    } catch {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-ink-tertiary transition-colors hover:text-apple-blue"
        title={label}
      >
        <FolderPlus className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        autoFocus
        value={name}
        placeholder={placeholder}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); void submit(); }
          else if (e.key === "Escape") { e.preventDefault(); reset(); }
        }}
        className="w-32 rounded-lg px-2 py-1 text-xs text-ink-primary outline-none"
        style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }}
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!name.trim() || saving}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-white transition-colors disabled:opacity-50"
        style={{ background: "#007AFF" }}
      >
        {saving && <Loader2 className="h-3 w-3 animate-spin" />}建立
      </button>
      <button type="button" onClick={reset} className="text-[11px] text-ink-tertiary transition-colors hover:text-ink-primary">
        取消
      </button>
    </div>
  );
}

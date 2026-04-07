import { Loader2, X } from "lucide-react";

interface CoverLetterModalProps {
  open: boolean;
  text: string;
  loading: boolean;
  onClose: () => void;
  onChangeText: (value: string) => void;
}

export default function CoverLetterModal({
  open,
  text,
  loading,
  onClose,
  onChangeText,
}: CoverLetterModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)", maxHeight: "80vh" }}
      >
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--rc-border)" }}>
          <div>
            <h2 className="text-lg font-bold text-ink-primary">生成 Cover Letter</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">基于投稿历史与审稿意见自动生成</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5">
            <X className="w-5 h-5 text-ink-tertiary" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading && !text ? (
            <div className="flex items-center gap-2 text-ink-tertiary text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在生成…
            </div>
          ) : (
            <textarea
              className="w-full h-80 text-sm font-mono resize-none rounded-xl p-3 outline-none"
              style={{
                background: "var(--rc-card-inset-bg)",
                color: "var(--rc-text-primary)" as string,
                border: "1px solid var(--rc-border)",
              }}
              value={text}
              onChange={(event) => onChangeText(event.target.value)}
            />
          )}
        </div>
        <div className="px-6 py-4 flex-shrink-0 flex justify-end gap-3" style={{ borderTop: "1px solid var(--rc-border)" }}>
          <button
            onClick={() => navigator.clipboard.writeText(text)}
            disabled={!text}
            className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
            style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
          >
            复制
          </button>
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-medium" style={{ background: "#007AFF", color: "#fff" }}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

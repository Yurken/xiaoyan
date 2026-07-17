import { Loader2, X } from "lucide-react";

interface PolishPanelProps {
  open: boolean;
  text: string;
  loading: boolean;
  onClose: () => void;
  onChangeText: (value: string) => void;
  onApply: () => void;
}

export default function PolishPanel({
  open,
  text,
  loading,
  onClose,
  onChangeText,
  onApply,
}: PolishPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--rc-modal-backdrop)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "var(--rc-modal-bg)", boxShadow: "var(--rc-modal-shadow)", maxHeight: "80vh" }}
      >
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--rc-border)" }}>
          <div>
            <h2 className="text-lg font-bold text-ink-primary">AI 润色</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">对版本摘要/核心内容进行学术润色</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--rc-list-item-hover-bg)]">
            <X className="w-5 h-5 text-ink-tertiary" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading && !text ? (
            <div className="flex items-center gap-2 text-ink-tertiary text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              润色中…
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-ink-secondary mb-2">润色结果</p>
              <textarea
                className="w-full h-72 text-sm resize-none rounded-xl p-3 outline-none"
                style={{
                  background: "var(--rc-card-inset-bg)",
                  color: "var(--rc-text-primary)" as string,
                  border: "1px solid var(--rc-border)",
                }}
                value={text}
                onChange={(event) => onChangeText(event.target.value)}
                placeholder={loading ? "生成中…" : "润色结果将显示在此处"}
              />
              {loading ? (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-ink-tertiary">
                  <Loader2 className="w-3 h-3 animate-spin" /> 生成中…
                </div>
              ) : null}
            </div>
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
          <button
            onClick={onApply}
            disabled={!text}
            className="px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
            style={{ background: "var(--rc-button-primary-bg)", color: "#fff" }}
          >
            应用到版本
          </button>
        </div>
      </div>
    </div>
  );
}

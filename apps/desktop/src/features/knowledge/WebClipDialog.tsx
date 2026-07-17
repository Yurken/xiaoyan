import { useEffect, useState } from "react";
import { Globe, Loader2, X } from "lucide-react";
import { Button, Input, Select } from "@research-copilot/ui";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { buildInterestOptions } from "./notesShared";

/**
 * 网页剪辑对话框：输入 URL（可选关联研究主题）抓取为知识卡片。
 * 抓取成功后回调 onClipped，交由上层打开卡片复核。
 */
export default function WebClipDialog({
  interests,
  defaultInterestId = "",
  lockInterest = false,
  onClip,
  onClipped,
  onClose,
}: {
  interests: ResearchInterest[];
  defaultInterestId?: string;
  lockInterest?: boolean;
  onClip: (url: string, interestId?: string) => Promise<KnowledgeNote>;
  onClipped: (note: KnowledgeNote) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [interestId, setInterestId] = useState(defaultInterestId);
  const [loading, setLoading] = useState(false);
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

  const handleClip = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const note = await onClip(trimmed, (lockInterest ? defaultInterestId : interestId) || undefined);
      onClipped(note);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "网页剪辑失败。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "var(--rc-modal-backdrop)", backdropFilter: "blur(6px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-[28px] border p-5"
        style={{
          background: "var(--rc-modal-bg)",
          borderColor: "var(--rc-border)",
          boxShadow: "var(--rc-modal-shadow)",
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink-primary">
            <Globe className="h-4 w-4 text-apple-blue" />
            剪辑网页为笔记
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

        <div className="mt-4 space-y-3">
          <Input
            label="网页 URL"
            value={url}
            onChange={(event) => { setUrl(event.target.value); setError(""); }}
            placeholder="https://arxiv.org/abs/2301.00001"
            autoFocus
          />
          {!lockInterest && (
            <div className="space-y-1">
              <label className="ml-1 block text-xs font-medium text-ink-tertiary">关联研究主题（可选）</label>
              <Select
                value={interestId}
                onChange={setInterestId}
                options={buildInterestOptions(interests, "不关联")}
              />
            </div>
          )}
          {error && <p className="ml-1 text-xs text-apple-red">{error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>
            取消
          </Button>
          <Button type="button" loading={loading} disabled={!url.trim()} onClick={() => void handleClip()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {loading ? "抓取中…" : "保存为笔记"}
          </Button>
        </div>
      </div>
    </div>
  );
}

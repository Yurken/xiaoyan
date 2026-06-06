import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Trash2, X, ZoomIn } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { experimentApi, formatErrorMessage, type ExperimentAttachment } from "../../lib/client";

const nmInset = "var(--rc-inset-shadow)";

function Lightbox({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={label} className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
        {label && <p className="mt-2 text-center text-xs text-white/70">{label}</p>}
        <button type="button" onClick={onClose}
          className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ExperimentAttachmentPanel({ experimentId, onError }: { experimentId: string; onError: (message: string) => void }) {
  const [attachments, setAttachments] = useState<ExperimentAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<ExperimentAttachment | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");

  useEffect(() => {
    experimentApi.attachments.list(experimentId).then((res) => setAttachments(res.attachments)).catch(() => {});
  }, [experimentId]);

  async function handleUpload() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const file = await open({ multiple: false, filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }] });
    if (!file) return;
    const filePath = typeof file === "string" ? file : (file as { path: string }).path;
    setUploading(true);
    try {
      const att = await experimentApi.attachments.add(experimentId, filePath);
      setAttachments((prev) => [...prev, att]);
    } catch (err) { onError(formatErrorMessage(err)); }
    finally { setUploading(false); }
  }

  async function handleDelete(id: string) {
    try {
      await experimentApi.attachments.delete(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) { onError(formatErrorMessage(err)); }
  }

  async function handleLabelCommit(id: string, nextLabel: string) {
    const normalized = nextLabel.trim();
    const current = attachments.find((a) => a.id === id);
    if (current && current.label === normalized) { setEditingLabel(null); return; }
    try {
      await experimentApi.attachments.updateLabel(id, normalized);
      setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, label: normalized } : a)));
    } catch (err) { onError(formatErrorMessage(err)); }
    finally { setEditingLabel(null); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-primary">截图 / 附件</p>
        <Button variant="ghost" size="sm" onClick={handleUpload} disabled={uploading}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          {uploading ? "上传中…" : "上传"}
        </Button>
      </div>
      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl py-8 text-center cursor-pointer"
          style={{ background: "var(--rc-surface)", boxShadow: nmInset }} onClick={handleUpload}>
          <ImagePlus className="w-8 h-8 text-ink-tertiary" />
          <p className="text-xs text-ink-tertiary">点击上传实验结果图或截图</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((att) => (
            <div key={att.id} className="relative group rounded-2xl overflow-hidden"
              style={{ aspectRatio: "4/3", background: "var(--rc-surface)", boxShadow: nmInset }}>
              <img src={att.dataUrl} alt={att.label || "附件"} className="w-full h-full object-cover cursor-zoom-in"
                onClick={() => setLightbox(att)} />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button type="button" onClick={() => setLightbox(att)}
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-ink-primary hover:bg-white">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => handleDelete(att.id)}
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-apple-red hover:bg-white">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 pt-4 bg-gradient-to-t from-black/50 to-transparent">
                {editingLabel === att.id ? (
                  <input autoFocus type="text" value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)}
                    onBlur={() => { void handleLabelCommit(att.id, labelDraft); }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingLabel(null); }}
                    className="w-full bg-transparent text-white text-xs outline-none border-b border-white/50"
                    onClick={(e) => e.stopPropagation()} />
                ) : (
                  <p className="text-[11px] text-white/90 truncate cursor-text"
                    onClick={(e) => { e.stopPropagation(); setEditingLabel(att.id); setLabelDraft(att.label); }}>
                    {att.label || <span className="text-white/40">点击添加描述</span>}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {lightbox && <Lightbox src={lightbox.dataUrl} label={lightbox.label} onClose={() => setLightbox(null)} />}
    </div>
  );
}

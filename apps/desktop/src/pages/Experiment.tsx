import { useEffect, useRef, useState } from "react";
import {
  FlaskConical,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import { Button, Card, Input, Select, Textarea } from "@research-copilot/ui";
import { experimentApi, submissionApi, formatErrorMessage, type ExperimentAttachment } from "../lib/client";

interface ExperimentRecord {
  id: string;
  title: string;
  config: Record<string, unknown>;
  result: string;
  notes: string;
  linkedSubmissionId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SubmissionItem {
  id: string;
  title: string;
}

function rowToExperiment(row: unknown): ExperimentRecord {
  const r = row as Record<string, unknown>;
  let config: Record<string, unknown> = {};
  try {
    config = typeof r.config === "string"
      ? JSON.parse(r.config)
      : (r.config as Record<string, unknown>) ?? {};
  } catch {}
  return {
    id: String(r.id ?? ""),
    title: String(r.title ?? ""),
    config,
    result: String(r.result ?? ""),
    notes: String(r.notes ?? ""),
    linkedSubmissionId: r.linkedSubmissionId ? String(r.linkedSubmissionId) : null,
    createdAt: String(r.createdAt ?? r.created_at ?? ""),
    updatedAt: String(r.updatedAt ?? r.updated_at ?? ""),
  };
}

const nmInset = "var(--rc-inset-shadow)";
const nmInsetFocus = "inset 3px 3px 7px #C0C5CB, inset -3px -3px 7px #FFFFFF, 0 0 0 2px rgba(0,122,255,0.25)";

/** Lightbox for viewing an attachment at full size */
function Lightbox({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={label} className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
        {label && (
          <p className="mt-2 text-center text-xs text-white/70">{label}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** Attachment grid for one experiment */
function AttachmentPanel({ experimentId }: { experimentId: string }) {
  const [attachments, setAttachments] = useState<ExperimentAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<ExperimentAttachment | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");

  useEffect(() => {
    experimentApi.attachments.list(experimentId).then((res) => {
      setAttachments(res.attachments);
    }).catch(() => {});
  }, [experimentId]);

  async function handleUpload() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const file = await open({
      multiple: false,
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
    });
    if (!file) return;
    const filePath = typeof file === "string" ? file : (file as { path: string }).path;
    setUploading(true);
    try {
      const att = await experimentApi.attachments.add(experimentId, filePath);
      setAttachments((prev) => [...prev, att]);
    } catch (err) {
      alert(formatErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await experimentApi.attachments.delete(id);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleLabelCommit(id: string, nextLabel: string) {
    const normalized = nextLabel.trim();
    const current = attachments.find((a) => a.id === id);
    if (current && current.label === normalized) {
      setEditingLabel(null);
      return;
    }
    try {
      await experimentApi.attachments.updateLabel(id, normalized);
      setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, label: normalized } : a)));
    } catch (err) {
      alert(formatErrorMessage(err));
    } finally {
      setEditingLabel(null);
    }
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
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl py-8 text-center cursor-pointer transition-shadow duration-150"
          style={{ background: "var(--rc-surface)", boxShadow: nmInset }}
          onClick={handleUpload}
        >
          <ImagePlus className="w-8 h-8 text-ink-tertiary" />
          <p className="text-xs text-ink-tertiary">点击上传实验结果图或截图</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative group rounded-2xl overflow-hidden"
              style={{ aspectRatio: "4/3", background: "var(--rc-surface)", boxShadow: nmInset }}
            >
              <img
                src={att.dataUrl}
                alt={att.label || "附件"}
                className="w-full h-full object-cover cursor-zoom-in"
                onClick={() => setLightbox(att)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setLightbox(att)}
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-ink-primary hover:bg-white transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(att.id)}
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-apple-red hover:bg-white transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 pt-4 bg-gradient-to-t from-black/50 to-transparent">
                {editingLabel === att.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    onBlur={() => { void handleLabelCommit(att.id, labelDraft); }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingLabel(null); }}
                    className="w-full bg-transparent text-white text-xs outline-none border-b border-white/50"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p
                    className="text-[11px] text-white/90 truncate cursor-text"
                    onClick={(e) => { e.stopPropagation(); setEditingLabel(att.id); setLabelDraft(att.label); }}
                  >
                    {att.label || <span className="text-white/40">点击添加描述</span>}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <Lightbox src={lightbox.dataUrl} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

export default function Experiment() {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editConfig, setEditConfig] = useState("{}");
  const [editResult, setEditResult] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLinked, setEditLinked] = useState("");
  const [configError, setConfigError] = useState("");

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const selected = experiments.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    Promise.all([
      experimentApi.list(),
      submissionApi.list(),
    ]).then(([expResult, subResult]) => {
      const expRaw = (expResult as { experiments: unknown[] }).experiments ?? [];
      setExperiments(expRaw.map(rowToExperiment));
      const subRaw = ((subResult as { submissions?: unknown[] }).submissions ?? []) as Record<string, unknown>[];
      setSubmissions(subRaw.map((s) => ({ id: String(s.id ?? ""), title: String(s.title ?? "") })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) {
      setEditTitle(""); setEditConfig("{}"); setEditResult(""); setEditNotes(""); setEditLinked(""); setConfigError("");
      return;
    }
    setEditTitle(selected.title);
    setEditConfig(JSON.stringify(selected.config, null, 2));
    setEditResult(selected.result);
    setEditNotes(selected.notes);
    setEditLinked(selected.linkedSubmissionId ?? "");
    setConfigError("");
  }, [selectedId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await experimentApi.create({ title: "新实验记录" });
      const newExp: ExperimentRecord = {
        id: res.id, title: "新实验记录", config: {}, result: "", notes: "",
        linkedSubmissionId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      setExperiments((prev) => [newExp, ...prev]);
      setSelectedId(res.id);
      setNewlyCreatedId(res.id);
      setTimeout(() => titleInputRef.current?.select(), 50);
    } catch (err) {
      showToast(formatErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (!selectedId) return;
    let parsedConfig: Record<string, unknown> = {};
    try {
      parsedConfig = JSON.parse(editConfig);
      setConfigError("");
    } catch {
      setConfigError("JSON 格式错误，请检查配置内容");
      return;
    }
    setSaving(true);
    try {
      await experimentApi.update(selectedId, {
        title: editTitle, config: parsedConfig, result: editResult,
        notes: editNotes, linkedSubmissionId: editLinked || undefined,
      });
      setExperiments((prev) => prev.map((e) => e.id === selectedId
        ? { ...e, title: editTitle, config: parsedConfig, result: editResult, notes: editNotes, linkedSubmissionId: editLinked || null, updatedAt: new Date().toISOString() }
        : e
      ));
      setNewlyCreatedId(null);
      showToast("已保存");
    } catch (err) {
      showToast(formatErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await experimentApi.delete(id);
      setExperiments((prev) => prev.filter((e) => e.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-5 pb-5 border-b border-nm-dark/10">
          <h1 className="text-2xl font-bold text-ink-primary">实验记录</h1>
          <p className="mt-1 text-sm text-ink-tertiary">记录实验配置与结果，上传截图，关联投稿同步进度。</p>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: list */}
          <div className="w-60 flex-shrink-0 flex flex-col overflow-hidden border-r border-nm-dark/20">
            {/* New button */}
            <div className="p-3 flex-shrink-0 border-b border-nm-dark/10">
              <Button
                variant="secondary"
                onClick={handleCreate}
                disabled={creating}
                className="w-full"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                新建记录
              </Button>
            </div>
            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {loading ? (
                <div className="flex justify-center pt-10"><Loader2 className="w-5 h-5 animate-spin text-ink-tertiary" /></div>
              ) : experiments.length === 0 ? (
                <p className="text-xs text-ink-tertiary text-center pt-10 px-2">暂无记录，点击上方「新建」开始。</p>
              ) : (
                experiments.map((exp) => (
                  <button
                    key={exp.id}
                    type="button"
                    onClick={() => setSelectedId(exp.id)}
                    className="w-full text-left rounded-2xl px-3 py-2.5 transition-all duration-150 group"
                    style={
                      selectedId === exp.id
                        ? { background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)", borderLeft: "3px solid #007AFF" }
                        : { background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)" }
                    }
                    onMouseEnter={(e) => {
                      if (exp.id !== selectedId) {
                        e.currentTarget.style.boxShadow = "var(--rc-inset-shadow)";
                        e.currentTarget.style.background = "var(--rc-card-inset-bg)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (exp.id !== selectedId) {
                        e.currentTarget.style.boxShadow = "var(--rc-chip-shadow)";
                        e.currentTarget.style.background = "var(--rc-surface)";
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-semibold text-ink-primary truncate leading-5">{exp.title}</p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void handleDelete(exp.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-tertiary hover:text-apple-red flex-shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-ink-secondary mt-0.5">
                      {new Date(exp.updatedAt).toLocaleDateString("zh-CN")}
                    </p>
                    {exp.linkedSubmissionId && (
                      <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}>
                        <Link2 className="w-2.5 h-2.5" />
                        已关联投稿
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-y-auto p-5">
            {!selected ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto" style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}>
                    <FlaskConical className="w-7 h-7 text-ink-tertiary/50" />
                  </div>
                  <p className="text-sm text-ink-tertiary">从左侧选择记录，或新建一条</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-2xl mx-auto pb-6">
                {/* Actions */}
                <div className="flex justify-end gap-2">
                  {newlyCreatedId === selected.id && (
                    <Button
                      variant="secondary"
                      onClick={() => { void handleDelete(selected.id); setNewlyCreatedId(null); }}
                    >
                      <X className="w-4 h-4" />
                      取消
                    </Button>
                  )}
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    保存
                  </Button>
                </div>

                {/* Title */}
                <Input
                  label="标题"
                  ref={titleInputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="实验名称"
                />

                {/* Linked submission */}
                <Select
                  label="关联投稿（可选）"
                  value={editLinked}
                  onChange={setEditLinked}
                  options={[
                    { value: "", label: "— 不关联 —" },
                    ...submissions.map((submission) => ({ value: submission.id, label: submission.title })),
                  ]}
                />

                {/* Config JSON */}
                <Card variant="inset" padding="sm" className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink-primary">实验配置</p>
                    <p className="text-[10px] text-ink-tertiary">JSON 格式，保存超参数、路径等信息</p>
                  </div>
                  <Textarea
                    value={editConfig}
                    onChange={(e) => { setEditConfig(e.target.value); setConfigError(""); }}
                    rows={7}
                    error={configError}
                    placeholder={'{\n  "lr": 0.001,\n  "epochs": 100,\n  "batch_size": 32\n}'}
                    style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: "12px" }}
                  />
                </Card>

                {/* Result */}
                <Card variant="inset" padding="sm" className="space-y-2">
                  <p className="text-xs font-semibold text-ink-primary">实验结果</p>
                  <Textarea
                    value={editResult}
                    onChange={(e) => setEditResult(e.target.value)}
                    rows={5}
                    placeholder="记录实验指标、对比分析、图表说明…"
                  />
                </Card>

                {/* Screenshots */}
                <Card variant="inset" padding="sm">
                  <AttachmentPanel experimentId={selected.id} />
                </Card>

                {/* Notes */}
                <Card variant="inset" padding="sm" className="space-y-2">
                  <p className="text-xs font-semibold text-ink-primary">备注与分析</p>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                    placeholder="分析实验现象、后续改进计划、与其他实验的对比…"
                  />
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl text-sm font-medium text-white pointer-events-none z-50"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlaskConical,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button, ConfirmDialog, Input } from "@research-copilot/ui";
import type { ExperimentRecord, ExperimentCodeSession } from "@research-copilot/types";
import { experimentApi, formatErrorMessage } from "../lib/client";
import { useDomainEventRefresh } from "../hooks/useDomainEventRefresh";
import { ExperimentCodeWorkspace } from "../features/experiment/ExperimentCodeWorkspace";
import { ExperimentSnapshotPanel } from "../features/experiment/ExperimentSnapshotPanel";

type ExperimentTab = "code" | "snapshots";

function rowToExperiment(row: unknown): ExperimentRecord {
  const r = row as Record<string, unknown>;
  let config: Record<string, unknown> = {};
  try {
    config = typeof r.config === "string"
      ? JSON.parse(r.config)
      : (r.config as Record<string, unknown>) ?? {};
  } catch (err) { console.warn("Failed to parse experiment config:", err); }
  return {
    id: String(r.id ?? ""),
    title: String(r.title ?? ""),
    config,
    result: String(r.result ?? ""),
    notes: String(r.notes ?? ""),
    linkedSubmissionId: r.linkedSubmissionId ? String(r.linkedSubmissionId) : null,
    defaultWorkingDir: r.defaultWorkingDir ? String(r.defaultWorkingDir) : null,
    createdAt: String(r.createdAt ?? r.created_at ?? ""),
    updatedAt: String(r.updatedAt ?? r.updated_at ?? ""),
  };
}

export default function Experiment() {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [activeTab, setActiveTab] = useState<ExperimentTab>("code");
  const [activeCodeSession, setActiveCodeSession] = useState<ExperimentCodeSession | null>(null);

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const selected = experiments.find((e) => e.id === selectedId) ?? null;

  const loadExperiments = useCallback(async () => {
    try {
      const expResult = await experimentApi.list();
      const expRaw = (expResult as { experiments: unknown[] }).experiments ?? [];
      setExperiments(expRaw.map(rowToExperiment));
    } catch {
      // keep existing data on refresh failure
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadExperiments().finally(() => setLoading(false));
  }, [loadExperiments]);

  useDomainEventRefresh("experiment:created", () => { loadExperiments(); });

  useEffect(() => {
    if (!selected) {
      setEditTitle("");
      return;
    }
    setEditTitle(selected.title);
  }, [selected]);

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
        linkedSubmissionId: null, defaultWorkingDir: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      setExperiments((prev) => [newExp, ...prev]);
      setSelectedId(res.id);
      setNewlyCreatedId(res.id);
      setActiveTab("code");
      setTimeout(() => titleInputRef.current?.select(), 50);
    } catch (err) {
      showToast(formatErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveTitle() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await experimentApi.update(selectedId, { title: editTitle });
      setExperiments((prev) => prev.map((e) => e.id === selectedId
        ? { ...e, title: editTitle, updatedAt: new Date().toISOString() }
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

  function requestDelete(id: string) {
    setPendingDeleteId(id);
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    try {
      setDeleting(true);
      await experimentApi.delete(pendingDeleteId);
      setExperiments((prev) => prev.filter((e) => e.id !== pendingDeleteId));
      if (selectedId === pendingDeleteId) setSelectedId(null);
      if (newlyCreatedId === pendingDeleteId) setNewlyCreatedId(null);
      setPendingDeleteId(null);
    } catch (err) {
      showToast(formatErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-nm-dark/10 app-header">
          <h1 className="text-2xl font-bold text-ink-primary">实验记录</h1>
          <p className="mt-1 text-sm text-ink-tertiary">代码调试与快照封存一体化，小妍帮你追踪实验脉络。</p>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden max-lg:flex-col">
          {/* Left: list */}
          <div className="w-60 flex-shrink-0 flex flex-col overflow-hidden border-r border-nm-dark/20 max-lg:h-52 max-lg:w-full max-lg:border-r-0 max-lg:border-b">
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
            <div className="flex-1 overflow-y-auto p-3 space-y-1 max-lg:grid max-lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] max-lg:gap-2 max-lg:space-y-0">
              {loading ? (
                <div className="flex justify-center pt-10"><Loader2 className="w-5 h-5 animate-spin text-ink-tertiary" /></div>
              ) : experiments.length === 0 ? (
                <p className="text-xs text-ink-tertiary text-center pt-10 px-2">暂无记录，点击上方「新建」开始。</p>
              ) : (
                experiments.map((exp) => (
                  <div
                    key={exp.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(exp.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(exp.id); } }}
                    className="w-full text-left rounded-2xl px-3 py-2.5 transition-all duration-150 group cursor-pointer"
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
                        onClick={(e) => { e.stopPropagation(); requestDelete(exp.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-tertiary hover:text-apple-red flex-shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-ink-secondary mt-0.5">
                      {new Date(exp.updatedAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex h-full items-center justify-center p-5">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto" style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}>
                    <FlaskConical className="w-7 h-7 text-ink-tertiary/50" />
                  </div>
                  <p className="text-sm text-ink-tertiary">从左侧选择记录，或新建一条</p>
                </div>
              </div>
            ) : (
              <>
                {/* Title + segmented tabs */}
                <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 pt-4 pb-3 border-b border-nm-dark/10 max-lg:px-4">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <Input
                      ref={titleInputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="实验名称"
                      className="flex-1"
                    />
                    <Button onClick={handleSaveTitle} disabled={saving} variant="secondary" className="flex-shrink-0">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </div>

                  {/* Segmented control */}
                  <div
                    className="flex-shrink-0 inline-flex items-center p-1 rounded-2xl"
                    style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}
                  >
                    {[
                      { key: "code", label: "代码" },
                      { key: "snapshots", label: "快照" },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key as ExperimentTab)}
                        className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                          activeTab === tab.key
                            ? "bg-white text-ink-primary shadow-sm"
                            : "text-ink-tertiary hover:text-ink-primary"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {activeTab === "code" && (
                    <div className="h-full p-2">
                      <ExperimentCodeWorkspace
                        experimentId={selected.id}
                        onActiveSessionChange={setActiveCodeSession}
                      />
                    </div>
                  )}

                  {activeTab === "snapshots" && (
                    <div className="h-full overflow-y-auto p-5 max-lg:p-4">
                      <ExperimentSnapshotPanel
                        experimentId={selected.id}
                        activeSession={activeCodeSession}
                        onError={showToast}
                      />
                    </div>
                  )}
                </div>
              </>
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

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="删除实验记录"
        description={`确认删除「${experiments.find((item) => item.id === pendingDeleteId)?.title ?? "该实验记录"}」？此操作无法撤销。`}
        confirmLabel="确认删除"
        cancelLabel="取消"
        tone="danger"
        loading={deleting}
        onClose={() => {
          if (!deleting) setPendingDeleteId(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </div>
  );
}

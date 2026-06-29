import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@research-copilot/ui";
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

interface ExperimentProps {
  experimentId?: string;
}

export default function Experiment({ experimentId }: ExperimentProps) {
  const [experiment, setExperiment] = useState<ExperimentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [activeTab, setActiveTab] = useState<ExperimentTab>("code");
  const [activeCodeSession, setActiveCodeSession] = useState<ExperimentCodeSession | null>(null);

  const loadExperiment = useCallback(async () => {
    try {
      if (experimentId) {
        const result = await experimentApi.get(experimentId);
        setExperiment(rowToExperiment(result));
      } else {
        const result = await experimentApi.list();
        const experiments = (result.experiments ?? []).map(rowToExperiment);
        setExperiment(experiments[0] ?? null);
      }
    } catch {
      // keep existing data on refresh failure
    }
  }, [experimentId]);

  useEffect(() => {
    setLoading(true);
    loadExperiment().finally(() => setLoading(false));
  }, [loadExperiment]);

  useDomainEventRefresh("experiment:created", () => { loadExperiment(); });

  useEffect(() => {
    setEditTitle(experiment?.title ?? "");
  }, [experiment]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function handleSaveTitle(nextTitle: string) {
    if (!experiment || nextTitle === experiment.title) return;
    try {
      await experimentApi.update(experiment.id, { title: nextTitle });
      setExperiment((prev) => prev ? { ...prev, title: nextTitle, updatedAt: new Date().toISOString() } : null);
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-nm-dark/10 app-header">
        <h1 className="text-2xl font-bold text-ink-primary">实验记录</h1>
        <p className="mt-1 text-sm text-ink-tertiary">代码调试与快照封存一体化，小妍帮你追踪实验脉络。</p>
      </div>

      {/* Main workspace */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-ink-tertiary" />
          </div>
        ) : !experiment ? (
          <div className="flex h-full items-center justify-center p-5">
            <div className="text-center space-y-2">
              <p className="text-sm text-ink-tertiary">暂无实验记录</p>
            </div>
          </div>
        ) : (
          <>
            {/* Title + segmented tabs */}
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 pt-4 pb-3 border-b border-nm-dark/10 max-lg:px-4">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => handleSaveTitle(editTitle)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="实验名称"
                className="flex-1"
              />

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
                    experimentId={experiment.id}
                    onActiveSessionChange={setActiveCodeSession}
                  />
                </div>
              )}

              {activeTab === "snapshots" && (
                <div className="h-full overflow-y-auto p-5 max-lg:p-4">
                  <ExperimentSnapshotPanel
                    experimentId={experiment.id}
                    activeSession={activeCodeSession}
                    onError={showToast}
                  />
                </div>
              )}
            </div>
          </>
        )}
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

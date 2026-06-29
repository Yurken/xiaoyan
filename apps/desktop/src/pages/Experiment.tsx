import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ExperimentRecord, ExperimentCodeSession } from "@research-copilot/types";
import { experimentApi } from "../lib/client";
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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      {/* Header + horizontal segmented tabs */}
      <div className="app-header flex-shrink-0 px-6 pb-3 border-b border-nm-dark/10">
        <div
          className="inline-flex rounded-2xl border p-1"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.52))" }}
        >
          {([
            { key: "code", label: "代码" },
            { key: "snapshots", label: "快照" },
          ] as const).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                data-testid={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
                style={active
                  ? {
                      background: "var(--rc-button-secondary-bg)",
                      boxShadow: "var(--rc-button-secondary-shadow)",
                      color: "var(--rc-text)",
                    }
                  : {
                      color: "var(--rc-text-muted)",
                    }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 min-h-0 overflow-hidden">
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
          <div className="h-full overflow-hidden">
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

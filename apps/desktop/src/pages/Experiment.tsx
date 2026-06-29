import { useCallback, useEffect, useState } from "react";
import { Loader2, FolderOpen } from "lucide-react";
import { usePersistentState } from "../hooks/usePersistentStringState";
import type { ExperimentRecord, ExperimentCodeSession } from "@research-copilot/types";
import { experimentApi } from "../lib/client";
import { useDomainEventRefresh } from "../hooks/useDomainEventRefresh";
import { ExperimentCodeWorkspace } from "../features/experiment/ExperimentCodeWorkspace";
import { ExperimentSnapshotPanel } from "../features/experiment/ExperimentSnapshotPanel";
import { ExperimentRecordPanel } from "../features/experiment/ExperimentRecordPanel";

type ExperimentTab = "code" | "snapshots" | "records";

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
  const [workingDir, setWorkingDir] = usePersistentState<string | null>(
    experimentId ? `rc:experiment:${experimentId}:code:working-dir` : "rc:experiment:code:working-dir",
    null,
  );

  const loadExperiment = useCallback(async () => {
    try {
      let record: ExperimentRecord | null = null;
      if (experimentId) {
        record = rowToExperiment(await experimentApi.get(experimentId));
      } else {
        const result = await experimentApi.list();
        record = (result.experiments ?? []).map(rowToExperiment)[0] ?? null;
      }
      setExperiment(record);
      if (!workingDir && record?.defaultWorkingDir) {
        setWorkingDir(record.defaultWorkingDir);
      }
    } catch {
      // keep existing data on refresh failure
    }
  }, [experimentId, workingDir, setWorkingDir]);

  useEffect(() => {
    setLoading(true);
    loadExperiment().finally(() => setLoading(false));
  }, [loadExperiment]);

  useDomainEventRefresh("experiment:created", () => { loadExperiment(); });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function chooseWorkingDir() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({ directory: true });
      if (picked && typeof picked === "string") {
        setWorkingDir(picked);
      }
    } catch {
      // ignore dialog errors
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      {/* Header + horizontal segmented tabs */}
      <div className="app-header flex items-center justify-between flex-shrink-0 px-6 pb-3 border-b border-nm-dark/10">
        <div
          className="inline-flex rounded-2xl border p-1"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.52))" }}
        >
          {([
            { key: "code", label: "代码" },
            { key: "snapshots", label: "快照" },
            { key: "records", label: "记录" },
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

        {activeTab === "code" && (
          <button
            type="button"
            className="experiment-header-dir"
            onClick={chooseWorkingDir}
            title={workingDir ?? "选择工作目录"}
            aria-label="选择工作目录"
          >
            <FolderOpen size={12} />
            <span>{workingDir ?? "选择目录"}</span>
          </button>
        )}
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
                  workingDir={workingDir}
                  onWorkingDirChange={setWorkingDir}
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

            {activeTab === "records" && (
              <div className="h-full overflow-hidden">
                <ExperimentRecordPanel onError={showToast} />
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

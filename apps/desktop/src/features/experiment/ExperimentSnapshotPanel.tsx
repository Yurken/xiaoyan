import { useCallback, useEffect, useState } from "react";
import { Camera, ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";
import type { ExperimentCodeSession, ExperimentSnapshot } from "@research-copilot/types";
import { Button, Card, ConfirmDialog } from "@research-copilot/ui";
import { experimentApi, formatErrorMessage } from "../../lib/client";

interface ExperimentSnapshotPanelProps {
  experimentId: string;
  activeSession: ExperimentCodeSession | null;
  onError: (message: string) => void;
}

export function ExperimentSnapshotPanel({ experimentId, activeSession, onError }: ExperimentSnapshotPanelProps) {
  const [snapshots, setSnapshots] = useState<ExperimentSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    try {
      const result = await experimentApi.snapshots.list(experimentId);
      setSnapshots(result.snapshots ?? []);
    } catch (err) {
      console.warn("Failed to load snapshots:", err);
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    setLoading(true);
    void loadSnapshots();
  }, [loadSnapshots]);

  async function handleCreate() {
    setCreating(true);
    try {
      const snapshot = await experimentApi.snapshots.create(experimentId, {
        title: `快照 ${new Date().toLocaleString("zh-CN")}`,
        codeSessionId: activeSession?.id,
        toolId: activeSession?.tool_id ?? undefined,
        model: activeSession?.model ?? undefined,
        workingDir: activeSession?.working_dir ?? undefined,
      });
      setSnapshots((prev) => [snapshot, ...prev]);
    } catch (err) {
      onError(formatErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await experimentApi.snapshots.delete(id);
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-primary">快照</p>
          <p className="text-xs text-ink-tertiary mt-0.5">手动封存实验配置、结果、备注与当前代码会话状态。</p>
        </div>
        <Button onClick={handleCreate} disabled={creating} variant="secondary">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          创建快照
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-ink-tertiary" />
        </div>
      ) : snapshots.length === 0 ? (
        <Card variant="inset" padding="md" className="text-center">
          <p className="text-sm text-ink-secondary">暂无快照</p>
          <p className="text-xs text-ink-tertiary mt-1">点击右上角创建，保存当前实验状态。</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snapshot) => (
            <Card key={snapshot.id} variant="inset" padding="sm" className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleExpand(snapshot.id)}
                  className="flex-1 text-left flex items-center gap-2"
                >
                  {expandedId === snapshot.id ? (
                    <ChevronDown className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-primary truncate">{snapshot.title}</p>
                    <p className="text-[11px] text-ink-tertiary">
                      {new Date(snapshot.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(snapshot.id)}
                  className="text-ink-tertiary hover:text-apple-red transition-colors p-1"
                  aria-label="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {expandedId === snapshot.id && (
                <div className="pl-6 space-y-3 text-xs">
                  {snapshot.codeSessionId && (
                    <p className="text-ink-secondary">
                      <span className="font-medium">代码会话：</span>
                      {snapshot.codeSessionId}
                    </p>
                  )}
                  {(snapshot.toolId || snapshot.model) && (
                    <p className="text-ink-secondary">
                      <span className="font-medium">工具 / 模型：</span>
                      {[snapshot.toolId, snapshot.model].filter(Boolean).join(" / ")}
                    </p>
                  )}
                  {snapshot.workingDir && (
                    <p className="text-ink-secondary">
                      <span className="font-medium">工作目录：</span>
                      {snapshot.workingDir}
                    </p>
                  )}

                  <div>
                    <p className="font-medium text-ink-primary mb-1">配置</p>
                    <pre className="p-2 rounded-lg bg-black/5 overflow-auto" style={{ maxHeight: 160 }}>
                      {JSON.stringify(snapshot.configSnapshot, null, 2)}
                    </pre>
                  </div>

                  {snapshot.resultSnapshot && (
                    <div>
                      <p className="font-medium text-ink-primary mb-1">结果</p>
                      <pre className="p-2 rounded-lg bg-black/5 whitespace-pre-wrap" style={{ maxHeight: 160, overflow: "auto" }}>
                        {snapshot.resultSnapshot}
                      </pre>
                    </div>
                  )}

                  {snapshot.notesSnapshot && (
                    <div>
                      <p className="font-medium text-ink-primary mb-1">备注</p>
                      <pre className="p-2 rounded-lg bg-black/5 whitespace-pre-wrap" style={{ maxHeight: 160, overflow: "auto" }}>
                        {snapshot.notesSnapshot}
                      </pre>
                    </div>
                  )}

                  {Object.keys(snapshot.envSnapshot).length > 0 && (
                    <div>
                      <p className="font-medium text-ink-primary mb-1">环境变量</p>
                      <pre className="p-2 rounded-lg bg-black/5 overflow-auto" style={{ maxHeight: 120 }}>
                        {JSON.stringify(snapshot.envSnapshot, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="删除快照"
        description="确认删除该快照？此操作无法撤销。"
        confirmLabel="确认删除"
        cancelLabel="取消"
        tone="danger"
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) void handleDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}

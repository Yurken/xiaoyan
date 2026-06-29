import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpDown,
  Camera,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ExperimentCodeSession, ExperimentSnapshot } from "@research-copilot/types";
import { Button, Card, ConfirmDialog } from "@research-copilot/ui";
import { experimentApi, formatErrorMessage } from "../../lib/client";
import { useSnapshotCompare } from "./useSnapshotCompare";
import { ExperimentSnapshotCompare } from "./ExperimentSnapshotCompare";
import { ExperimentSnapshotCard } from "./ExperimentSnapshotCard";
import { exportSnapshotAsJson } from "./shared";

interface ExperimentSnapshotPanelProps {
  experimentId: string;
  activeSession: ExperimentCodeSession | null;
  onError: (message: string) => void;
}

type SortOrder = "newest" | "oldest";

export function ExperimentSnapshotPanel({ experimentId, activeSession, onError }: ExperimentSnapshotPanelProps) {
  // ── Data ─────────────────────────────────────────────────────
  const [snapshots, setSnapshots] = useState<ExperimentSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // ── Search & sort ───────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // ── Multi-select ─────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // ── Pending delete ───────────────────────────────────────────
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Expand detail ────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Compare ──────────────────────────────────────────────────
  const compare = useSnapshotCompare({ snapshots });

  // ── Load ─────────────────────────────────────────────────────
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

  // ── Filtered & sorted ────────────────────────────────────────
  const filteredSnapshots = useMemo(() => {
    let list = snapshots;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          JSON.stringify(s.configSnapshot).toLowerCase().includes(q) ||
          (s.resultSnapshot ?? "").toLowerCase().includes(q) ||
          (s.notesSnapshot ?? "").toLowerCase().includes(q),
      );
    }
    // Snapshots come from backend newest-first. For oldest-first, reverse.
    if (sortOrder === "oldest") {
      list = [...list].reverse();
    }
    return list;
  }, [snapshots, searchQuery, sortOrder]);

  // ── Create ───────────────────────────────────────────────────
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

  // ── Delete ───────────────────────────────────────────────────
  async function executeDelete(ids: string[]) {
    setDeleting(true);
    let failed = 0;
    for (const id of ids) {
      try {
        await experimentApi.snapshots.delete(id);
        setSnapshots((prev) => prev.filter((s) => s.id !== id));
        if (expandedId === id) setExpandedId(null);
      } catch {
        failed++;
      }
    }
    if (failed > 0) onError(`${failed} 个快照删除失败`);
    setSelectedIds(new Set());
    setSelectMode(false);
    setPendingDeleteIds(null);
    setDeleting(false);
  }

  function requestDelete(ids: string[]) {
    setPendingDeleteIds(ids);
  }

  // ── Select / compare ─────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setSelectMode(false);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function enterSelectMode() { setSelectMode(true); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds(new Set()); }

  function handleCompareClick() {
    const ids = Array.from(selectedIds);
    if (ids.length >= 2) {
      compare.toggleCompare(ids[0]);
      compare.toggleCompare(ids[1]);
      setSelectMode(false);
      setSelectedIds(new Set());
    }
  }

  function handleCardCompareToggle(id: string) {
    compare.toggleCompare(id);
  }

  // ── Export ───────────────────────────────────────────────────
  function handleExport(snapshot: ExperimentSnapshot) {
    const json = exportSnapshotAsJson(snapshot);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${snapshot.title || "snapshot"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const selectedArray = Array.from(selectedIds);
  const selectAllChecked = filteredSnapshots.length > 0 && filteredSnapshots.every((s) => selectedIds.has(s.id));

  function toggleSelectAll() {
    if (selectAllChecked) {
      setSelectedIds(new Set());
      setSelectMode(false);
    } else {
      setSelectedIds(new Set(filteredSnapshots.map((s) => s.id)));
    }
  }

  // ── Compare mode: full-screen compare view ───────────────────
  if (compare.isComparing && compare.leftSnapshot && compare.rightSnapshot && compare.diffResult) {
    return (
      <div className="h-full flex flex-col overflow-hidden" style={{ background: "var(--rc-surface)" }}>
        <ExperimentSnapshotCompare
          leftSnapshot={compare.leftSnapshot}
          rightSnapshot={compare.rightSnapshot}
          diffResult={compare.diffResult}
          activeDimension={compare.activeDimension}
          onDimensionChange={compare.setActiveDimension}
          onClose={compare.clearCompare}
          onExportLeft={compare.exportLeft}
          onExportRight={compare.exportRight}
        />
      </div>
    );
  }

  // ── Default: list view ───────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Top row: title + count + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-primary">快照</h2>
            {!loading && snapshots.length > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold"
                style={{ background: "var(--rc-accent-alpha, rgba(0,122,255,0.10))", color: "var(--rc-accent, #007AFF)" }}
              >
                {snapshots.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-ink-secondary hover:text-ink-primary transition-colors px-2 py-1"
                >
                  {selectAllChecked ? "取消全选" : "全选"}
                </button>
                {selectedIds.size >= 2 && (
                  <Button onClick={handleCompareClick} variant="secondary" size="sm">
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    对比 ({selectedIds.size})
                  </Button>
                )}
                {selectedIds.size > 0 && (
                  <Button
                    onClick={() => requestDelete(selectedArray)}
                    variant="secondary"
                    size="sm"
                    style={{ color: "var(--rc-apple-red, #FF3B30)" }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除 ({selectedIds.size})
                  </Button>
                )}
                <button
                  type="button"
                  onClick={exitSelectMode}
                  className="p-1.5 rounded-xl text-ink-tertiary hover:text-ink-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                {snapshots.length > 0 && !selectMode && (
              <button
                type="button"
                onClick={enterSelectMode}
                className="text-xs font-medium text-ink-tertiary hover:text-ink-primary hover:bg-nm-dark/10 transition-colors px-2.5 py-1 rounded-xl"
              >
                选择
              </button>
            )}
                <Button onClick={handleCreate} disabled={creating} variant="secondary" size="sm">
                  {creating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  创建快照
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search + sort bar — always visible when there's data or search active */}
        {(snapshots.length > 0 || searchQuery) && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索快照标题、配置、结果…"
                className="w-full pl-9 pr-8 py-2 rounded-2xl text-xs outline-none transition-colors"
                style={{
                  borderColor: "var(--rc-control-border)",
                  background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.52))",
                  color: "var(--rc-text)",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {snapshots.length > 1 && !selectMode && (
              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))}
                className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-medium transition-colors ${
                  sortOrder === "oldest"
                    ? "text-ink-primary"
                    : "text-ink-tertiary hover:text-ink-secondary"
                }`}
                style={
                  sortOrder === "oldest"
                    ? { background: "var(--rc-button-secondary-bg)", boxShadow: "var(--rc-button-secondary-shadow)" }
                    : { borderColor: "var(--rc-control-border)", borderWidth: 1, borderStyle: "solid" }
                }
                title={sortOrder === "newest" ? "最新在前" : "最早在前"}
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortOrder === "newest" ? "最新" : "最早"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Compare bar ──────────────────────────────────────── */}
      {compare.compareLeftId && !compare.isComparing && (
        <Card variant="inset" padding="sm" className="flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <ArrowLeftRight className="w-3.5 h-3.5 text-ink-tertiary flex-shrink-0" />
            <span className="text-ink-secondary truncate">
              对比基准：<span className="font-medium text-ink-primary">{compare.leftSnapshot?.title}</span>
            </span>
            <span className="text-ink-tertiary flex-shrink-0">— 点击另一快照完成对比</span>
          </div>
          <button
            type="button"
            onClick={compare.clearCompare}
            className="flex-shrink-0 p-1 text-ink-tertiary hover:text-ink-primary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </Card>
      )}

      {/* ── List ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-ink-tertiary" />
        </div>
      ) : filteredSnapshots.length === 0 ? (
        <Card variant="inset" padding="md" className="text-center py-10">
          {searchQuery ? (
            <>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--rc-card-inset-bg)" }}>
                <Search className="w-5 h-5 text-ink-tertiary/50" />
              </div>
              <p className="text-sm text-ink-secondary">无匹配快照</p>
              <p className="text-xs text-ink-tertiary mt-1">试试其他关键词。</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}>
                <Camera className="w-5 h-5 text-ink-tertiary/50" />
              </div>
              <p className="text-sm text-ink-secondary">暂无快照</p>
              <p className="text-xs text-ink-tertiary mt-1 mb-4">保存当前实验状态，记录配置与结果。</p>
              <Button onClick={handleCreate} disabled={creating} variant="secondary" size="sm">
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                创建第一个快照
              </Button>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredSnapshots.map((snapshot) => (
            <ExperimentSnapshotCard
              key={snapshot.id}
              snapshot={snapshot}
              isSelected={selectedIds.has(snapshot.id)}
              isCompareTarget={compare.compareLeftId === snapshot.id}
              isExpanded={expandedId === snapshot.id}
              selectMode={selectMode}
              onToggleSelect={toggleSelect}
              onToggleExpand={toggleExpand}
              onCompare={handleCardCompareToggle}
              onExport={handleExport}
              onDelete={(id) => requestDelete([id])}
            />
          ))}
        </div>
      )}

      {/* ── Delete confirm ───────────────────────────────────── */}
      <ConfirmDialog
        open={pendingDeleteIds !== null}
        title="删除快照"
        description={
          pendingDeleteIds && pendingDeleteIds.length > 1
            ? `确认删除 ${pendingDeleteIds.length} 个快照？此操作无法撤销。`
            : "确认删除该快照？此操作无法撤销。"
        }
        confirmLabel="确认删除"
        cancelLabel="取消"
        tone="danger"
        loading={deleting}
        onClose={() => { if (!deleting) setPendingDeleteIds(null); }}
        onConfirm={() => { if (pendingDeleteIds) void executeDelete(pendingDeleteIds); }}
      />
    </div>
  );
}

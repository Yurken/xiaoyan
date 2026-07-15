import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpDown,
  Camera,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ExperimentCodeSession, ExperimentSnapshot } from "@research-copilot/types";
import { Badge, Button, Card, ConfirmDialog } from "@research-copilot/ui";
import RenameSavedEntryModal from "../../components/RenameSavedEntryModal";
import { useSnapshotCompare } from "./useSnapshotCompare";
import { useExperimentSnapshots } from "./useExperimentSnapshots";
import { ExperimentSnapshotCompare } from "./ExperimentSnapshotCompare";
import { ExperimentSnapshotCard } from "./ExperimentSnapshotCard";
import { ExperimentSnapshotCreateModal } from "./ExperimentSnapshotCreateModal";
import { exportSnapshotAsJson } from "./shared";

interface ExperimentSnapshotPanelProps {
  experimentId: string;
  experimentTitle: string;
  activeSession: ExperimentCodeSession | null;
  workingDir: string | null;
  onError: (message: string) => void;
  onNotify?: (message: string) => void;
  onRestored?: () => void | Promise<void>;
}

type SortOrder = "newest" | "oldest";

export function ExperimentSnapshotPanel({
  experimentId,
  experimentTitle,
  activeSession,
  workingDir,
  onError,
  onNotify,
  onRestored,
}: ExperimentSnapshotPanelProps) {
  const snapshotData = useExperimentSnapshots({
    experimentId,
    activeSession,
    workingDir,
    onError,
    onRestored,
  });
  const { snapshots, loading, loadError, creating, deleting, renamingId, restoring } = snapshotData;
  const [createOpen, setCreateOpen] = useState(false);
  const [renamingSnapshot, setRenamingSnapshot] = useState<ExperimentSnapshot | null>(null);

  // ── Search & sort ───────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // ── Multi-select ─────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // ── Pending delete ───────────────────────────────────────────
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);

  // ── Expand detail ────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Compare ──────────────────────────────────────────────────
  const compare = useSnapshotCompare({ snapshots });

  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const searchIndex = useMemo(() => new Map(
    snapshots.map((snapshot) => [
      snapshot.id,
      [
        snapshot.title,
        JSON.stringify(snapshot.configSnapshot),
        snapshot.resultSnapshot ?? "",
        snapshot.notesSnapshot ?? "",
        JSON.stringify(snapshot.envSnapshot),
        snapshot.workingDir ?? "",
        snapshot.model ?? "",
      ].join(" ").toLowerCase(),
    ]),
  ), [snapshots]);

  // ── Filtered & sorted ────────────────────────────────────────
  const filteredSnapshots = useMemo(() => {
    let list = snapshots;
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      list = list.filter((snapshot) => searchIndex.get(snapshot.id)?.includes(q) ?? false);
    }
    // Snapshots come from backend newest-first. For oldest-first, reverse.
    if (sortOrder === "oldest") {
      list = [...list].reverse();
    }
    return list;
  }, [snapshots, debouncedQuery, searchIndex, sortOrder]);

  // ── Create ───────────────────────────────────────────────────
  async function handleCreate(title: string) {
    const created = await snapshotData.createSnapshot(title);
    if (created) onNotify?.("快照已创建");
    return created;
  }

  // ── Delete ───────────────────────────────────────────────────
  async function executeDelete(ids: string[]) {
    const failedIds = await snapshotData.deleteSnapshots(ids);
    const failed = new Set(failedIds);
    setSelectedIds(failed);
    setSelectMode(failed.size > 0);
    if (expandedId && ids.includes(expandedId) && !failed.has(expandedId)) setExpandedId(null);
    setPendingDeleteIds(null);
  }

  function requestDelete(ids: string[]) {
    setPendingDeleteIds(ids);
  }

  async function executeRestore(id: string) {
    if (await snapshotData.restoreSnapshot(id)) {
      setPendingRestoreId(null);
      onNotify?.("实验记录已恢复，并已自动备份恢复前内容");
    }
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
    const orderedIds = filteredSnapshots.filter((snapshot) => selectedIds.has(snapshot.id)).map((snapshot) => snapshot.id);
    if (orderedIds.length === 2) {
      compare.startCompare(orderedIds[0], orderedIds[1]);
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
      <Card variant="raised" padding="md" className="space-y-3">
        {/* Top row: title + count + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-primary">快照</h2>
            <Badge variant="warning" className="uppercase tracking-wider">Beta</Badge>
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
                  className="text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors px-2.5 py-1.5 rounded-xl"
                  style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
                >
                  {selectAllChecked ? "取消全选" : "全选"}
                </button>
                {selectedIds.size >= 2 && (
                  <Button onClick={handleCompareClick} disabled={selectedIds.size !== 2} variant="secondary" size="sm">
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    {selectedIds.size === 2 ? "对比" : "仅可对比 2 个"}
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
                  className="p-1.5 rounded-xl text-ink-tertiary hover:text-ink-primary transition-all active:scale-95"
                  style={{ background: "var(--rc-icon-button-bg)", border: "1px solid var(--rc-icon-button-border)", boxShadow: "var(--rc-icon-button-shadow)" }}
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
                    className="text-xs font-medium text-ink-tertiary hover:text-ink-primary transition-all active:scale-95 px-2.5 py-1.5 rounded-xl"
                    style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
                  >
                    选择
                  </button>
                )}
                <Button onClick={() => setCreateOpen(true)} disabled={creating} variant="secondary" size="sm">
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
                className="w-full pl-9 pr-8 py-2 rounded-2xl text-xs outline-none transition-all"
                style={{
                  border: "1px solid var(--rc-control-border)",
                  background: "var(--rc-control-bg)",
                  color: "var(--rc-text)",
                  boxShadow: "var(--rc-control-shadow)",
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
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-medium transition-all active:scale-95"
                style={
                  sortOrder === "oldest"
                    ? { background: "var(--rc-button-secondary-bg)", boxShadow: "var(--rc-button-secondary-shadow)", color: "var(--rc-text)" }
                    : { background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)", color: "var(--rc-text-muted)" }
                }
                title={sortOrder === "newest" ? "最新在前" : "最早在前"}
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortOrder === "newest" ? "最新" : "最早"}
              </button>
            )}
          </div>
        )}
      </Card>

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
      ) : loadError ? (
        <Card variant="inset" padding="md" className="text-center py-10">
          <AlertTriangle className="w-5 h-5 mx-auto text-ink-tertiary" />
          <p className="mt-3 text-sm font-medium text-ink-secondary">快照加载失败</p>
          <p className="mt-1 text-xs text-ink-tertiary">{loadError}</p>
          <Button onClick={() => void snapshotData.reload()} variant="secondary" size="sm" className="mt-4">
            <RefreshCw className="w-3.5 h-3.5" />
            重试
          </Button>
        </Card>
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
              <Button onClick={() => setCreateOpen(true)} disabled={creating} variant="secondary" size="sm">
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
              onRename={setRenamingSnapshot}
              onRestore={setPendingRestoreId}
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

      <ConfirmDialog
        open={pendingRestoreId !== null}
        title="恢复实验记录"
        description="将用此快照覆盖当前实验的配置、结果和备注。系统会先自动创建一份恢复前备份；代码文件不会被改动。"
        confirmLabel="恢复记录"
        cancelLabel="取消"
        loading={restoring}
        onClose={() => { if (!restoring) setPendingRestoreId(null); }}
        onConfirm={() => { if (pendingRestoreId) void executeRestore(pendingRestoreId); }}
      />

      <ExperimentSnapshotCreateModal
        open={createOpen}
        experimentTitle={experimentTitle}
        capturesCodeState={Boolean(workingDir ?? activeSession?.working_dir)}
        creating={creating}
        onClose={() => { if (!creating) setCreateOpen(false); }}
        onCreate={handleCreate}
      />

      <RenameSavedEntryModal
        open={renamingSnapshot !== null}
        title="重命名实验快照"
        description="只修改快照名称，已保存的配置、结果、备注和代码状态不会改变。"
        label="快照名称"
        initialValue={renamingSnapshot?.title ?? ""}
        placeholder="例如：最佳验证集结果"
        busy={renamingSnapshot !== null && renamingId === renamingSnapshot.id}
        onClose={() => {
          if (!renamingId) setRenamingSnapshot(null);
        }}
        onRename={async (title) => {
          if (!renamingSnapshot) return false;
          const renamed = await snapshotData.renameSnapshot(renamingSnapshot.id, title);
          if (renamed) onNotify?.(`快照已重命名为“${title.trim()}”`);
          return renamed;
        }}
      />
    </div>
  );
}

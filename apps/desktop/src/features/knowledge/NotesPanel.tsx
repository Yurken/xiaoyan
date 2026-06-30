import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckSquare, Download, Globe, LayoutGrid, List, Loader2, Plus, Search, StickyNote, Trash2, X } from "lucide-react";
import { Badge, Button, CapsuleTabs, Card, ConfirmDialog, Input } from "@research-copilot/ui";
import CollapsibleGroup from "../../components/CollapsibleGroup";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { useKnowledgeNotesWorkspace } from "./useKnowledgeNotesWorkspace";
import { useNotesExport } from "./useNotesExport";
import { interestFolderName } from "../../lib/interestUtils";
import NoteCard from "./NoteCard";
import NoteListItem from "./NoteListItem";
import WebClipDialog from "./WebClipDialog";
import NoteImportZip from "./NoteImportZip";
import { sourceLabel } from "./notesShared";

export default function NotesPanel({
  hideFolders = false,
  researchInterestId,
  initialNotes,
  initialInterests,
  linkedNoteClaimCounts,
  onNotesChanged,
}: {
  hideFolders?: boolean;
  researchInterestId?: string;
  initialNotes?: KnowledgeNote[];
  initialInterests?: ResearchInterest[];
  linkedNoteClaimCounts?: Record<string, number>;
  onNotesChanged?: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const {
    interests,
    search,
    setSearch,
    loading,
    error,
    clearError,
    interestMap,
    scopedNotes,
    noteGroups,
    ungroupedNotes,
    deleteNote,
    deleteInterestGroup,
    clipWebPage,
    importZip,
  } = useKnowledgeNotesWorkspace({
    researchInterestId,
    initialNotes,
    initialInterests,
    onNotesChanged,
  });
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [pendingDeleteNote, setPendingDeleteNote] = useState<KnowledgeNote | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);
  const [showWebClip, setShowWebClip] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { exporting, exportError, clearExportError, exportMarkdown } = useNotesExport();

  const handleConfirmDeleteNote = async () => {
    if (!pendingDeleteNote) return;
    setDeletingNote(true);
    try {
      await deleteNote(pendingDeleteNote.id);
      setPendingDeleteNote(null);
    } catch {
      // Error state is handled in the workspace hook.
    } finally {
      setDeletingNote(false);
    }
  };

  const handleDeleteInterestGroup = async (interestId: string, deleteAll: boolean) => {
    try {
      setDeletingGroupId(interestId);
      await deleteInterestGroup(interestId, deleteAll);
      setConfirmDeleteGroupId(null);
    } catch {
      // Error state is handled in the workspace hook.
    } finally {
      setDeletingGroupId(null);
    }
  };

  const useFlatList = hideFolders || researchInterestId != null;
  const hasGraphCoverage = linkedNoteClaimCounts != null;
  const linkedVisibleNoteCount = useMemo(
    () => {
      if (!linkedNoteClaimCounts) return 0;
      return scopedNotes.filter((note) => (linkedNoteClaimCounts[note.id] ?? 0) > 0).length;
    },
    [linkedNoteClaimCounts, scopedNotes],
  );

  const sourceTabs = useMemo(() => {
    const present = Array.from(new Set(scopedNotes.map((note) => note.source_type)));
    if (present.length <= 1) return [];
    return [
      { value: "all", label: "全部" },
      ...present.map((source) => ({ value: source, label: sourceLabel(source) })),
    ];
  }, [scopedNotes]);
  const activeSource = sourceTabs.some((tab) => tab.value === sourceFilter) ? sourceFilter : "all";
  const bySource = (note: KnowledgeNote) => activeSource === "all" || note.source_type === activeSource;

  const visibleNotes = scopedNotes.filter(bySource);
  const selectedNotes = visibleNotes.filter((note) => selectedIds.has(note.id));
  const allVisibleSelected = visibleNotes.length > 0 && selectedNotes.length === visibleNotes.length;

  const toggleSelect = (note: KnowledgeNote) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(note.id)) next.delete(note.id);
      else next.add(note.id);
      return next;
    });
  };

  const enterSelection = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
    setShowWebClip(false);
    clearError();
    clearExportError();
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    clearExportError();
  };

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleNotes.map((note) => note.id)));
  };

  const handleExportSelected = async () => {
    const ok = await exportMarkdown(selectedNotes, interestMap);
    if (ok) exitSelection();
  };

  const renderNoteCard = (note: KnowledgeNote) => (
    <NoteCard
      key={note.id}
      note={note}
      linkedClaimCount={linkedNoteClaimCounts?.[note.id] ?? 0}
      interestName={note.research_interest_id && interestMap[note.research_interest_id]
        ? interestFolderName(interestMap[note.research_interest_id])
        : undefined}
      onDelete={setPendingDeleteNote}
      selectionMode={selectionMode}
      selected={selectedIds.has(note.id)}
      onToggleSelect={toggleSelect}
    />
  );

  const renderNoteListItem = (note: KnowledgeNote) => (
    <NoteListItem
      key={note.id}
      note={note}
      linkedClaimCount={linkedNoteClaimCounts?.[note.id] ?? 0}
      interestName={note.research_interest_id && interestMap[note.research_interest_id]
        ? interestFolderName(interestMap[note.research_interest_id])
        : undefined}
      onDelete={setPendingDeleteNote}
      selectionMode={selectionMode}
      selected={selectedIds.has(note.id)}
      onToggleSelect={toggleSelect}
    />
  );

  const renderNotes = (notes: KnowledgeNote[]) =>
    viewMode === "list" ? (
      <div className="space-y-2">{notes.map(renderNoteListItem)}</div>
    ) : (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{notes.map(renderNoteCard)}</div>
    );

  return (
    <>
    <div className="space-y-4">
      <Card padding="sm" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary">知识卡片库</p>
            <p className="mt-1 text-xs leading-5 text-ink-tertiary">
              支持语义搜索、标签归档，并可把笔记关联到具体研究主题。
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {researchInterestId ? <Badge variant="default">已按研究主题聚焦</Badge> : null}
              {hasGraphCoverage && scopedNotes.length > 0 ? (
                <Badge variant={linkedVisibleNoteCount > 0 ? "info" : "default"}>
                  图谱关联 {linkedVisibleNoteCount}/{scopedNotes.length}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:max-w-[680px] lg:flex-row">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="请输入关键词搜索笔记、术语或方法"
                className="pl-10"
              />
            </div>
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === "card" ? "list" : "card"))}
              className="flex items-center justify-center rounded-xl px-2.5 py-1.5 text-ink-tertiary transition-colors hover:bg-white/50 hover:text-ink-primary"
              title={viewMode === "card" ? "切换为列表视图" : "切换为卡片视图"}
            >
              {viewMode === "card" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </button>
            {selectionMode ? (
              <Button size="sm" variant="secondary" onClick={exitSelection}>
                <X className="h-4 w-4" />
                退出选择
              </Button>
            ) : (
              <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={enterSelection} disabled={scopedNotes.length === 0}>
                  <CheckSquare className="h-4 w-4" />
                  选择
                </Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  clearError();
                  setShowWebClip(true);
                }}>
                  <Globe className="h-4 w-4" />
                  剪辑网页
                </Button>
                <NoteImportZip
                  interests={interests}
                  researchInterestId={researchInterestId}
                  onImport={importZip}
                />
                <Button size="sm" onClick={() => {
                  clearError();
                  navigate("/notes/new", { state: { researchInterestId } });
                }}>
                  <Plus className="h-4 w-4" />
                  新建笔记
                </Button>
              </div>
            )}
          </div>
        </div>

        {selectionMode && (
          <div className="flex flex-col gap-2 rounded-2xl border border-apple-blue/20 bg-apple-blue/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-ink-secondary">
              <span>已选 <span className="font-semibold text-apple-blue">{selectedNotes.length}</span> / {visibleNotes.length} 条</span>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={visibleNotes.length === 0}
                className="text-xs font-medium text-apple-blue transition-colors hover:text-apple-blue/80 disabled:opacity-40"
              >
                {allVisibleSelected ? "清空" : "全选"}
              </button>
              {exportError && <span className="text-xs text-apple-red">{exportError}</span>}
            </div>
            <Button
              size="sm"
              loading={exporting}
              disabled={selectedNotes.length === 0}
              onClick={() => void handleExportSelected()}
            >
              <Download className="h-4 w-4" />
              导出 Markdown{selectedNotes.length > 0 ? `（${selectedNotes.length}）` : ""}
            </Button>
          </div>
        )}

        {sourceTabs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-tertiary">来源</span>
            <CapsuleTabs compact options={sourceTabs} value={activeSource} onChange={setSourceFilter} />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-apple-blue" />
        </div>
      ) : (researchInterestId != null ? scopedNotes.length === 0 : scopedNotes.length === 0 && interests.length === 0) ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          >
            <StickyNote className="h-7 w-7 text-ink-tertiary" />
          </div>
          <div>
            <p className="font-medium text-ink-secondary">{search ? "未找到相关笔记" : "暂无笔记"}</p>
            <p className="mt-1 text-sm text-ink-tertiary">
              {search ? "换个关键词试试。" : "可手动创建，后续也适合沉淀论文分析和综述结果。"}
            </p>
          </div>
        </Card>
      ) : useFlatList ? (
        renderNotes(scopedNotes.filter(bySource))
      ) : (
        <div className="space-y-4">
          {noteGroups
            .map((group) => ({ ...group, notes: group.notes.filter(bySource) }))
            .filter((group) => activeSource === "all" || group.notes.length > 0)
            .map((group) => (
            <CollapsibleGroup
              key={group.key}
              title={group.title}
              subtitle={group.subtitle !== group.title ? `研究主题：${group.subtitle}` : undefined}
              countLabel={`${group.notes.length} 条`}
              defaultOpen={group.notes.length > 0}
              actions={
                confirmDeleteGroupId === group.key ? (
                  <>
                    <span className="text-xs text-ink-tertiary">删除文件夹：</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={deletingGroupId === group.key}
                      onClick={() => void handleDeleteInterestGroup(group.key, false)}
                    >
                      置为未归档
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={deletingGroupId === group.key}
                      onClick={() => void handleDeleteInterestGroup(group.key, true)}
                    >
                      删除全部
                    </Button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteGroupId(null)}
                      className="text-ink-tertiary hover:text-ink-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteGroupId(group.key)}
                    className="text-ink-tertiary/40 transition-colors hover:text-apple-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )
              }
            >
              {group.notes.length === 0 ? (
                <Card padding="sm" className="border border-dashed border-nm-dark/10 bg-white/25 py-8 text-center text-sm text-ink-tertiary">
                  该主题下暂无知识卡片。
                </Card>
              ) : (
                renderNotes(group.notes)
              )}
            </CollapsibleGroup>
          ))}

          {ungroupedNotes.filter(bySource).length > 0 && (
            <section className="space-y-3">
              <div className="px-1">
                <p className="text-sm font-semibold text-ink-primary">未归档笔记</p>
                <p className="mt-1 text-xs text-ink-tertiary">这些笔记暂未绑定主题，可直接编辑并移动到研究主题。</p>
              </div>
              {renderNotes(ungroupedNotes.filter(bySource))}
            </section>
          )}
        </div>
      )}
    </div>

    <ConfirmDialog
      open={pendingDeleteNote != null}
      title="删除知识卡片"
      description={pendingDeleteNote ? `确认删除「${pendingDeleteNote.title}」？此操作不可撤销。` : ""}
      confirmLabel="删除"
      tone="danger"
      loading={deletingNote}
      onConfirm={() => void handleConfirmDeleteNote()}
      onClose={() => { if (!deletingNote) setPendingDeleteNote(null); }}
    />

    {showWebClip && (
      <WebClipDialog
        interests={interests}
        defaultInterestId={researchInterestId ?? ""}
        lockInterest={researchInterestId != null}
        onClip={clipWebPage}
        onClipped={(note) => { setShowWebClip(false); navigate(`/notes/${note.id}`, { state: { note } }); }}
        onClose={() => setShowWebClip(false)}
      />
    )}
    </>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Eye, FlaskConical, FolderOpen, Loader2, NotebookPen, Pencil, Quote, RotateCw, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { Badge, Button, Card, Input, Select } from "@research-copilot/ui";
import type { KnowledgeNote, Paper, ResearchInterest } from "@research-copilot/types";
import {
  CasQuartileBadge,
  CasTopBadge,
  CcfRatingBadge,
  JcrQuartileBadge,
  VenueTypeBadge,
  WosIndexBadge,
} from "../../components/CcfBadges";
import PaperCitationPanel from "./PaperCitationPanel";
import PaperNoteViewerModal from "./PaperNoteViewerModal";
import PaperTaskProgressPanel from "./PaperTaskProgressPanel";
import type { PaperTaskProgress } from "./shared";
import type { FolderSelectOption } from "./interestTree";
import type { PaperDnd } from "./usePaperDnd";
import { apiClient } from "../../lib/client";
import NoteEditorModal, { type NoteDraft } from "../knowledge/NoteEditorModal";

const IMPORTANCE_OPTIONS = [
  { color: "", label: "无" },
  { color: "#FF3B30", label: "极其重要" },
  { color: "#FF9500", label: "非常重要" },
  { color: "#FFCC00", label: "重要" },
  { color: "#34C759", label: "较重要" },
  { color: "#007AFF", label: "一般" },
  { color: "#AF52DE", label: "不重要" },
];

interface PaperCardProps {
  paper: Paper;
  groupKey: string;
  folderOptions: FolderSelectOption[];
  detailPaperId: string | null;
  deletingPaperId: string | null;
  savingEdit: boolean;
  taskProgress?: PaperTaskProgress;
  draggable: boolean;
  dnd: PaperDnd;
  interests: ResearchInterest[];
  interestMap: Record<string, ResearchInterest>;
  paperNote?: KnowledgeNote;
  onAnalyze: (id: string) => void;
  onReproduce: (id: string) => void;
  onReparse: (id: string) => void;
  onUpdatePaper: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  onDeletePaper: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  onGenerateNote?: (paper: Paper) => Promise<KnowledgeNote>;
  onCreateNote?: (paper: Paper, draft: NoteDraft) => Promise<KnowledgeNote>;
}

function statusBadge(status: string) {
  if (status === "analyzed" || status === "reproduced") return null;
  if (status === "failed" || status === "error") return <Badge variant="danger">失败</Badge>;
  if (status === "analyzing") return <Badge variant="info">分析中</Badge>;
  if (status === "parsing") return <Badge variant="info">解析中</Badge>;
  if (status === "parsed") return <Badge variant="info">已解析</Badge>;
  return <Badge variant="default">待分析</Badge>;
}

const canStartAnalyze = (status: string) => !["analyzing", "parsing", "uploaded"].includes(status);
const requiresReanalyzeConfirm = (p: Paper) => p.status === "analyzed" || p.status === "reproduced";

export default function PaperCard({
  paper,
  groupKey,
  folderOptions,
  detailPaperId,
  deletingPaperId,
  savingEdit,
  taskProgress,
  draggable,
  dnd,
  interests,
  interestMap,
  paperNote,
  onAnalyze,
  onReproduce,
  onReparse,
  onUpdatePaper,
  onDeletePaper,
  onOpenDetail,
  onCloseDetail,
  onGenerateNote,
  onCreateNote,
}: PaperCardProps) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReanalyze, setConfirmReanalyze] = useState(false);
  const [citationOpen, setCitationOpen] = useState(false);
  const [noteOptionsOpen, setNoteOptionsOpen] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteViewerOpen, setNoteViewerOpen] = useState(false);
  const [generatingNote, setGeneratingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [localNote, setLocalNote] = useState<KnowledgeNote | undefined>(paperNote);
  const [noteToast, setNoteToast] = useState<{ message: string; noteId?: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [editDraft, setEditDraft] = useState({
    title: "", authors: "", venue: "", year: "", doi: "",
    research_interest_id: "", importance_color: "", notes: "",
    tags: [] as string[],
  });

  // 右键菜单：点击其它位置、滚动或按 Esc 时关闭。
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const openEditor = () => {
    setEditing(true);
    setTagInput("");
    setEditDraft({
      title: paper.title || "", authors: paper.authors || "",
      venue: paper.venue || "", year: paper.year ? String(paper.year) : "",
      doi: paper.doi || "", research_interest_id: paper.research_interest_id || "",
      importance_color: paper.importance_color || "", notes: paper.notes || "",
      tags: paper.tags ? [...paper.tags] : [],
    });
  };

  // 把当前输入框里的内容收成一个标签，忽略大小写去重，最多 16 个。
  const commitTagInput = () => {
    const next = tagInput.trim();
    if (!next) return;
    setEditDraft((prev) => {
      if (prev.tags.length >= 16) return prev;
      if (prev.tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) return prev;
      return { ...prev, tags: [...prev.tags, next] };
    });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setEditDraft((prev) => ({ ...prev, tags: prev.tags.filter((item) => item !== tag) }));
  };

  const handleSaveEdit = async () => {
    const nextTitle = editDraft.title.trim();
    if (!nextTitle) throw new Error("论文标题不能为空");
    const yearText = editDraft.year.trim();
    if (yearText && !/^\d{4}$/.test(yearText)) throw new Error("年份需填写 4 位数字");
    // 提交前把还没回车的输入内容也并入标签
    const pending = tagInput.trim();
    const tags = pending && !editDraft.tags.some((tag) => tag.toLowerCase() === pending.toLowerCase())
      ? [...editDraft.tags, pending]
      : editDraft.tags;
    await onUpdatePaper(paper.id, {
      title: nextTitle, authors: editDraft.authors.trim(),
      venue: editDraft.venue.trim(), year: yearText ? Number.parseInt(yearText, 10) : 0,
      doi: editDraft.doi.trim(), research_interest_id: editDraft.research_interest_id,
      importance_color: editDraft.importance_color, notes: editDraft.notes,
      tags,
    });
    setEditing(false);
    setTagInput("");
  };

  const editTitleError = editing && !editDraft.title.trim() ? "标题不能为空" : "";
  const editYearText = editDraft.year.trim();
  const editYearError = editing && editYearText && !/^\d{4}$/.test(editYearText) ? "年份需填写 4 位数字" : "";

  useEffect(() => {
    setLocalNote(paperNote);
  }, [paperNote]);

  const canDrag = draggable && !editing;
  const insertion = dnd.dragInsertion(paper.id);

  function showNoteToast(message: string, noteId?: string) {
    setNoteToast({ message, noteId });
    setTimeout(() => setNoteToast(null), 3000);
  }

  const openNoteUI = () => {
    if (localNote) {
      setNoteViewerOpen(true);
    } else {
      setNoteOptionsOpen(true);
    }
  };

  const handleGenerateNote = async () => {
    if (!onGenerateNote || generatingNote) return;
    setNoteOptionsOpen(false);
    setGeneratingNote(true);
    try {
      const note = await onGenerateNote(paper);
      setLocalNote(note);
      setNoteViewerOpen(true);
      showNoteToast("小妍已生成笔记", note.id);
    } catch {
      showNoteToast("生成笔记失败");
    } finally {
      setGeneratingNote(false);
    }
  };

  const handleOpenManualEditor = () => {
    setNoteOptionsOpen(false);
    setNoteEditorOpen(true);
  };

  const handleSaveManualNote = async (draft: NoteDraft) => {
    if (!onCreateNote || savingNote) throw new Error("无法保存");
    setSavingNote(true);
    try {
      const note = await onCreateNote(paper, draft);
      setLocalNote(note);
      setNoteEditorOpen(false);
      setNoteViewerOpen(true);
      showNoteToast("已保存到知识笔记", note.id);
      return note;
    } catch (error) {
      showNoteToast("保存笔记失败");
      throw error;
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <Card
      padding="sm"
      className={clsx(
        "relative",
        canDrag && "cursor-grab active:cursor-grabbing",
        dnd.isDragging(paper.id) && "opacity-50",
      )}
      style={{ borderTop: paper.importance_color ? `3px solid ${paper.importance_color}` : undefined }}
      draggable={canDrag}
      {...dnd.cardDragProps(paper.id, groupKey)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {insertion && (
        <div className={clsx(
          "pointer-events-none absolute left-3 right-3 h-0.5 rounded-full bg-[var(--rc-accent)]",
          insertion === "before" ? "-top-1.5" : "-bottom-1.5",
        )} />
      )}
      <div className="flex min-w-0 flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-[18rem] text-sm">
          <div className="flex items-start gap-2">
            {paper.file_path ? (
              <button
                type="button"
                onClick={() => navigate(`/papers/${paper.id}/reader`)}
                className="min-w-0 text-left font-semibold text-ink-primary transition-colors hover:text-apple-blue hover:underline"
                title="打开批注阅读（高亮 / 下划线 / 翻译）"
              >
                {paper.title}
              </button>
            ) : (
              <span className="min-w-0 font-semibold text-ink-primary">{paper.title}</span>
            )}
            {statusBadge(paper.status)}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-tertiary">
            {paper.authors && <span>{paper.authors}</span>}
            {paper.year && <span>{paper.year}</span>}
            {paper.venue && <span className="text-apple-blue font-medium">{paper.venue}</span>}
            {paper.ccf_type && <VenueTypeBadge type={paper.ccf_type} />}
            {paper.wos_indexes
              ?.filter((index) => index && index !== "none")
              .map((index) => <WosIndexBadge key={index} index={index} />)}
            {paper.jcr_quartile && paper.jcr_quartile !== "N/A" && <JcrQuartileBadge quartile={paper.jcr_quartile} />}
            {paper.cas_quartile && paper.cas_quartile !== "N/A" && <CasQuartileBadge quartile={paper.cas_quartile} />}
            {paper.cas_top && <CasTopBadge top={paper.cas_top} />}
            {paper.ccf_rating && <CcfRatingBadge rating={paper.ccf_rating} />}
          </div>
          {paper.tags && paper.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {paper.tags.map((tag) => (
                <span key={tag} className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-ink-tertiary"
                  style={{ background: "var(--rc-chip-inset-bg)" }}>{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* 右上角操作：解读 / 复现 / 笔记 / 引用 / 详情；编辑·重解析·删除见右键菜单 */}
        <div className="ml-auto flex flex-shrink-0 items-center justify-end gap-1.5">
          <Button size="sm" onClick={() => {
            if (requiresReanalyzeConfirm(paper)) { setConfirmReanalyze((prev) => !prev); return; }
            onAnalyze(paper.id);
          }} disabled={!canStartAnalyze(paper.status)} className="h-8 whitespace-nowrap px-3" style={paper.status === "analyzed" || paper.status === "reproduced" ? { background: "#34C759", borderColor: "#34C759" } : undefined}>
            {paper.status === "analyzing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {paper.status === "analyzing" ? "分析中…" : paper.status === "parsing" ? "解析中…" : paper.status === "analyzed" || paper.status === "reproduced" ? "已解读" : "小妍解读"}
          </Button>
          <button type="button" onClick={() => onReproduce(paper.id)} disabled={!canStartAnalyze(paper.status)}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors disabled:opacity-40"
            style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)", color: "var(--rc-text-secondary)" }}
            title="生成复现/验证指南">
            <FlaskConical className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => openNoteUI()} disabled={generatingNote || (!localNote && !onGenerateNote && !onCreateNote)}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors disabled:opacity-40"
            style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)", color: localNote ? "#007AFF" : "var(--rc-text-secondary)" }}
            title={localNote ? "查看论文笔记" : "创建论文笔记"}>
            {generatingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : localNote ? <BookOpen className="h-4 w-4" /> : <NotebookPen className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setCitationOpen((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
            style={{ background: "var(--rc-surface)", boxShadow: citationOpen ? "var(--rc-inset-shadow)" : "var(--rc-chip-shadow)", color: citationOpen ? "#007AFF" : "var(--rc-text-secondary)" }}
            title="引用">
            <Quote className="h-4 w-4" />
          </button>
          {(paper.analysis || paper.reproduction_guide || ["parsed","failed","error"].includes(paper.status)) && (
            <button type="button" onClick={() => detailPaperId === paper.id ? onCloseDetail() : onOpenDetail(paper.id)}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
              style={{ background: "var(--rc-surface)", boxShadow: detailPaperId === paper.id ? "var(--rc-inset-shadow)" : "var(--rc-chip-shadow)", color: detailPaperId === paper.id ? "#007AFF" : "var(--rc-text-secondary)" }}
              title={detailPaperId === paper.id ? "关闭详情" : "查看详情"}>
              <Eye className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {paper.status === "analyzing" && taskProgress ? (
        <PaperTaskProgressPanel progress={taskProgress} />
      ) : null}

      {confirmDelete && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,59,48,0.06)" }}>
          <span className="text-xs text-apple-red">确认删除这篇论文？</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>取消</Button>
            <button type="button" onClick={() => { onDeletePaper(paper.id); setConfirmDelete(false); }}
              disabled={deletingPaperId === paper.id}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
              style={{ background: "#FF3B30" }}>
              {deletingPaperId === paper.id && <Loader2 className="h-3 w-3 animate-spin" />}删除
            </button>
          </div>
        </div>
      )}

      {confirmReanalyze && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,122,255,0.08)" }}>
          <span className="text-xs text-[#0A62D0]">已有解读结果，确认重新解读？</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setConfirmReanalyze(false)}>取消</Button>
            <button type="button" onClick={() => { onAnalyze(paper.id); setConfirmReanalyze(false); }}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-colors"
              style={{ background: "#007AFF" }}>确认重新解读</button>
          </div>
        </div>
      )}

      {citationOpen && <PaperCitationPanel paper={paper} onClose={() => setCitationOpen(false)} />}

      {editing && (
        <div className="mt-3 grid gap-3 border-t border-nm-dark/10 pt-3 md:grid-cols-2">
          <Input label="标题" value={editDraft.title} error={editTitleError}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="论文标题" />
          <Input label="作者" value={editDraft.authors}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, authors: e.target.value }))} placeholder="作者列表" />
          <Input label="来源" value={editDraft.venue}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, venue: e.target.value }))} placeholder="会议/期刊" />
          <Input label="年份" value={editDraft.year} error={editYearError}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, year: e.target.value }))} placeholder="2024" />
          <Select label="所属文件夹" value={editDraft.research_interest_id}
            onChange={(value) => setEditDraft((prev) => ({ ...prev, research_interest_id: value }))}
            options={[{ value: "", label: "未归档" }, ...folderOptions]} />
          <Input label="DOI" value={editDraft.doi}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, doi: e.target.value }))} placeholder="10.1145/xxxx" />
          <div className="md:col-span-2 space-y-1">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">重要性标记</label>
            <div className="flex items-center gap-2 flex-wrap">
              {IMPORTANCE_OPTIONS.map(({ color, label }) => (
                <button key={label} type="button" onClick={() => setEditDraft((prev) => ({ ...prev, importance_color: color }))}
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs transition-all"
                  style={{ background: editDraft.importance_color === color ? (color || "rgba(0,0,0,0.08)") : "var(--rc-surface)",
                    color: editDraft.importance_color === color && color ? "#fff" : "#666",
                    boxShadow: editDraft.importance_color === color ? "inset 1px 1px 3px rgba(0,0,0,0.2)" : "var(--rc-chip-shadow)",
                    fontWeight: editDraft.importance_color === color ? 600 : 400 }}>
                  {color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />}{label}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">标签</label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2"
              style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }}>
              {editDraft.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-ink-secondary"
                  style={{ background: "var(--rc-chip-inset-bg)" }}>
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)}
                    className="text-ink-tertiary/60 transition-colors hover:text-apple-red" aria-label={`移除标签 ${tag}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input type="text" value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitTagInput(); }
                  else if (e.key === "Backspace" && !tagInput && editDraft.tags.length > 0) {
                    removeTag(editDraft.tags[editDraft.tags.length - 1]);
                  }
                }}
                onBlur={commitTagInput}
                placeholder={editDraft.tags.length >= 16 ? "最多 16 个标签" : "输入后回车添加标签"}
                disabled={editDraft.tags.length >= 16}
                className="min-w-[120px] flex-1 bg-transparent text-sm text-ink-primary outline-none placeholder:text-ink-tertiary/60" />
            </div>
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">备注</label>
            <textarea value={editDraft.notes} onChange={(e) => setEditDraft((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="添加备注" rows={2}
              className="w-full resize-none rounded-2xl px-4 py-2.5 text-sm text-ink-primary outline-none"
              style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }} />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>取消</Button>
            <Button size="sm" onClick={() => void handleSaveEdit()} loading={savingEdit} disabled={Boolean(editTitleError || editYearError)}>保存</Button>
          </div>
        </div>
      )}

      {paper.notes && !editing && (
        <p className="mt-2 border-t border-black/5 pt-2 text-[11px] leading-relaxed text-ink-tertiary/80">{paper.notes}</p>
      )}

      {noteToast && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,122,255,0.08)" }}>
          <span className="text-xs text-[#0A62D0]">{noteToast.message}</span>
          {noteToast.noteId && (
            <button
              type="button"
              onClick={() => { setNoteToast(null); navigate("/knowledge"); }}
              className="text-xs font-medium text-[#007AFF] transition-colors hover:underline"
            >
              查看
            </button>
          )}
        </div>
      )}


      {noteOptionsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(23, 25, 29, 0.32)", backdropFilter: "blur(6px)" }}
          onClick={(event) => { if (event.target === event.currentTarget) setNoteOptionsOpen(false); }}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-[24px] border p-6"
            style={{ background: "var(--rc-surface)", borderColor: "var(--rc-border)", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}
          >
            <div>
              <h3 className="text-base font-semibold text-ink-primary">创建论文笔记</h3>
              <p className="mt-1 text-xs text-ink-tertiary">选择一种方式记录这篇论文的要点。</p>
            </div>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => void handleGenerateNote()}
                disabled={generatingNote || !onGenerateNote}
                className="flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-black/[0.02] disabled:opacity-50"
                style={{ borderColor: "var(--rc-border)" }}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(0,122,255,0.1)" }}>
                  {generatingNote ? <Loader2 className="h-5 w-5 animate-spin text-apple-blue" /> : <NotebookPen className="h-5 w-5 text-apple-blue" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-primary">让小妍做笔记</p>
                  <p className="text-xs text-ink-tertiary">基于论文内容与解读自动生成结构化笔记</p>
                </div>
              </button>
              <button
                type="button"
                onClick={handleOpenManualEditor}
                disabled={!onCreateNote}
                className="flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-black/[0.02] disabled:opacity-50"
                style={{ borderColor: "var(--rc-border)" }}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(175,82,222,0.1)" }}>
                  <Pencil className="h-5 w-5" style={{ color: "#AF52DE" }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-primary">自己整理笔记</p>
                  <p className="text-xs text-ink-tertiary">打开编辑器，按自己的思路整理要点</p>
                </div>
              </button>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setNoteOptionsOpen(false)}>取消</Button>
            </div>
          </div>
        </div>
      )}

      {noteEditorOpen && (
        <NoteEditorModal
          note={null}
          defaultInterestId={paper.research_interest_id ?? ""}
          interests={interests}
          interestMap={interestMap}
          onClose={() => setNoteEditorOpen(false)}
          onCreate={handleSaveManualNote}
        />
      )}

      {noteViewerOpen && localNote && (
        <PaperNoteViewerModal
          note={localNote}
          interestMap={interestMap}
          onClose={() => setNoteViewerOpen(false)}
          onOpenInKnowledge={() => { setNoteViewerOpen(false); navigate("/knowledge"); }}
        />
      )}
      {menu && (
        <div
          className="fixed z-[60] min-w-[160px] overflow-hidden rounded-xl py-1"
          style={{
            left: Math.min(menu.x, window.innerWidth - 180),
            top: Math.min(menu.y, window.innerHeight - 150),
            background: "var(--rc-surface)",
            boxShadow: "0 12px 36px rgba(15,23,42,0.2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-black/5"
            onClick={() => { openEditor(); setMenu(null); }}>
            <Pencil className="h-3.5 w-3.5" />编辑
          </button>
          {paper.file_path && (
            <button type="button"
              disabled={["parsing", "analyzing"].includes(paper.status)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-black/5 disabled:opacity-40"
              onClick={() => { onReparse(paper.id); setMenu(null); }}>
              <RotateCw className="h-3.5 w-3.5" />重新解析
            </button>
          )}
          {paper.file_path && (
            <button type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-black/5"
              onClick={() => { void apiClient.papers.revealInFolder(paper.id); setMenu(null); }}>
              <FolderOpen className="h-3.5 w-3.5" />在访达中打开
            </button>
          )}
          <button type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-apple-red transition-colors hover:bg-apple-red/10"
            onClick={() => { setConfirmDelete(true); setMenu(null); }}>
            <Trash2 className="h-3.5 w-3.5" />删除
          </button>
        </div>
      )}
    </Card>
  );
}

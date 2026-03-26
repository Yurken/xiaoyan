import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Eye, Loader2, Pencil, Plus, Search, StickyNote, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Input, MarkdownRenderer } from "@research-copilot/ui";
import CollapsibleGroup from "../../components/CollapsibleGroup";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";

function InterestPicker({
  interests,
  value,
  onChange,
  placeholder = "不关联",
}: {
  interests: ResearchInterest[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = interests.find((i) => i.id === value);
  const label = selected ? (selected.folder_name?.trim() || selected.topic) : placeholder;

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl text-sm text-ink-primary transition-all duration-150"
        style={{
          background: "#E8ECF0",
          boxShadow: open
            ? "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF"
            : "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
        }}
      >
        <span className={selected ? "text-ink-primary" : "text-ink-tertiary"}>{label}</span>
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-ink-tertiary transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-2xl py-1 overflow-hidden max-h-48 overflow-y-auto"
          style={{ background: "linear-gradient(145deg, #F2F6FA, #E8ECF0)", boxShadow: "6px 6px 14px #C0C6CC, -4px -4px 10px #FFFFFF" }}
        >
          {[{ id: "", label: placeholder }].concat(interests.map((i) => ({ id: i.id, label: i.folder_name?.trim() || i.topic }))).map(({ id, label: optLabel }) => (
            <button
              key={id}
              type="button"
              tabIndex={0}
              onClick={() => { onChange(id); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm transition-colors"
              style={{
                color: value === id ? "#007AFF" : "#1C1C1E",
                background: value === id ? "rgba(0,122,255,0.08)" : "transparent",
                fontWeight: value === id ? 600 : 400,
              }}
            >
              {optLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between ml-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-tertiary">{label}</span>
            <span className="text-[10px] text-ink-tertiary/60 font-normal">支持 Markdown</span>
          </div>
          <div className="flex gap-1">
            {(["edit", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all duration-100"
                style={
                  tab === t
                    ? { background: "#E8ECF0", boxShadow: "inset 1px 1px 3px #C8CDD3, inset -1px -1px 3px #FFFFFF", color: "#1C1C1E" }
                    : { color: "#8E8E93" }
                }
              >
                {t === "edit" ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {t === "edit" ? "编辑" : "预览"}
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-none rounded-2xl px-4 py-3 text-sm text-ink-primary outline-none placeholder:text-ink-tertiary/60 leading-relaxed"
          style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF", fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: "12px" }}
        />
      ) : (
        <div
          className="min-h-[120px] rounded-2xl px-4 py-3 text-sm"
          style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
        >
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-ink-tertiary/60 text-xs">{placeholder}</p>
          )}
        </div>
      )}
    </div>
  );
}

function sourceLabel(sourceType: string) {
  if (sourceType === "manual") return "手动";
  if (sourceType === "paper_analysis") return "论文分析";
  if (sourceType === "survey") return "综述";
  return sourceType || "未知来源";
}

function interestFolderName(interest: ResearchInterest) {
  return interest.folder_name?.trim() || interest.topic;
}

function parseNoteTags(raw: string) {
  return raw.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean);
}

function NoteDetailModal({
  note,
  interests,
  interestMap,
  onClose,
  onSave,
  onDelete,
}: {
  note: KnowledgeNote;
  interests: ResearchInterest[];
  interestMap: Record<string, ResearchInterest>;
  onClose: () => void;
  onSave: (id: string, draft: { title: string; content: string; research_interest_id: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [draft, setDraft] = useState({
    title: note.title,
    content: note.content,
    research_interest_id: note.research_interest_id || "",
  });
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(note.id, draft);
      setMode("read");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await onDelete(note.id);
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: visible ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0)", transition: "background 0.28s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #F3F6FA 0%, #E8ECF0 100%)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.1)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Header */}
        <div
          className="flex flex-shrink-0 items-center justify-between px-6 py-4"
          style={{ background: "linear-gradient(180deg, #F0F4F8, #E8ECF0)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 text-sm text-ink-tertiary transition-colors hover:text-ink-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <div className="flex items-center gap-2">
            {mode === "read" ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setMode("edit")}>
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </Button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-apple-red transition-colors hover:bg-apple-red/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => setMode("read")}>
                  取消
                </Button>
                <Button size="sm" loading={saving} onClick={() => void handleSave()}>
                  保存
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {mode === "read" ? (
            <>
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{sourceLabel(note.source_type)}</Badge>
                {note.research_interest_id && interestMap[note.research_interest_id] && (
                  <span className="rounded-full bg-apple-blue/10 px-2.5 py-0.5 text-[11px] text-apple-blue">
                    {interestFolderName(interestMap[note.research_interest_id])}
                  </span>
                )}
                <span className="ml-auto text-xs text-ink-tertiary">
                  {new Date(note.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-xl font-bold text-ink-primary leading-snug">{note.title}</h1>

              {/* Tags — AI only */}
              {note.source_type !== "manual" && note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-500">小妍</span>
                  {note.tags.map((tag, i) => (
                    <span key={`${note.id}-${tag}-${i}`} className="rounded-full bg-apple-blue/10 px-2.5 py-1 text-[11px] text-apple-blue">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Content */}
              <div
                className="rounded-3xl px-5 py-4 text-sm leading-relaxed"
                style={{ background: "#E8ECF0", boxShadow: "inset 3px 3px 7px #C8CDD3, inset -3px -3px 7px #FFFFFF" }}
              >
                {note.content.trim() ? (
                  <MarkdownRenderer content={note.content} />
                ) : (
                  <p className="text-ink-tertiary">暂无内容</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Input
                label="标题"
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="知识卡片标题"
              />
              <div className="space-y-1">
                <label className="ml-1 block text-xs font-medium text-ink-tertiary">主题文件夹</label>
                <InterestPicker
                  interests={interests}
                  value={draft.research_interest_id}
                  onChange={(id) => setDraft((prev) => ({ ...prev, research_interest_id: id }))}
                  placeholder="未归档"
                />
              </div>
              <MarkdownEditor
                label="内容"
                value={draft.content}
                onChange={(v) => setDraft((prev) => ({ ...prev, content: v }))}
                placeholder="补充关键结论、方法差异或后续问题。"
                rows={14}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotesPanel({ hideFolders = false, researchInterestId }: { hideFolders?: boolean; researchInterestId?: string }) {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [selectedInterestId, setSelectedInterestId] = useState(researchInterestId ?? "");
  const [saving, setSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [savingEditNoteId, setSavingEditNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: "",
    content: "",
    tagsRaw: "",
    research_interest_id: "",
  });
  const [viewingNote, setViewingNote] = useState<KnowledgeNote | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiClient.knowledge.listInterests()
      .then((data) => {
        if (!cancelled) {
          setInterests(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiClient.knowledge.listNotes(search || undefined)
      .then((data) => {
        if (!cancelled) {
          setNotes(data);
          setError("");
          setLoading(false);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(formatErrorMessage(nextError));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [search]);

  const interestMap = useMemo(
    () => Object.fromEntries(interests.map((item) => [item.id, item])),
    [interests]
  );
  const noteGroups = useMemo(() => {
    return interests.map((interest) => ({
      key: interest.id,
      title: interestFolderName(interest),
      subtitle: interest.topic,
      notes: notes.filter((note) => note.research_interest_id === interest.id),
    }));
  }, [interests, notes]);
  const ungroupedNotes = useMemo(() => (
    notes.filter((note) => {
      if (!note.research_interest_id) return true;
      return !(note.research_interest_id in interestMap);
    })
  ), [interestMap, notes]);
  const displayNotes = useMemo(
    () => researchInterestId != null
      ? notes.filter((n) => n.research_interest_id === researchInterestId)
      : notes,
    [notes, researchInterestId],
  );

  const resetDraft = () => {
    setNoteTitle("");
    setNoteContent("");
    setSelectedInterestId(researchInterestId ?? "");
  };

  const openEditNote = (note: KnowledgeNote) => {
    setEditingNoteId(note.id);
    setEditDraft({
      title: note.title,
      content: note.content,
      tagsRaw: (note.tags || []).join(", "),
      research_interest_id: note.research_interest_id || "",
    });
    setError("");
  };

  const handleCreateNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;

    setSaving(true);

    try {
      const note = await apiClient.knowledge.createNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        research_interest_id: selectedInterestId || undefined,
      });

      setNotes((prev) => [note, ...prev]);
      resetDraft();
      setCreating(false);
      setError("");
      void apiClient.memory.add({
        type: "auto",
        action: "note.create",
        summary: `创建了笔记：「${note.title}」`,
        detail: JSON.stringify({ note_id: note.id }),
      });
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEditNote = async (id: string) => {
    const title = editDraft.title.trim();
    const content = editDraft.content.trim();
    if (!title || !content) {
      setError("标题和内容不能为空");
      return;
    }

    try {
      setSavingEditNoteId(id);
      setError("");
      await apiClient.knowledge.updateNote(id, {
        title,
        content,
        tags: parseNoteTags(editDraft.tagsRaw),
      });
      const moved = await apiClient.knowledge.moveNote(id, editDraft.research_interest_id || undefined);
      setNotes((prev) => prev.map((note) => (note.id === id ? moved : note)));
      setEditingNoteId(null);
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setSavingEditNoteId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.knowledge.deleteNote(id);
      setNotes((prev) => prev.filter((item) => item.id !== id));
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    }
  };

  const handleModalSave = async (
    id: string,
    draft: { title: string; content: string; research_interest_id: string },
  ) => {
    const title = draft.title.trim();
    const content = draft.content.trim();
    await apiClient.knowledge.updateNote(id, { title, content });
    const moved = await apiClient.knowledge.moveNote(id, draft.research_interest_id || undefined);
    setNotes((prev) => prev.map((note) => (note.id === id ? moved : note)));
    setViewingNote(moved);
  };

  const handleDeleteInterestGroup = async (interestId: string, deleteAll: boolean) => {
    try {
      setDeletingGroupId(interestId);
      if (deleteAll) {
        await apiClient.knowledge.deleteInterestBundle(interestId);
        setNotes((prev) => prev.filter((n) => n.research_interest_id !== interestId));
      } else {
        await apiClient.knowledge.deleteInterestOnly(interestId);
      }
      setInterests((prev) => prev.filter((item) => item.id !== interestId));
      setConfirmDeleteGroupId(null);
      setError("");
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setDeletingGroupId(null);
    }
  };

  const renderNoteCard = (note: KnowledgeNote) => (
    <Card key={note.id} padding="sm" className="group relative flex flex-col gap-3">
      <div className="pr-10">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewingNote(note)}
            className="line-clamp-2 text-left text-sm font-semibold text-ink-primary transition-colors hover:text-apple-blue"
          >
            {note.title}
          </button>
          <Badge variant="default">{sourceLabel(note.source_type)}</Badge>
        </div>
        {note.research_interest_id && interestMap[note.research_interest_id] && (
          <p className="mt-1.5 text-[11px] text-apple-blue">
            {interestFolderName(interestMap[note.research_interest_id])}
          </p>
        )}
      </div>

      <p className="line-clamp-4 text-xs leading-relaxed text-ink-secondary">{note.content}</p>

      {note.source_type !== "manual" && note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-500">小妍</span>
          {note.tags.map((tag, index) => (
            <span key={`${note.id}-${tag}-${index}`} className="rounded-full bg-apple-blue/10 px-2 py-0.5 text-[11px] text-apple-blue">
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="mt-auto pt-1 text-xs text-ink-tertiary">
        {new Date(note.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      </p>

      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setViewingNote(note)}
          className="text-ink-tertiary hover:text-ink-primary"
          aria-label={`编辑 ${note.title}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void handleDelete(note.id)}
          className="text-ink-tertiary hover:text-apple-red"
          aria-label={`删除 ${note.title}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  );

  return (
    <>
    <div className="space-y-4">
      <Card padding="sm" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary">知识卡片库</p>
            <p className="mt-1 text-xs leading-5 text-ink-tertiary">
              支持语义搜索、标签归档，并可把笔记关联到具体研究方向。
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-[520px] lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="请输入关键词搜索笔记、术语或方法"
                className="pl-10"
              />
            </div>
            <Button size="sm" onClick={() => setCreating((prev) => !prev)}>
              <Plus className="h-4 w-4" />
              {creating ? "收起表单" : "新建笔记"}
            </Button>
          </div>
        </div>

        {creating && (
          <div className="grid gap-3 rounded-2xl border border-nm-dark/10 bg-white/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-primary">新建知识卡片</p>
              <button type="button" onClick={() => setCreating(false)} className="text-ink-tertiary transition-colors hover:text-ink-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <Input
              label="标题"
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              placeholder="如：RLHF 中 reward model 的作用"
            />

            {!researchInterestId && (
              <div className="space-y-1">
                <label className="ml-1 block text-xs font-medium text-ink-tertiary">关联研究方向</label>
                <InterestPicker
                  interests={interests}
                  value={selectedInterestId}
                  onChange={setSelectedInterestId}
                  placeholder="不关联"
                />
              </div>
            )}

            <MarkdownEditor
              label="内容"
              value={noteContent}
              onChange={setNoteContent}
              placeholder="记录关键结论、方法差异、实验观察或待验证的问题。"
              rows={6}
            />

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => {
                resetDraft();
                setCreating(false);
              }}>
                取消
              </Button>
              <Button size="sm" loading={saving} onClick={() => void handleCreateNote()}>
                保存
              </Button>
            </div>
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
      ) : (researchInterestId != null ? displayNotes.length === 0 : notes.length === 0 && interests.length === 0) ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: "#E8ECF0", boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF" }}
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
      ) : hideFolders ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {displayNotes.map(renderNoteCard)}
        </div>
      ) : (
        <div className="space-y-4">
          {noteGroups.map((group) => (
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
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.notes.map(renderNoteCard)}
                </div>
              )}
            </CollapsibleGroup>
          ))}

          {ungroupedNotes.length > 0 && (
            <section className="space-y-3">
              <div className="px-1">
                <p className="text-sm font-semibold text-ink-primary">未归档笔记</p>
                <p className="mt-1 text-xs text-ink-tertiary">这些笔记暂未绑定主题，可直接编辑并移动到主题文件夹。</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ungroupedNotes.map(renderNoteCard)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>

    {viewingNote && (
      <NoteDetailModal
        note={viewingNote}
        interests={interests}
        interestMap={interestMap}
        onClose={() => setViewingNote(null)}
        onSave={handleModalSave}
        onDelete={handleDelete}
      />
    )}
    </>
  );
}

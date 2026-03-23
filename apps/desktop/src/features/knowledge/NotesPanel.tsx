import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Pencil, Plus, Search, StickyNote, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Input, Textarea } from "@research-copilot/ui";
import CollapsibleGroup from "../../components/CollapsibleGroup";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";

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

export default function NotesPanel({ hideFolders = false }: { hideFolders?: boolean }) {
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
  const [noteTagsRaw, setNoteTagsRaw] = useState("");
  const [selectedInterestId, setSelectedInterestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [savingEditNoteId, setSavingEditNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: "",
    content: "",
    tagsRaw: "",
    research_interest_id: "",
  });

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

  const resetDraft = () => {
    setNoteTitle("");
    setNoteContent("");
    setNoteTagsRaw("");
    setSelectedInterestId("");
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
      const tags = parseNoteTags(noteTagsRaw);
      const note = await apiClient.knowledge.createNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        tags,
        research_interest_id: selectedInterestId || undefined,
      });

      setNotes((prev) => [note, ...prev]);
      resetDraft();
      setCreating(false);
      setError("");
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
      <div className="pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <p className="line-clamp-2 text-sm font-semibold text-ink-primary">{note.title}</p>
          <Badge variant="default">{sourceLabel(note.source_type)}</Badge>
        </div>
        {note.research_interest_id && interestMap[note.research_interest_id] && (
          <p className="mt-2 text-[11px] text-apple-blue">
            关联方向：{interestFolderName(interestMap[note.research_interest_id])}
          </p>
        )}
      </div>

      <p className="line-clamp-5 text-xs leading-relaxed text-ink-secondary">{note.content}</p>

      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {note.tags.map((tag, index) => (
            <span key={`${note.id}-${tag}-${index}`} className="rounded-full bg-apple-blue/10 px-2 py-1 text-[11px] text-apple-blue">
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="mt-auto pt-1 text-xs text-ink-tertiary">
        {new Date(note.created_at).toLocaleDateString("zh-CN")}
      </p>

      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => openEditNote(note)}
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

      {editingNoteId === note.id && (
        <div className="mt-1 grid gap-3 border-t border-nm-dark/10 pt-3">
          <Input
            label="标题"
            value={editDraft.title}
            onChange={(event) => setEditDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="知识卡片标题"
          />
          <Input
            label="标签"
            value={editDraft.tagsRaw}
            onChange={(event) => setEditDraft((prev) => ({ ...prev, tagsRaw: event.target.value }))}
            placeholder="逗号分隔，如 对齐, RLHF"
          />
          <div className="space-y-1">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">主题文件夹</label>
            <select
              value={editDraft.research_interest_id}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, research_interest_id: event.target.value }))}
              className="w-full rounded-2xl border-0 px-4 py-2.5 text-sm text-ink-primary outline-none"
              style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
            >
              <option value="">未归档</option>
              {interests.map((interest) => (
                <option key={interest.id} value={interest.id}>
                  {interestFolderName(interest)}
                </option>
              ))}
            </select>
          </div>
          <Textarea
            label="内容"
            value={editDraft.content}
            onChange={(event) => setEditDraft((prev) => ({ ...prev, content: event.target.value }))}
            rows={5}
            placeholder="补充关键结论、方法差异或后续问题。"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditingNoteId(null)}>
              取消
            </Button>
            <Button size="sm" loading={savingEditNoteId === note.id} onClick={() => void handleSaveEditNote(note.id)}>
              保存
            </Button>
          </div>
        </div>
      )}
    </Card>
  );

  return (
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

            <div className="grid gap-3 lg:grid-cols-2">
              <Input
                label="标题"
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                placeholder="如：RLHF 中 reward model 的作用"
              />
              <Input
                label="标签"
                value={noteTagsRaw}
                onChange={(event) => setNoteTagsRaw(event.target.value)}
                placeholder="逗号分隔，如 对齐, RLHF, 奖励模型"
              />
            </div>

            <div className="space-y-1">
              <label className="ml-1 block text-xs font-medium text-ink-tertiary">关联研究方向</label>
              <select
                value={selectedInterestId}
                onChange={(event) => setSelectedInterestId(event.target.value)}
                className="w-full rounded-2xl border-0 px-4 py-2.5 text-sm text-ink-primary outline-none"
                style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
              >
                <option value="">不关联</option>
                {interests.map((interest) => (
                  <option key={interest.id} value={interest.id}>
                    {interestFolderName(interest)}
                  </option>
                ))}
              </select>
            </div>

            <Textarea
              label="内容"
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              placeholder="记录关键结论、方法差异、实验观察或待验证的问题。"
              rows={5}
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
      ) : notes.length === 0 && interests.length === 0 ? (
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
          {notes.map(renderNoteCard)}
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
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { Badge, Button, ConfirmDialog, Select } from "@research-copilot/ui";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { knowledgeApi, formatErrorMessage } from "../lib/client";
import MarkdownSplitEditor from "../features/knowledge/MarkdownSplitEditor";
import { sourceLabel } from "../features/knowledge/notesShared";
import { interestFolderName } from "../lib/interestUtils";

function buildInterestOptions(interests: ResearchInterest[], emptyLabel: string) {
  const list = [{ value: "", label: emptyLabel }];
  for (const interest of interests) {
    list.push({ value: interest.id, label: interestFolderName(interest) });
  }
  return list;
}

interface NoteReaderState {
  note?: KnowledgeNote;
  /** Pre-filled research interest when creating from a specific theme context */
  researchInterestId?: string;
  interest?: ResearchInterest | null;
  linkedClaimCount?: number;
}

export default function NoteReader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as NoteReaderState | null;

  const isCreate = id === "new";

  const [note, setNote] = useState<KnowledgeNote | null>(isCreate ? null : (locationState?.note ?? null));
  const [loading, setLoading] = useState(!isCreate && !locationState?.note);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [toast, setToast] = useState("");

  // Draft state
  const [title, setTitle] = useState(isCreate ? "新建笔记" : (locationState?.note?.title ?? ""));
  const [content, setContent] = useState(isCreate ? "" : (locationState?.note?.content ?? ""));
  // Create mode starts dirty so the save button is immediately available
  const [dirty, setDirty] = useState(isCreate);

  const interest = locationState?.interest ?? null;
  const linkedClaimCount = locationState?.linkedClaimCount ?? 0;

  // ── Interests ────────────────────────────────────────────
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [researchInterestId, setResearchInterestId] = useState(
    isCreate ? (locationState?.researchInterestId ?? "") : (locationState?.note?.research_interest_id ?? ""),
  );

  // Load interests for the selector
  useEffect(() => {
    knowledgeApi.listInterests().then(setInterests).catch(() => {});
  }, []);

  // Load note for existing ones
  useEffect(() => {
    if (isCreate) { setLoading(false); return; }
    if (note) return;
    if (!id) { setLoadError("缺少笔记ID"); setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const notes = await knowledgeApi.listNotes();
        if (cancelled) return;
        const found = notes.find((n) => n.id === id) ?? null;
        if (found) {
          setNote(found);
          setTitle(found.title);
          setContent(found.content);
          setDirty(false);
        } else {
          setLoadError("笔记不存在");
        }
      } catch (err) {
        if (!cancelled) setLoadError(formatErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, note, isCreate]);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }, []);

  // ── Save / Create ─────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!title.trim()) { flashToast("请输入标题"); return; }

    setSaving(true);
    try {
      if (isCreate) {
        const created = await knowledgeApi.createNote({
          title: title.trim(),
          content,
          research_interest_id: researchInterestId || undefined,
        });
        flashToast("已创建");
        // Replace history so the back button skips the "new" route
        navigate(`/notes/${created.id}`, {
          replace: true,
          state: { note: created, linkedClaimCount, interest },
        });
      } else {
        if (!note || !id) return;
        await knowledgeApi.updateNote(id, { title: title.trim(), content });
        // Move note if topic changed
        if (researchInterestId !== (note.research_interest_id ?? "")) {
          await knowledgeApi.moveNote(id, researchInterestId || undefined);
        }
        setNote((prev) => prev ? { ...prev, title: title.trim(), content, research_interest_id: researchInterestId || undefined } : prev);
        setDirty(false);
        flashToast("已保存");
      }
    } catch (err) {
      flashToast(formatErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [isCreate, note, id, title, content, researchInterestId, flashToast, navigate, linkedClaimCount, interest]);

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!id || isCreate) return;
    setDeleting(true);
    try {
      await knowledgeApi.deleteNote(id);
      flashToast("已删除");
      navigate("/knowledge", { replace: true });
    } catch (err) {
      flashToast(formatErrorMessage(err));
    } finally {
      setDeleting(false);
      setPendingDelete(false);
    }
  }, [id, isCreate, navigate, flashToast]);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!saving && dirty) handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saving, dirty, handleSave]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "var(--rc-surface)" }}>
        <Loader2 className="h-6 w-6 animate-spin text-ink-tertiary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3" style={{ background: "var(--rc-surface)" }}>
        <p className="text-sm font-semibold text-ink-primary">{loadError}</p>
        <Button size="sm" variant="secondary" onClick={() => navigate("/knowledge")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          返回知识库
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b px-5 py-2.5" style={{ borderColor: "var(--rc-border)" }}>
        <button
          type="button"
          onClick={() => navigate("/knowledge")}
          className="flex-shrink-0 rounded-xl p-1.5 text-ink-tertiary transition-colors hover:bg-nm-dark/10 hover:text-ink-primary"
          title="返回知识库"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            placeholder="笔记标题"
            className="w-full bg-transparent text-sm font-semibold text-ink-primary outline-none placeholder:text-ink-tertiary/50"
          />
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            {note ? <Badge variant="default">{sourceLabel(note.source_type)}</Badge> : null}
            {linkedClaimCount > 0 && <Badge variant="info">图谱 {linkedClaimCount}</Badge>}
            {interest && (
              <span className="text-[11px] text-ink-tertiary">{interestFolderName(interest)}</span>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Select
            value={researchInterestId}
            onChange={(val) => { setResearchInterestId(val); setDirty(true); }}
            options={buildInterestOptions(interests, "无主题")}
            className="min-w-[180px]"
          />
          {dirty && (
            <span className="text-[11px] text-ink-tertiary">{isCreate ? "新建" : "未保存"}</span>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || (!isCreate && !dirty)}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isCreate ? "创建" : "保存"}
          </Button>
          {!isCreate && (
            <button
              type="button"
              onClick={() => setPendingDelete(true)}
              className="rounded-xl p-1.5 text-ink-tertiary transition-colors hover:text-[var(--rc-apple-red,#FF3B30)]"
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Editor ──────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 p-5">
        <MarkdownSplitEditor
          value={content}
          onChange={(val) => { setContent(val); setDirty(true); }}
          placeholder="用 Markdown 记录你的想法、实验笔记、论文总结…"
          label=""
          defaultView="split"
        />
      </div>

      {/* ── Toast ───────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-lg"
          style={{ background: "rgba(28,28,30,0.92)" }}
        >
          {toast}
        </div>
      )}

      {/* ── Delete Confirm ──────────────────────────────────── */}
      <ConfirmDialog
        open={pendingDelete}
        title="删除笔记"
        description={note ? `确认删除「${note.title}」？此操作不可撤销。` : ""}
        confirmLabel="删除"
        tone="danger"
        loading={deleting}
        onClose={() => { if (!deleting) setPendingDelete(false); }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

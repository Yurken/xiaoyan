import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { FileText, FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@research-copilot/ui";
import {
  type WritingDraft,
  type WritingResearchInterestSummary,
  writingDraftTitle,
  writingResearchInterestTitle,
} from "./shared";

interface WritingDraftListProps {
  drafts: WritingDraft[];
  activeDraftId: string;
  activeResearchInterestId: string;
  interests: WritingResearchInterestSummary[];
  className?: string;
  listClassName?: string;
  onSelectDraft: (id: string) => void;
  onCreateDraft: () => void;
  onDeleteDraft: (id: string) => void;
}

interface DraftGroup {
  key: string;
  title: string;
  drafts: WritingDraft[];
}

export default function WritingDraftList({
  drafts,
  activeDraftId,
  activeResearchInterestId,
  interests,
  className,
  listClassName,
  onSelectDraft,
  onCreateDraft,
  onDeleteDraft,
}: WritingDraftListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const draftGroups = useMemo(
    () => buildDraftGroups(drafts, interests),
    [drafts, interests],
  );

  return (
    <section
      className={clsx("rounded-[8px] border p-3", className)}
      style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-flat-shadow)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-apple-blue" />
        <p className="text-sm font-semibold text-ink-primary">已有文稿</p>
        <span className="ml-auto text-xs text-ink-tertiary">{drafts.length}</span>
      </div>

      <Button
        type="button"
        size="sm"
        className="mb-3 w-full"
        onClick={onCreateDraft}
      >
        <Plus className="h-3.5 w-3.5" />
        新增文稿
      </Button>

      <div className={clsx("space-y-3", listClassName)}>
        {draftGroups.map((group) => (
          <div key={group.key}>
            <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium text-ink-tertiary">
              <span className="min-w-0 flex-1 truncate">{group.title}</span>
              <span>{group.drafts.length}</span>
            </div>
            <div className="space-y-1.5">
              {group.drafts.map((draft) => {
                const active = draft.id === activeDraftId;
                const confirming = confirmDeleteId === draft.id;
                return (
                  <div
                    key={draft.id}
                    className={clsx(
                      "group rounded-xl border px-2.5 py-2 transition-all",
                      active ? "border-apple-blue/35" : "border-transparent hover:border-nm-dark/10",
                    )}
                    style={{
                      background: active ? "rgba(0,122,255,0.10)" : "var(--rc-card-inset-bg)",
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectDraft(draft.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className={clsx("h-3.5 w-3.5 shrink-0", active ? "text-apple-blue" : "text-ink-tertiary")} />
                          <span className="min-w-0 truncate text-xs font-semibold text-ink-primary">
                            {writingDraftTitle(draft)}
                          </span>
                        </span>
                        <span className="mt-1 block text-[11px] text-ink-tertiary">
                          {new Date(draft.updatedAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}
                        </span>
                      </button>
                      <IconButton
                        size="sm"
                        aria-label={`删除 ${writingDraftTitle(draft)}`}
                        disabled={drafts.length <= 1}
                        onClick={() => setConfirmDeleteId((current) => (current === draft.id ? null : draft.id))}
                        className="opacity-70 hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>

                    {confirming ? (
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <span className="text-[11px] text-ink-tertiary">确认删除？</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          className="px-2.5"
                          onClick={() => {
                            onDeleteDraft(draft.id);
                            setConfirmDeleteId(null);
                          }}
                        >
                          删除
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="px-2.5"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          取消
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildDraftGroups(
  drafts: WritingDraft[],
  interests: WritingResearchInterestSummary[],
): DraftGroup[] {
  const sortedDrafts = [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const groups: DraftGroup[] = interests
    .map((interest) => ({
      key: interest.id,
      title: writingResearchInterestTitle(interest),
      drafts: sortedDrafts.filter((draft) => draft.researchInterestId === interest.id),
    }))
    .filter((group) => group.drafts.length > 0);
  const knownInterestIds = new Set(interests.map((interest) => interest.id));
  const unassignedDrafts = sortedDrafts.filter((draft) => {
    if (!draft.researchInterestId) return true;
    return !knownInterestIds.has(draft.researchInterestId);
  });

  if (unassignedDrafts.length > 0) {
    groups.push({
      key: "__unassigned__",
      title: "未绑定研究主题",
      drafts: unassignedDrafts,
    });
  }

  return groups;
}

import { CheckCircle2, Circle, Users } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { STATUS_CFG, type ChecklistItem, type Submission } from "./shared";

interface ChecklistWorkspaceProps {
  submissions: Submission[];
  checklistSubId: string;
  checklist: ChecklistItem[];
  checklistCat: string;
  categories: string[];
  visibleCategories: string[];
  filteredChecklist: ChecklistItem[];
  checkedCount: number;
  progress: number;
  onSelectSubmission: (submissionId: string) => void;
  onReset: () => void;
  onSelectCategory: (category: string) => void;
  onToggleCheck: (id: string) => void;
}

export default function ChecklistWorkspace({
  submissions,
  checklistSubId,
  checklist,
  checklistCat,
  categories,
  visibleCategories,
  filteredChecklist,
  checkedCount,
  progress,
  onSelectSubmission,
  onReset,
  onSelectCategory,
  onToggleCheck,
}: ChecklistWorkspaceProps) {
  const currentSubmission = submissions.find((submission) => submission.id === checklistSubId);

  if (submissions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50">
        <CheckCircle2 className="w-10 h-10 text-ink-tertiary" />
        <p className="text-sm text-ink-tertiary">先在投稿看板中新建投稿，再整理提交前检查清单</p>
      </div>
    );
  }

  return (
    <div className="flex gap-5 h-full min-h-0">
      <div className="w-52 flex-shrink-0 flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">投稿论文</p>
        {submissions.map((submission) => {
          const active = submission.id === checklistSubId;
          const statusStyle = STATUS_CFG[submission.status];

          return (
            <button
              key={submission.id}
              onClick={() => onSelectSubmission(submission.id)}
              className="w-full text-left rounded-2xl p-3 transition-all duration-150"
              style={
                active
                  ? { background: "#007AFF", color: "#fff", boxShadow: "2px 4px 12px rgba(0,122,255,0.3)" }
                  : {
                      background: "var(--rc-card-bg)",
                      color: "var(--rc-text-primary)" as string,
                      boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)",
                    }
              }
            >
              <p className="text-sm font-medium line-clamp-2 leading-snug">{submission.title}</p>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="text-[10px] truncate" style={{ opacity: 0.65 }}>
                  {submission.venue}
                </span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={
                    active
                      ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                      : { background: statusStyle.bg, color: statusStyle.color }
                  }
                >
                  {statusStyle.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0 space-y-5 overflow-y-auto">
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-ink-primary">提交前检查</p>
                <p className="text-xs text-ink-tertiary mt-0.5 line-clamp-1">{currentSubmission?.title}</p>
              </div>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: progress === 100 ? "#34C759" : "#007AFF" }}
              >
                {checkedCount} / {checklist.length}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.12)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: progress === 100 ? "#34C759" : "linear-gradient(90deg, #007AFF, #5856D6)",
                }}
              />
            </div>
          </div>
          {progress === 100 ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(52,199,89,0.10)" }}
            >
              <CheckCircle2 className="w-4 h-4" style={{ color: "#34C759" }} />
              <span className="text-xs font-medium" style={{ color: "#34C759" }}>可以投稿了</span>
            </div>
          ) : null}
          <button
            className="text-xs text-ink-tertiary hover:text-ink-secondary transition-colors px-3 py-1.5 rounded-lg hover:bg-black/5"
            onClick={onReset}
          >
            重置
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {categories.map((category) => {
            const categoryCount = checklist.filter((item) => item.category === category).length;
            const categoryChecked = checklist.filter((item) => item.category === category && item.checked).length;
            return (
              <button
                key={category}
                onClick={() => onSelectCategory(category)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                style={checklistCat === category
                  ? { background: "#007AFF", color: "#fff" }
                  : {
                      background: "var(--rc-card-bg)",
                      color: "var(--rc-text-secondary)" as string,
                      boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)",
                    }}
              >
                {category === "all" ? "全部" : category}
                {category !== "all" ? (
                  <span className={checklistCat === category ? "opacity-70" : "opacity-50"}>
                    {categoryChecked}/{categoryCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {visibleCategories.map((category) => (
            <div key={category} className="space-y-2">
              <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">
                {category}
              </p>
              <Card padding="sm" className="space-y-1">
                {filteredChecklist
                  .filter((item) => item.category === category)
                  .map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onToggleCheck(item.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-all duration-150 hover:bg-black/[0.03]"
                    >
                      {item.checked
                        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#34C759" }} />
                        : <Circle className="w-4 h-4 flex-shrink-0 text-ink-tertiary" />
                      }
                      <span
                        className="text-[13px] leading-snug transition-all duration-150"
                        style={{
                          color: item.checked ? "#34C759" : "var(--rc-text-primary)" as string,
                          textDecoration: item.checked ? "line-through" : "none",
                          opacity: item.checked ? 0.6 : 1,
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
                  ))}
              </Card>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl p-3.5 flex items-center gap-3 border-2 border-dashed opacity-50"
          style={{ borderColor: "var(--rc-border)" }}
        >
          <Users className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-ink-secondary">团队协作清单（即将上线）</p>
            <p className="text-xs text-ink-tertiary mt-0.5">为每位共同作者分配清单项，追踪各自完成进度。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

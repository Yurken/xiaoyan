import { FolderOpen, Inbox, Library } from "lucide-react";
import { clsx } from "clsx";
import type { ResearchInterest } from "@research-copilot/types";
import { interestFolderName } from "../../../lib/interestUtils";
import type { NotesScope } from "./shared";

export default function NotesNavigation({
  interests,
  scope,
  onScopeChange,
}: {
  interests: ResearchInterest[];
  scope: NotesScope;
  onScopeChange: (scope: NotesScope) => void;
}) {
  const itemClass = (active: boolean) => clsx(
    "flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition-[color,background,box-shadow]",
    active ? "text-apple-blue" : "text-ink-secondary hover:text-ink-primary",
  );
  const itemStyle = (active: boolean) => active ? {
    background: "var(--rc-nav-item-active-bg)",
    border: "1px solid var(--rc-nav-item-active-border)",
    boxShadow: "var(--rc-nav-item-active-shadow)",
  } : undefined;

  return (
    <nav aria-label="笔记范围" className="min-w-0 space-y-1">
      <button type="button" className={itemClass(scope === "all")} style={itemStyle(scope === "all")} onClick={() => onScopeChange("all")}>
        <Library className="h-4 w-4 shrink-0" />
        <span className="truncate">全部笔记</span>
      </button>
      <button type="button" className={itemClass(scope === "unfiled")} style={itemStyle(scope === "unfiled")} onClick={() => onScopeChange("unfiled")}>
        <Inbox className="h-4 w-4 shrink-0" />
        <span className="truncate">未归档</span>
      </button>

      {interests.length > 0 ? (
        <div className="pt-5">
          <p className="mb-2 px-3 text-xs font-medium text-ink-tertiary">研究主题</p>
          <div className="space-y-1">
            {interests.map((interest) => {
              const value = `interest:${interest.id}` as NotesScope;
              return (
                <button key={interest.id} type="button" className={itemClass(scope === value)} style={itemStyle(scope === value)} onClick={() => onScopeChange(value)}>
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">{interestFolderName(interest)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

import { PenTool, Plus } from "lucide-react";
import type { LatexSnippet } from "./shared";

interface WritingSnippetToolbarProps {
  snippets: LatexSnippet[];
  onInsertSnippet: (snippet: LatexSnippet) => void;
}

export default function WritingSnippetToolbar({
  snippets,
  onInsertSnippet,
}: WritingSnippetToolbarProps) {
  return (
    <div
      className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2"
      style={{ background: "var(--rc-card-inset-bg)", borderColor: "var(--rc-border)" }}
    >
      <div className="flex shrink-0 items-center gap-2 pr-1 text-xs font-bold text-ink-secondary">
        <PenTool className="h-3.5 w-3.5 text-apple-blue" />
        <span>常用片段</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {snippets.map((snippet) => (
          <button
            key={snippet.id}
            type="button"
            onClick={() => onInsertSnippet(snippet)}
            title={snippet.description}
            className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold text-ink-secondary transition-all hover:border-apple-blue/30 hover:bg-apple-blue/5 hover:text-apple-blue"
            style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-bg)" }}
          >
            <Plus className="h-3 w-3 text-ink-tertiary transition-colors group-hover:text-apple-blue" />
            <span>{snippet.title}</span>
            <span className="hidden max-w-32 truncate text-[10px] font-medium text-ink-tertiary xl:inline">
              {snippet.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

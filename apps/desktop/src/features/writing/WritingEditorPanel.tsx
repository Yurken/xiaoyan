import { useMemo, useRef } from "react";
import { Code2, FileText } from "lucide-react";
import type { RefObject } from "react";

interface WritingEditorPanelProps {
  editorRef: RefObject<HTMLTextAreaElement>;
  mainTex: string;
  bibtex: string;
  activeSource: "main" | "bib";
  onActiveSourceChange: (source: "main" | "bib") => void;
  onMainTexChange: (value: string) => void;
  onBibtexChange: (value: string) => void;
  onInsertText: (before: string, after?: string) => void;
}

export default function WritingEditorPanel({
  editorRef,
  mainTex,
  bibtex,
  activeSource,
  onActiveSourceChange,
  onMainTexChange,
  onBibtexChange,
  onInsertText,
}: WritingEditorPanelProps) {
  const lineNumbersRef = useRef<HTMLPreElement | null>(null);
  const value = activeSource === "main" ? mainTex : bibtex;
  const lineNumbers = useMemo(() => {
    const count = Math.max(1, value.split("\n").length);
    return Array.from({ length: count }, (_, index) => index + 1).join("\n");
  }, [value]);

  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden rounded-[8px] border"
      style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-flat-shadow)" }}
    >
      <div
        className="flex min-h-12 items-center gap-2 border-b px-3"
        style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
      >
        <button
          type="button"
          onClick={() => onActiveSourceChange("main")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
            activeSource === "main" ? "text-white" : "text-ink-tertiary hover:text-ink-primary"
          }`}
          style={activeSource === "main" ? { background: "var(--rc-button-primary-bg)" } : undefined}
        >
          <FileText className="h-3.5 w-3.5" />
          main.tex
        </button>
        <button
          type="button"
          onClick={() => onActiveSourceChange("bib")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
            activeSource === "bib" ? "text-white" : "text-ink-tertiary hover:text-ink-primary"
          }`}
          style={activeSource === "bib" ? { background: "var(--rc-button-primary-bg)" } : undefined}
        >
          <Code2 className="h-3.5 w-3.5" />
          references.bib
        </button>
        <div className="ml-auto text-xs text-ink-tertiary">
          {value.split("\n").length} 行
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <pre
          ref={lineNumbersRef}
          aria-hidden="true"
          className="min-h-full w-14 shrink-0 overflow-hidden border-r px-3 py-4 text-right font-mono text-xs leading-6 text-ink-tertiary"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
        >
          {lineNumbers}
        </pre>
        <textarea
          ref={activeSource === "main" ? editorRef : undefined}
          value={value}
          spellCheck={false}
          onChange={(event) => {
            if (activeSource === "main") onMainTexChange(event.target.value);
            else onBibtexChange(event.target.value);
          }}
          onScroll={(event) => {
            if (lineNumbersRef.current) {
              lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab" || activeSource !== "main") return;
            event.preventDefault();
            onInsertText("  ");
          }}
          className="rc-selectable min-h-full flex-1 resize-none overflow-auto border-0 bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-ink-primary outline-none"
          style={{ tabSize: 2 }}
        />
      </div>
    </section>
  );
}

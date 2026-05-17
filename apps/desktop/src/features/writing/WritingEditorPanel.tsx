import { useMemo, useRef } from "react";
import { clsx } from "clsx";
import { Clipboard, Code2, FileText } from "lucide-react";
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm"
      style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
    >
      <div
        className="flex h-11 items-center gap-1 border-b px-2"
        style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
      >
        <button
          type="button"
          onClick={() => onActiveSourceChange("main")}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
            activeSource === "main" ? "bg-apple-blue text-white shadow-sm" : "text-ink-tertiary hover:bg-white/5 hover:text-ink-secondary"
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          main.tex
        </button>
        <button
          type="button"
          onClick={() => onActiveSourceChange("bib")}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
            activeSource === "bib" ? "bg-apple-blue text-white shadow-sm" : "text-ink-tertiary hover:bg-white/5 hover:text-ink-secondary"
          )}
        >
          <Code2 className="h-3.5 w-3.5" />
          references.bib
        </button>
        <div className="ml-auto flex items-center gap-3 px-2">
          <span className="font-mono text-[11px] text-ink-tertiary">
            {value.split("\n").length} lines
          </span>
          <div className="h-3 w-px bg-white/10" />
          <button
            type="button"
            onClick={() => {
              const text = activeSource === "main" ? mainTex : bibtex;
              void navigator.clipboard.writeText(text);
            }}
            title="复制源码"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary"
          >
            <Clipboard className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className="flex w-12 shrink-0 flex-col border-r pt-4 text-right font-mono text-[11px] leading-6 text-ink-tertiary/40 select-none"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
        >
          <pre
            ref={lineNumbersRef}
            aria-hidden="true"
            className="overflow-hidden px-2"
          >
            {lineNumbers}
          </pre>
        </div>
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
          className="rc-selectable min-h-full flex-1 resize-none overflow-auto border-0 bg-transparent px-4 py-4 font-mono text-[13.5px] leading-6 text-ink-primary outline-none"
          style={{ tabSize: 2, caretColor: "var(--rc-accent)" }}
        />
      </div>
    </section>
  );
}

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { ArrowDown, ArrowUp, Replace, Search, X } from "lucide-react";
import type { MouseEvent } from "react";
import type { WritingAssistantActionId } from "./shared";
import type { WritingEditorHandle } from "./writingEditorHandle";
import WritingEditorContextMenu from "./WritingEditorContextMenu";
import { useWritingSourceSearch } from "./useWritingSourceSearch";

const LINE_HEIGHT = 24;
const SCROLL_CONTEXT_LINES = 3;

interface WritingSourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  onInsertImage: () => void;
  onAssistantAction: (actionId: WritingAssistantActionId) => void;
}

const WritingSourceEditor = forwardRef<WritingEditorHandle, WritingSourceEditorProps>(
  function WritingSourceEditor({ value, onChange, onInsertImage, onAssistantAction }, ref) {
    const lineNumbersRef = useRef<HTMLPreElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const valueRef = useRef(value);
    const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0 });

    useEffect(() => {
      valueRef.current = value;
    }, [value]);

    const getEditor = useCallback(() => textareaRef.current, []);

    const search = useWritingSourceSearch({ value, onChange, getEditor });

    const lineNumbers = useMemo(() => {
      const count = Math.max(1, value.split("\n").length);
      return Array.from({ length: count }, (_, index) => index + 1).join("\n");
    }, [value]);

    useEffect(() => {
      const el = textareaRef.current;
      if (el && el.value !== value) {
        el.value = value;
      }
    }, [value]);

    const focus = useCallback(() => {
      textareaRef.current?.focus();
    }, []);

    const getSelectedText = useCallback(() => {
      const el = textareaRef.current;
      if (!el || el.selectionStart === el.selectionEnd) return "";
      return valueRef.current.slice(el.selectionStart, el.selectionEnd);
    }, []);

    const insertText = useCallback(
      (before: string, after = "") => {
        const el = textareaRef.current;
        const current = el ? el.value : valueRef.current;
        const start = el?.selectionStart ?? current.length;
        const end = el?.selectionEnd ?? current.length;
        const selected = current.slice(start, end);
        const next = `${current.slice(0, start)}${before}${selected}${after}${current.slice(end)}`;
        const cursor = start + before.length + selected.length;
        valueRef.current = next;
        if (el) {
          el.value = next;
        }
        onChange(next);
        window.requestAnimationFrame(() => {
          const editor = textareaRef.current;
          editor?.focus();
          editor?.setSelectionRange(cursor, cursor);
        });
      },
      [onChange],
    );

    const insertLatex = useCallback(
      (content: string) => {
        insertText(content);
      },
      [insertText],
    );

    const focusSourceRange = useCallback((start: number, end?: number) => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end ?? start);
      const lineIndex = valueRef.current.slice(0, start).split("\n").length - 1;
      el.scrollTop = Math.max(0, (lineIndex - SCROLL_CONTEXT_LINES) * LINE_HEIGHT);
    }, []);

    useImperativeHandle(
      ref,
      () => ({ focus, getSelectedText, insertText, insertLatex, focusSourceRange }),
      [focus, getSelectedText, insertText, insertLatex, focusSourceRange],
    );

    const handleContextMenu = useCallback((event: MouseEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      event.currentTarget.focus();
      setContextMenu({ open: true, x: event.clientX, y: event.clientY });
    }, []);

    return (
      <>
        {search.searchOpen && (
          <div
            className="flex items-center gap-2 border-b px-3 py-1.5"
            style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
          >
            <div
              className="flex items-center gap-1.5 rounded-lg border px-2 py-1"
              style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-bg)" }}
            >
              <Search className="h-3.5 w-3.5 text-ink-tertiary" />
              <input
                ref={search.searchInputRef}
                type="text"
                value={search.searchTerm}
                onChange={(e) => search.setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    search.navigateNext();
                  }
                }}
                placeholder="查找…"
                className="w-40 border-0 bg-transparent text-xs text-ink-primary outline-none placeholder:text-ink-tertiary/50"
              />
              {search.searchTerm && (
                <span className="text-[10px] text-ink-tertiary tabular-nums">
                  {search.matches.length > 0
                    ? `${search.matchIndex % search.matches.length + 1}/${search.matches.length}`
                    : "0"}
                </span>
              )}
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded text-ink-tertiary/50 hover:text-ink-tertiary"
                onClick={search.navigatePrev}
                disabled={search.matches.length === 0}
                title="上一个"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded text-ink-tertiary/50 hover:text-ink-tertiary"
                onClick={search.navigateNext}
                disabled={search.matches.length === 0}
                title="下一个"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => search.setShowReplace((v) => !v)}
              className={clsx(
                "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition",
                search.showReplace
                  ? "bg-apple-blue/10 text-apple-blue"
                  : "text-ink-tertiary hover:text-ink-secondary",
              )}
              title="替换"
            >
              <Replace className="h-3 w-3" />
              替换
            </button>

            {search.showReplace && (
              <>
                <input
                  type="text"
                  value={search.replaceTerm}
                  onChange={(e) => search.setReplaceTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      search.replaceCurrent();
                    }
                  }}
                  placeholder="替换为…"
                  className="w-36 rounded-lg border bg-transparent px-2 py-1 text-xs text-ink-primary outline-none"
                  style={{ borderColor: "var(--rc-border)" }}
                />
                <button
                  type="button"
                  onClick={search.replaceCurrent}
                  disabled={search.matches.length === 0}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-ink-secondary hover:bg-white/5 disabled:opacity-30"
                >
                  替换
                </button>
                <button
                  type="button"
                  onClick={search.replaceAll}
                  disabled={search.matches.length === 0}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-ink-secondary hover:bg-white/5 disabled:opacity-30"
                >
                  全部替换
                </button>
              </>
            )}

            <button
              type="button"
              className="ml-auto flex h-5 w-5 items-center justify-center rounded text-ink-tertiary/40 hover:text-ink-tertiary"
              onClick={() => search.closeSearch(false)}
              title="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className="flex w-12 shrink-0 flex-col border-r pt-4 text-right font-mono text-[11px] leading-6 text-ink-tertiary/40 select-none"
            style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
          >
            <pre ref={lineNumbersRef} aria-hidden="true" className="overflow-hidden px-2">
              {lineNumbers}
            </pre>
          </div>
          <textarea
            ref={textareaRef}
            defaultValue={value}
            aria-label="LaTeX 源码编辑器"
            spellCheck={false}
            onInput={(event) => onChange(event.currentTarget.value)}
            onScroll={(event) => {
              if (lineNumbersRef.current) {
                lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
              }
            }}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              event.preventDefault();
              insertText("  ");
            }}
            onContextMenu={handleContextMenu}
            className="rc-selectable min-h-full flex-1 resize-none overflow-auto border-0 bg-transparent px-4 py-4 font-mono text-[13.5px] leading-6 text-ink-primary outline-none"
            style={{ tabSize: 2, caretColor: "var(--rc-accent)" }}
          />
        </div>
        <WritingEditorContextMenu
          open={contextMenu.open}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu((current) => ({ ...current, open: false }))}
          onInsert={insertText}
          onInsertImage={onInsertImage}
          onAssistantAction={onAssistantAction}
        />
      </>
    );
  },
);

export default WritingSourceEditor;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileCode, Save, X } from "lucide-react";
import type { OpenFile } from "./shared";

interface CodeEditorModalProps {
  file: OpenFile | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

type EditorView = "diff" | "file";

export default function CodeEditorModal({
  file,
  onChange,
  onSave,
  onClose,
}: CodeEditorModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);
  const [view, setView] = useState<EditorView>("file");

  // 当文件切换时，有 diff 则默认展示 diff，否则展示文件
  useEffect(() => {
    setView(file?.diffContent ? "diff" : "file");
  }, [file?.path, file?.diffContent]);

  useEffect(() => {
    setLineCount(file?.content.split("\n").length || 1);
  }, [file?.content]);

  const filePath = file?.path;

  useEffect(() => {
    if (!filePath) return;
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [filePath]);

  const requestClose = useCallback(() => {
    if (file?.dirty && !window.confirm("文件有未保存的修改，确定关闭编辑器吗？")) return;
    onClose();
  }, [file?.dirty, onClose]);

  useEffect(() => {
    const openedFile = file;
    if (!openedFile) return;
    const isDirty = openedFile.dirty;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (isDirty) onSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [file, onSave, requestClose]);

  const handleScroll = useCallback(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    onChange(`${target.value.slice(0, start)}  ${target.value.slice(end)}`);
    requestAnimationFrame(() => {
      target.selectionStart = start + 2;
      target.selectionEnd = start + 2;
    });
  }, [onChange]);

  const hasDiff = Boolean(file?.diffContent);

  if (!file) return null;

  return createPortal(
    <div className="code-editor-modal" role="presentation" onMouseDown={requestClose}>
      <section
        className="code-editor-modal__surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-editor-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="code-editor-modal__header">
          <div className="code-editor__header-left">
            <FileCode size={16} />
            <div className="min-w-0">
              <h2 id="code-editor-modal-title" className="code-editor__filename">{file.name}</h2>
              <p className="code-editor-modal__path" title={file.path}>{file.path}</p>
            </div>
            {file.dirty && <span className="code-editor__dirty-dot" aria-label="未保存修改" />}
          </div>
          <div className="code-editor__header-right">
            {hasDiff && (
              <div className="code-editor__view-toggle">
                <button
                  type="button"
                  className={`code-editor__view-btn${view === "diff" ? " is-active" : ""}`}
                  onClick={() => setView("diff")}
                >
                  Diff
                </button>
                <button
                  type="button"
                  className={`code-editor__view-btn${view === "file" ? " is-active" : ""}`}
                  onClick={() => setView("file")}
                >
                  文件
                </button>
              </div>
            )}
            <button
              type="button"
              className="code-editor__save-btn"
              onClick={onSave}
              disabled={!file.dirty}
              title="保存 (Ctrl+S / Cmd+S)"
            >
              <Save size={13} />
              <span>保存</span>
            </button>
            <button type="button" className="code-editor__close-btn" onClick={requestClose} title="关闭编辑器" aria-label="关闭编辑器">
              <X size={14} />
            </button>
          </div>
        </header>

        {view === "diff" && file.diffContent ? (
          <div className="code-editor-modal__body">
            <DiffView diff={file.diffContent} />
          </div>
        ) : (
          <div className="code-editor-modal__body">
            <div className="code-editor__line-numbers" ref={lineNumbersRef} aria-hidden="true">
              {Array.from({ length: lineCount }, (_, index) => (
                <div key={index + 1} className="code-editor__line-number">{index + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="code-editor__textarea"
              value={file.content}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label={`${file.name} 编辑器`}
            />
          </div>
        )}

        <footer className="code-editor-modal__footer">
          {view === "diff" && file.diffContent ? (
            <span>Diff 预览</span>
          ) : (
            <span>{file.dirty ? "有未保存修改" : "所有修改已保存"}</span>
          )}
          <span>Tab 缩进 · ⌘/Ctrl + S 保存 · Esc 关闭</span>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function DiffView({ diff }: { diff: string }) {
  const lines = useMemo(() => diff.split("\n"), [diff]);

  if (!diff.trim()) {
    return <div className="code-git-diff__empty">暂无 diff</div>;
  }

  return (
    <div className="code-git-diff__content">
      {lines.map((line, index) => {
        let className = "code-git-diff__line";
        let prefix = "";
        let content = line;

        if (line.startsWith("diff --git")) {
          className += " code-git-diff__line--file";
          const match = line.match(/diff --git a\/(.+) b\/(.+)/);
          content = match ? match[2] : line;
        } else if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("index ")) {
          className += " code-git-diff__line--meta";
        } else if (line.startsWith("@@")) {
          className += " code-git-diff__line--hunk";
        } else if (line.startsWith("+")) {
          className += " code-git-diff__line--add";
          prefix = "+";
          content = line.slice(1);
        } else if (line.startsWith("-")) {
          className += " code-git-diff__line--del";
          prefix = "-";
          content = line.slice(1);
        } else if (line.startsWith(" ")) {
          content = line.slice(1);
        }

        return (
          <div key={index} className={className}>
            <span className="code-git-diff__prefix">{prefix}</span>
            <span className="code-git-diff__text">{content}</span>
          </div>
        );
      })}
    </div>
  );
}

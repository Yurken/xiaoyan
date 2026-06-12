import { useCallback, useEffect, useRef, useState } from "react";
import { Save, X, FileCode } from "lucide-react";

interface CodeEditorProps {
  path: string | null;
  name: string;
  content: string;
  dirty: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function CodeEditor({
  path,
  name,
  content,
  dirty,
  onChange,
  onSave,
  onClose,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  useEffect(() => {
    setLineCount(content.split("\n").length || 1);
  }, [content]);

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty) onSave();
      }
    },
    [dirty, onSave]
  );

  // Tab insertion
  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    onChange(target.value);
  }, [onChange]);

  const handleKeyDownWithTab = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue = target.value.substring(0, start) + "  " + target.value.substring(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        });
      }
      handleKeyDown(e);
    },
    [handleKeyDown, onChange]
  );

  if (!path) {
    return (
      <div className="code-editor code-editor--empty">
        <div className="code-editor__empty-state">
          <FileCode size={32} className="code-editor__empty-icon" />
          <p className="code-editor__empty-title">选择一个文件开始编辑</p>
          <p className="code-editor__empty-desc">在左侧目录树中点击文件即可打开</p>
        </div>
      </div>
    );
  }

  return (
    <div className="code-editor">
      <div className="code-editor__header">
        <div className="code-editor__header-left">
          <FileCode size={14} />
          <span className="code-editor__filename">{name}</span>
          {dirty && <span className="code-editor__dirty-dot" />}
        </div>
        <div className="code-editor__header-right">
          {dirty && (
            <button
              type="button"
              className="code-editor__save-btn"
              onClick={onSave}
              title="保存 (Ctrl+S / Cmd+S)"
            >
              <Save size={13} />
              <span>保存</span>
            </button>
          )}
          <button
            type="button"
            className="code-editor__close-btn"
            onClick={onClose}
            title="关闭"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="code-editor__body">
        <div className="code-editor__line-numbers" ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="code-editor__line-number">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="code-editor__textarea"
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDownWithTab}
          onScroll={handleScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
        />
      </div>
    </div>
  );
}

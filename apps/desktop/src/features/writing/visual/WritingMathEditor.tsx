import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface WritingMathEditorProps {
  latex: string;
  displayMode: boolean;
  onChange: (latex: string) => void;
  onClose: () => void;
}

export default function WritingMathEditor({ latex, displayMode, onChange, onClose }: WritingMathEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const initialLatexRef = useRef(latex);
  const onChangeRef = useRef(onChange);
  const onCloseRef = useRef(onClose);
  const [ready, setReady] = useState(false);
  onChangeRef.current = onChange;
  onCloseRef.current = onClose;

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void import("mathlive").then(({ MathfieldElement }) => {
      if (disposed || !hostRef.current) return;
      const field = new MathfieldElement();
      field.value = initialLatexRef.current;
      field.setAttribute("virtual-keyboard-mode", "onfocus");
      field.setAttribute("smart-fence", "true");
      field.className = "writing-math-field";
      field.setAttribute("aria-label", displayMode ? "编辑独立公式" : "编辑行内公式");
      const handleInput = () => onChangeRef.current(field.value);
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onCloseRef.current();
      };
      field.addEventListener("input", handleInput);
      field.addEventListener("keydown", handleKeyDown);
      hostRef.current.replaceChildren(field);
      setReady(true);
      field.focus();
      cleanup = () => {
        field.removeEventListener("input", handleInput);
        field.removeEventListener("keydown", handleKeyDown);
        field.remove();
      };
    }).catch(() => {
      if (!disposed) setReady(false);
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [displayMode]);

  return (
    <div className="writing-math-popover" role="dialog" aria-label={displayMode ? "编辑独立公式" : "编辑行内公式"}>
      <div className="writing-visual-popover__header">
        <span>{displayMode ? "独立公式" : "行内公式"}</span>
        <button type="button" onClick={onClose} aria-label="关闭公式编辑器" title="关闭">
          <X size={14} />
        </button>
      </div>
      <div className="writing-math-host" aria-busy={!ready}>
        {!ready && <span className="writing-visual-hint">加载公式编辑器…</span>}
        <div ref={hostRef} />
      </div>
      <p className="writing-visual-hint">可直接使用数学键盘，修改会实时同步到论文。</p>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { extractVisualBibliographyEntries, extractVisualReferenceLabels } from "./latexBibliography";

interface WritingCitationPickerProps {
  mode: "citation" | "reference";
  bibtex: string;
  source: string;
  selectedKeys: string[];
  onApply: (keys: string[]) => void;
  onClose: () => void;
}

export default function WritingCitationPicker({
  mode,
  bibtex,
  source,
  selectedKeys,
  onApply,
  onClose,
}: WritingCitationPickerProps) {
  const [selected, setSelected] = useState(selectedKeys);
  const [query, setQuery] = useState("");
  const entries = useMemo(() => extractVisualBibliographyEntries(bibtex), [bibtex]);
  const labels = useMemo(() => extractVisualReferenceLabels(source), [source]);

  useEffect(() => {
    setSelected(selectedKeys);
    setQuery("");
  }, [selectedKeys, mode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const options = mode === "citation"
    ? entries.map((entry) => ({ key: entry.key, detail: entry.title }))
    : labels.map((label) => ({ key: label, detail: "LaTeX 标签" }));
  const filtered = options.filter((option) => `${option.key} ${option.detail}`.toLowerCase().includes(query.toLowerCase()));

  const toggle = (key: string) => {
    if (mode === "reference") {
      setSelected([key]);
      return;
    }
    setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  return (
    <div className="writing-citation-popover" role="dialog" aria-label={mode === "citation" ? "选择参考文献" : "选择交叉引用"}>
      <div className="writing-visual-popover__header">
        <span>{mode === "citation" ? "参考文献" : "交叉引用"}</span>
        <button type="button" onClick={onClose} aria-label="关闭引用选择器" title="关闭"><X size={14} /></button>
      </div>
      <label className="writing-citation-search">
        <Search size={13} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或引用键" autoFocus />
      </label>
      <div className="writing-citation-options">
        {filtered.map((option) => (
          <button
            type="button"
            key={option.key}
            aria-pressed={selected.includes(option.key)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => toggle(option.key)}
          >
            <span className="writing-citation-check">{selected.includes(option.key) && <Check size={12} />}</span>
            <span className="writing-citation-option__text">
              <strong>{option.key}</strong>
              <small>{option.detail || "未填写标题"}</small>
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="writing-visual-hint">
            {options.length === 0
              ? mode === "citation" ? "references.bib 中还没有可用条目。" : "当前文稿还没有 \\label 标签。"
              : "没有匹配的条目。"}
          </p>
        )}
      </div>
      <div className="writing-citation-footer">
        <span>{selected.length > 0 ? `已选 ${selected.length} 项` : "请选择条目"}</span>
        <button type="button" disabled={selected.length === 0} onClick={() => onApply(selected)}>
          {selectedKeys.length > 0 ? "更新引用" : "插入引用"}
        </button>
      </div>
    </div>
  );
}

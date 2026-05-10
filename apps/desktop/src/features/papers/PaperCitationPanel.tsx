import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Quote, X } from "lucide-react";
import type { Paper } from "@research-copilot/types";
import { formatPaperCitation, PAPER_CITATION_FORMATS, type PaperCitationFormat } from "./shared";

interface PaperCitationPanelProps {
  paper: Paper;
  onClose: () => void;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function PaperCitationPanel({ paper, onClose }: PaperCitationPanelProps) {
  const [format, setFormat] = useState<PaperCitationFormat>("gbt7714");
  const [copied, setCopied] = useState(false);
  const citation = useMemo(() => formatPaperCitation(paper, format), [format, paper]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1300);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    await copyText(citation);
    setCopied(true);
  };

  return (
    <div
      className="mt-2 rounded-2xl border px-3 py-3"
      style={{ background: "rgba(0,122,255,0.045)", borderColor: "rgba(0,122,255,0.12)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0A62D0]">
          <Quote className="h-3.5 w-3.5" />
          引用
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              background: "rgba(255,255,255,0.72)",
              color: copied ? "#34C759" : "#0A62D0",
              boxShadow: copied ? "var(--rc-chip-inset-shadow)" : "var(--rc-chip-shadow)",
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "已复制" : "复制"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-xl text-ink-tertiary transition-colors hover:text-ink-primary"
            style={{ background: "rgba(255,255,255,0.72)", boxShadow: "var(--rc-chip-shadow)" }}
            aria-label="关闭引用面板"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {PAPER_CITATION_FORMATS.map((item) => {
          const active = item.value === format;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFormat(item.value)}
              className="rounded-xl px-2.5 py-1 text-[11px] transition-all"
              style={{
                background: active ? "#007AFF" : "rgba(255,255,255,0.72)",
                color: active ? "#fff" : "var(--rc-text-secondary)",
                boxShadow: active ? "inset 1px 1px 3px rgba(0,0,0,0.18)" : "var(--rc-chip-shadow)",
                fontWeight: active ? 700 : 500,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <pre
        className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-xs leading-5 text-ink-secondary"
        style={{ background: "rgba(255,255,255,0.78)", boxShadow: "var(--rc-chip-inset-shadow)" }}
      >
        {citation}
      </pre>
    </div>
  );
}

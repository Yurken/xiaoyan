import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Eraser,
  FileText,
  PenLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
import katex from "katex";

const DEFAULT_TEMPLATE = `\\section{Introduction}
Large language models (LLMs) have achieved remarkable success in various natural language processing tasks. The core idea can be formulated as:
$$\\mathcal{P}(y \\mid x) = \\prod_{t=1}^{T} \\mathcal{P}(y_t \\mid y_{<t}, x; \\theta)$$
where $\\theta$ denotes the model parameters and $T$ is the sequence length.

\\section{Related Work}
\\subsection{Transformer Architecture}
The self-attention mechanism computes scaled dot-product attention:
$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$
Here $d_k$ is the dimension of the key vectors.

\\section{Methodology}
Our proposed approach optimizes the following objective:
$$\\mathcal{L}(\\theta) = \\mathbb{E}_{(x,y) \\sim \\mathcal{D}} [ -\\log \\mathcal{P}_\\theta(y \\mid x) ] + \\lambda \\|\\theta\\|_2^2$$
where $\\lambda > 0$ is the regularization coefficient.

\\section{Experiments}
We evaluate our method on standard benchmarks. The results demonstrate significant improvements over baseline approaches.

\\section{Conclusion}
In this paper, we presented a novel approach for ...`;

const SNIPPETS = [
  { label: "分数", code: "\\frac{a}{b}" },
  { label: "上标", code: "x^{2}" },
  { label: "下标", code: "x_{i}" },
  { label: "求和", code: "\\sum_{i=1}^{n} x_i" },
  { label: "积分", code: "\\int_{0}^{\\infty} f(x) \\, dx" },
  { label: "极限", code: "\\lim_{n \\to \\infty} a_n" },
  { label: "矩阵", code: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { label: "偏导", code: "\\frac{\\partial f}{\\partial x}" },
  { label: "范数", code: "\\|x\\|_2" },
  { label: "集合", code: "\\{ x \\in \\mathbb{R}^n \\mid \\|x\\| \\leq 1 \\}" },
];

function LatexPreview({ source }: { source: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    // Split by block math first ($$...$$)
    const segments: Array<{ type: "text" | "block" | "inline"; content: string }> = [];
    const blockRegex = /\$\$([\s\S]*?)\$\$/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(source)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: "text", content: source.slice(lastIndex, match.index) });
      }
      segments.push({ type: "block", content: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < source.length) {
      segments.push({ type: "text", content: source.slice(lastIndex) });
    }

    // For text segments, further split inline math ($...$)
    const finalSegments: Array<{ type: "text" | "block" | "inline"; content: string }> = [];
    for (const seg of segments) {
      if (seg.type !== "text") {
        finalSegments.push(seg);
        continue;
      }
      const inlineRegex = /\$([\s\S]*?)\$/g;
      let inlineLast = 0;
      let inlineMatch: RegExpExecArray | null;
      while ((inlineMatch = inlineRegex.exec(seg.content)) !== null) {
        if (inlineMatch.index > inlineLast) {
          finalSegments.push({ type: "text", content: seg.content.slice(inlineLast, inlineMatch.index) });
        }
        finalSegments.push({ type: "inline", content: inlineMatch[1].trim() });
        inlineLast = inlineMatch.index + inlineMatch[0].length;
      }
      if (inlineLast < seg.content.length) {
        finalSegments.push({ type: "text", content: seg.content.slice(inlineLast) });
      }
    }

    return finalSegments;
  }, [source]);

  const renderLatex = useCallback((content: string, displayMode: boolean): string => {
    try {
      return katex.renderToString(content, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span style="color:#FF3B30">${content}</span>`;
    }
  }, []);

  return (
    <div ref={containerRef} className="rc-selectable h-full overflow-y-auto p-4 text-sm leading-7 text-ink-secondary">
      {html.map((seg, idx) => {
        if (seg.type === "block") {
          return (
            <div
              key={idx}
              className="my-4 flex justify-center overflow-x-auto rounded-2xl border border-nm-dark/10 bg-white/30 p-4"
              dangerouslySetInnerHTML={{ __html: renderLatex(seg.content, true) }}
            />
          );
        }
        if (seg.type === "inline") {
          return (
            <span
              key={idx}
              dangerouslySetInnerHTML={{ __html: renderLatex(seg.content, false) }}
            />
          );
        }
        // text: convert line breaks to paragraphs
        return (
          <span key={idx}>
            {seg.content.split("\n").map((line, lineIdx, arr) => {
              const isHeading = line.match(/^\\(section|subsection|subsubsection)\{(.*)\}$/);
              if (isHeading) {
                const level = isHeading[1];
                const text = isHeading[2];
                const headingClass =
                  level === "section"
                    ? "text-lg font-bold text-ink-primary mt-5 mb-2"
                    : level === "subsection"
                      ? "text-base font-semibold text-ink-primary mt-4 mb-1.5"
                      : "text-sm font-semibold text-ink-primary mt-3 mb-1";
                return (
                  <div key={lineIdx} className={headingClass}>
                    {text}
                  </div>
                );
              }

              const trimmed = line.trim();
              if (trimmed.startsWith("\\begin{")) {
                // Skip raw environment tags in preview (KaTeX handles matrix etc via inline)
                return null;
              }
              if (trimmed.startsWith("\\end{")) {
                return null;
              }
              if (trimmed === "" && lineIdx < arr.length - 1) {
                return <div key={lineIdx} className="h-2" />;
              }
              if (trimmed === "") return null;
              return (
                <p key={lineIdx} className="my-1">
                  {line}
                </p>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

export default function SurveyLatexEditor() {
  const [source, setSource] = usePersistentLatexState("rc:survey:latex:source", DEFAULT_TEMPLATE);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsert = useCallback(
    (code: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = source.slice(0, start);
      const after = source.slice(end);
      const inserted = `${before}$${code}$${after}`;
      setSource(inserted);
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = start + 1 + code.length + 1;
        textarea.setSelectionRange(newPos, newPos);
      });
    },
    [source, setSource]
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(source);
  }, [source]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([source], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "survey.tex";
    a.click();
    URL.revokeObjectURL(url);
  }, [source]);

  const handleReset = useCallback(() => {
    setSource(DEFAULT_TEMPLATE);
  }, [setSource]);

  const handleClear = useCallback(() => {
    setSource("");
  }, [setSource]);

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Control Bar */}
      <Card padding="md" className="flex flex-col gap-4 !bg-rc-surface shadow-rc-raised">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue">
              <PenLine className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-ink-primary">写作工作台</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-tertiary">专业级学术编辑</div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy} className="!rounded-xl shadow-rc-flat hover:shadow-rc-raised">
              <Copy className="h-3.5 w-3.5" />
              复制源码
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownload} className="!rounded-xl shadow-rc-flat hover:shadow-rc-raised">
              <Download className="h-3.5 w-3.5" />
              下载 .tex
            </Button>
            <div className="w-px h-4 bg-nm-dark/10 mx-1" />
            <Button variant="secondary" size="sm" onClick={handleReset} className="!rounded-xl shadow-rc-flat hover:text-apple-blue">
              <RotateCcw className="h-3.5 w-3.5" />
              重置
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClear} className="!rounded-xl shadow-rc-flat hover:text-apple-red">
              <Eraser className="h-3.5 w-3.5" />
              清空
            </Button>
          </div>
        </div>

        {/* Snippets Area */}
        <div className="flex items-center gap-3 rounded-2xl bg-rc-bg/50 p-2.5 shadow-rc-inset">
          <span className="shrink-0 pl-1 text-[11px] font-bold uppercase tracking-wider text-ink-tertiary">
            数学公式：
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {SNIPPETS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => handleInsert(s.code)}
                className="group flex items-center gap-1.5 rounded-lg border border-transparent bg-rc-surface px-2.5 py-1 text-[11px] font-medium text-ink-secondary transition-all hover:border-apple-blue/20 hover:bg-white hover:text-apple-blue hover:shadow-rc-flat"
              >
                <span className="text-[10px] text-ink-tertiary group-hover:text-apple-blue/60">$</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Editor + Preview Split */}
      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-2">
        <Card padding="none" className="flex min-h-0 flex-col overflow-hidden !bg-rc-surface shadow-rc-raised border-white/5">
          <div className="flex items-center justify-between border-b border-nm-dark/5 bg-white/30 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-ink-tertiary" />
              <span className="text-xs font-bold uppercase tracking-widest text-ink-tertiary">LaTeX 源码</span>
            </div>
            <div className="flex h-2 w-2 rounded-full bg-apple-blue/40" />
          </div>
          <textarea
            ref={textareaRef}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-7 text-ink-primary outline-none placeholder:text-ink-tertiary/40"
            spellCheck={false}
            placeholder="在此输入 LaTeX 源码..."
          />
        </Card>

        <Card padding="none" className="flex min-h-0 flex-col overflow-hidden !bg-white shadow-rc-raised border-transparent">
          <div className="flex items-center justify-between border-b border-nm-dark/5 bg-rc-bg/5 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-apple-blue" />
              <span className="text-xs font-bold uppercase tracking-widest text-ink-tertiary">文稿预览</span>
            </div>
            <div className="flex h-2 w-2 rounded-full bg-apple-green/40" />
          </div>
          <div className="flex-1 overflow-hidden bg-white/50">
            <LatexPreview source={source} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function usePersistentLatexState(key: string, fallback: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ?? fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }, [key, value]);

  return [value, setValue] as const;
}

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, FileText, X } from "lucide-react";
import { Badge, MarkdownRenderer } from "@research-copilot/ui";
import type { Paper } from "@research-copilot/types";
import { findReferencedFigures, type PaperFigure } from "./shared";

const ANALYSIS_SECTIONS: Array<{
  key: keyof NonNullable<Paper["analysis"]>;
  label: string;
  color: string;
  background: string;
}> = [
  { key: "research_question", label: "研究问题", color: "#007AFF", background: "rgba(0,122,255,0.05)" },
  { key: "core_method", label: "核心方法", color: "#AF52DE", background: "rgba(175,82,222,0.05)" },
  { key: "experiment_design", label: "实验设计", color: "#5856D6", background: "rgba(88,86,214,0.05)" },
  { key: "experiment_results", label: "实验结果", color: "#34C759", background: "rgba(52,199,89,0.05)" },
  { key: "innovations", label: "创新点", color: "#FF9500", background: "rgba(255,149,0,0.05)" },
  { key: "limitations", label: "局限性", color: "#FF3B30", background: "rgba(255,59,48,0.05)" },
  { key: "key_conclusions", label: "关键结论", color: "#00C7BE", background: "rgba(0,199,190,0.05)" },
];

const REPRODUCTION_SECTIONS: Array<[string, keyof NonNullable<Paper["reproduction_guide"]>]> = [
  ["代码仓库", "code_repository"],
  ["环境配置", "environment_setup"],
  ["依赖安装", "dependencies"],
  ["数据准备", "dataset_preparation"],
  ["训练流程", "training_process"],
  ["推理流程", "inference_process"],
  ["评估指标", "evaluation_metrics"],
  ["风险与注意事项", "risks_and_notes"],
];

interface PaperDetailModalProps {
  paper: Paper | null;
  figures: PaperFigure[];
  onClose: () => void;
}

async function copyMarkdownContent(content: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function PaperDetailModal({
  paper,
  figures,
  onClose,
}: PaperDetailModalProps) {
  const [visible, setVisible] = useState(false);
  const [copiedSectionKey, setCopiedSectionKey] = useState<string | null>(null);

  useEffect(() => {
    if (!paper) return undefined;

    setVisible(true);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setVisible(false);
        window.setTimeout(onClose, 220);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, paper]);

  useEffect(() => {
    if (!copiedSectionKey) return undefined;
    const timer = window.setTimeout(() => setCopiedSectionKey(null), 1400);
    return () => window.clearTimeout(timer);
  }, [copiedSectionKey]);

  const analysisSections = useMemo(() => {
    if (!paper?.analysis) return [];
    return ANALYSIS_SECTIONS
      .map((section) => {
        const content = String(paper.analysis?.[section.key] ?? "").trim();
        if (!content) return null;
        return {
          ...section,
          content,
          figures: findReferencedFigures(content, figures),
        };
      })
      .filter((section): section is NonNullable<typeof section> => section !== null);
  }, [figures, paper]);

  const reproductionSections = useMemo(() => {
    if (!paper?.reproduction_guide) return [];
    return REPRODUCTION_SECTIONS
      .map(([label, key]) => {
        const content = String(paper.reproduction_guide?.[key] ?? "").trim();
        if (!content || content === "暂无") return null;
        return { label, content };
      })
      .filter((section): section is NonNullable<typeof section> => section !== null);
  }, [paper]);

  if (!paper) return null;

  const handleClose = () => {
    setVisible(false);
    window.setTimeout(onClose, 220);
  };

  const handleCopy = async (sectionKey: string, content: string) => {
    await copyMarkdownContent(content);
    setCopiedSectionKey(sectionKey);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{
        background: visible ? "rgba(15, 23, 42, 0.18)" : "rgba(15, 23, 42, 0)",
        transition: "background 0.22s ease",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paper-detail-title"
        className="flex h-[min(92vh,980px)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px]"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,250,0.98) 100%)",
          boxShadow: "0 20px 70px rgba(15,23,42,0.18)",
          transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.985)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease",
        }}
      >
        <div
          className="flex flex-shrink-0 items-start justify-between gap-3 border-b px-5 py-4 sm:px-6"
          style={{ borderColor: "rgba(15,23,42,0.08)", background: "rgba(255,255,255,0.78)" }}
        >
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={paper.status === "failed" || paper.status === "error" ? "danger" : paper.status === "analyzing" ? "info" : "success"}>
                {paper.status === "failed" || paper.status === "error"
                  ? "失败"
                  : paper.status === "analyzing"
                    ? "分析中"
                    : "详情"}
              </Badge>
              {paper.year ? <span className="text-xs text-ink-tertiary">{paper.year}</span> : null}
              {paper.venue ? <span className="text-xs text-ink-tertiary">{paper.venue}</span> : null}
            </div>
            <div className="space-y-1">
              <h2 id="paper-detail-title" className="text-lg font-semibold leading-tight text-ink-primary sm:text-[22px]">
                {paper.title}
              </h2>
              {paper.authors ? (
                <p className="text-sm leading-6 text-ink-tertiary">{paper.authors}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl transition-colors hover:text-ink-primary"
            style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)", color: "var(--rc-text-secondary)" as string }}
            aria-label="关闭详情弹窗"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid h-full min-h-0 gap-5 [grid-template-rows:minmax(0,1.2fr)_minmax(0,0.8fr)] lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.95fr)] lg:[grid-template-rows:minmax(0,1fr)]">
            <section className="flex min-h-0 flex-col overflow-hidden">
              <div className="flex items-center gap-2 px-0.5">
                <Eye className="h-4 w-4 text-[#007AFF]" />
                <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-tertiary uppercase">模型解读详情</p>
              </div>
              <div className="mt-3 min-h-0 space-y-3 overflow-y-auto pr-1.5">
                {analysisSections.length > 0 ? (
                  analysisSections.map((section) => (
                    <article
                      key={section.key}
                      className="overflow-hidden rounded-[24px]"
                      style={{ background: section.background, borderLeft: `3px solid ${section.color}` }}
                    >
                      <div className="px-4 pb-4 pt-3 sm:px-5">
                        <div className="flex items-start justify-between gap-3">
                          <span
                            className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{ background: `${section.color}18`, color: section.color }}
                          >
                            {section.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCopy(`analysis-${section.key}`, section.content)}
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-medium transition-colors"
                            style={{
                              background: "rgba(255,255,255,0.72)",
                              color: copiedSectionKey === `analysis-${section.key}` ? section.color : "var(--rc-text-secondary)",
                              boxShadow: copiedSectionKey === `analysis-${section.key}` ? "var(--rc-chip-inset-shadow)" : "var(--rc-chip-shadow)",
                            }}
                            aria-label={`复制${section.label}的 Markdown 内容`}
                            title="复制 Markdown"
                          >
                            {copiedSectionKey === `analysis-${section.key}` ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                已复制
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                复制
                              </>
                            )}
                          </button>
                        </div>
                        <div className="mt-3">
                          <MarkdownRenderer content={section.content} />
                        </div>
                        {section.figures.length > 0 ? (
                          <div
                            className="mt-4 space-y-3 border-t pt-3"
                            style={{ borderColor: `${section.color}20` }}
                          >
                            {section.figures.map((figure) => (
                              <figure key={figure.id} className="space-y-1.5">
                                <img
                                  src={figure.data_url}
                                  alt={figure.caption ?? `${figure.kind === "table" ? "表" : "图"} ${figure.fig_index}`}
                                  title={figure.caption ?? undefined}
                                  loading="lazy"
                                  className="max-h-[380px] w-full rounded-2xl object-contain"
                                  style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${section.color}20` }}
                                />
                                {figure.caption ? (
                                  <figcaption className="px-1 text-[11px] leading-5 text-ink-tertiary">
                                    {figure.caption}
                                  </figcaption>
                                ) : null}
                              </figure>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <div
                    className="rounded-[24px] px-4 py-6 text-sm text-ink-tertiary"
                    style={{ background: "rgba(15,23,42,0.03)", boxShadow: "var(--rc-chip-inset-shadow)" }}
                  >
                    当前还没有可展示的论文解读内容。
                  </div>
                )}
              </div>
            </section>

            <aside className="flex min-h-0 flex-col overflow-hidden">
              <div className="flex items-center gap-2 px-0.5">
                <FileText className="h-4 w-4 text-[#007AFF]" />
                <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-tertiary uppercase">复现指南</p>
              </div>
              <div className="mt-3 min-h-0 space-y-3 overflow-y-auto pr-1.5">
                {reproductionSections.length > 0 ? (
                  reproductionSections.map((section) => (
                    <section
                      key={section.label}
                      className="overflow-hidden rounded-[22px]"
                      style={{ background: "rgba(0,122,255,0.04)", borderLeft: "3px solid rgba(0,122,255,0.4)" }}
                    >
                      <div className="px-4 pb-4 pt-3">
                        <div className="flex items-start justify-between gap-3">
                          <span
                            className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                          >
                            {section.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCopy(`reproduction-${section.label}`, section.content)}
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-medium transition-colors"
                            style={{
                              background: "rgba(255,255,255,0.72)",
                              color: copiedSectionKey === `reproduction-${section.label}` ? "#007AFF" : "var(--rc-text-secondary)",
                              boxShadow: copiedSectionKey === `reproduction-${section.label}` ? "var(--rc-chip-inset-shadow)" : "var(--rc-chip-shadow)",
                            }}
                            aria-label={`复制${section.label}的 Markdown 内容`}
                            title="复制 Markdown"
                          >
                            {copiedSectionKey === `reproduction-${section.label}` ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                已复制
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                复制
                              </>
                            )}
                          </button>
                        </div>
                        <div className="mt-3">
                          <MarkdownRenderer content={section.content} />
                        </div>
                      </div>
                    </section>
                  ))
                ) : (
                  <div
                    className="rounded-[22px] px-4 py-6 text-sm text-ink-tertiary"
                    style={{ background: "rgba(15,23,42,0.03)", boxShadow: "var(--rc-chip-inset-shadow)" }}
                  >
                    当前还没有可展示的复现指南内容。
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Eye, FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@research-copilot/ui";
import type { Paper } from "@research-copilot/types";
import { useThemeStyle } from "../../hooks/useThemeStyle";

interface PaperCompactRowProps {
  paper: Paper;
  detailPaperId: string | null;
  onAnalyze: (id: string) => void;
  onReproduce: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
}

const canStartAnalyze = (status: string) => !["analyzing", "parsing", "uploaded"].includes(status);
const requiresReanalyzeConfirm = (paper: Paper) => paper.status === "analyzed" || paper.status === "reproduced";

/** 行内元信息：作者 · 年份 · 期刊/会议，极简下与标题同一行排布。 */
function buildMeta(paper: Paper): string {
  return [paper.authors, paper.year ? String(paper.year) : "", paper.venue]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" · ");
}

export default function PaperCompactRow({
  paper,
  detailPaperId,
  onAnalyze,
  onReproduce,
  onOpenDetail,
  onCloseDetail,
}: PaperCompactRowProps) {
  const navigate = useNavigate();
  const [confirmReanalyze, setConfirmReanalyze] = useState(false);
  const hasReproductionResult = paper.status === "reproduced" || Boolean(paper.reproduction_guide);
  const hasDetail = Boolean(paper.analysis || paper.reproduction_guide || ["parsed", "failed", "error"].includes(paper.status));
  // 行内元信息与重要度圆点是极简清单专用的新增内容，拟态保持改造前的 DOM 结构。
  const isMinimalStyle = useThemeStyle() === "modern-minimal";
  const meta = isMinimalStyle ? buildMeta(paper) : "";

  const openReader = () => navigate(`/papers/${paper.id}/reader`);

  const startAnalyze = () => {
    if (requiresReanalyzeConfirm(paper)) {
      setConfirmReanalyze(true);
      return;
    }
    onAnalyze(paper.id);
  };

  // 拟态保持改造前的 DOM：标题直接作为行内的 flex 子项；
  // 极简才把标题与元信息包进一列，让两行文本上下叠放。
  const titleExtraClassName = isMinimalStyle ? "block w-full" : "min-w-0 flex-1";
  const titleNode = paper.file_path ? (
    <button
      type="button"
      onClick={openReader}
      className={`rc-list-row__title ${titleExtraClassName} truncate text-left text-sm font-semibold text-ink-primary transition-colors hover:text-apple-blue`}
      title="打开批注阅读"
    >
      {paper.title}
    </button>
  ) : (
    <span className={`rc-list-row__title ${titleExtraClassName} truncate text-sm font-semibold text-ink-primary`}>
      {paper.title}
    </span>
  );

  return (
    <article
      data-paper-compact-row
      data-testid="paper-compact-row"
      className="group rc-list-row relative flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors"
      style={{
        background: "var(--rc-card-bg)",
        borderColor: "var(--rc-card-outline)",
        boxShadow: "var(--rc-card-shadow)",
      }}
    >
      {isMinimalStyle && paper.importance_color ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: paper.importance_color }}
        />
      ) : null}

      {isMinimalStyle ? (
        <div className="min-w-0 flex-1">
          {titleNode}
          {meta ? <p className="rc-list-row__meta mt-0.5 truncate text-xs text-ink-tertiary">{meta}</p> : null}
        </div>
      ) : (
        titleNode
      )}

      <div
        className="rc-list-row__actions flex flex-shrink-0 items-center gap-1"
        aria-label={`${paper.title} 的操作`}
      >
        {paper.file_path ? (
          <button
            type="button"
            onClick={openReader}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-tertiary transition-colors hover:text-apple-blue"
            title="阅读论文"
            aria-label={`阅读 ${paper.title}`}
          >
            <BookOpen className="h-4 w-4" />
          </button>
        ) : null}
        <Button
          size="sm"
          onClick={startAnalyze}
          disabled={!canStartAnalyze(paper.status)}
          className={
            paper.status === "analyzed" || paper.status === "reproduced"
              ? "rc-tone-success h-8 whitespace-nowrap px-2.5"
              : "h-8 whitespace-nowrap px-2.5"
          }
          style={paper.status === "analyzed" || paper.status === "reproduced" ? { background: "#34C759", borderColor: "#34C759" } : undefined}
        >
          {paper.status === "analyzing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {paper.status === "analyzing" ? "分析中…" : paper.status === "parsing" ? "解析中…" : paper.status === "analyzed" || paper.status === "reproduced" ? "已解读" : "解读"}
        </Button>
        <button
          type="button"
          onClick={() => onReproduce(paper.id)}
          disabled={!canStartAnalyze(paper.status)}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-tertiary transition-colors hover:text-apple-blue disabled:opacity-40"
          title={hasReproductionResult ? "已生成复现/验证指南" : "生成复现/验证指南"}
          aria-label={`${paper.title}：${hasReproductionResult ? "已生成复现/验证指南" : "生成复现/验证指南"}`}
        >
          <FlaskConical className="h-4 w-4" style={{ color: hasReproductionResult ? "#34C759" : undefined }} />
        </button>
        {hasDetail ? (
          <button
            type="button"
            onClick={() => detailPaperId === paper.id ? onCloseDetail() : onOpenDetail(paper.id)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-tertiary transition-colors hover:text-apple-blue"
            title={detailPaperId === paper.id ? "关闭详情" : "查看详情"}
            aria-label={detailPaperId === paper.id ? `关闭 ${paper.title} 详情` : `查看 ${paper.title} 详情`}
          >
            <Eye className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {confirmReanalyze ? (
        <div className="absolute right-3 top-full z-10 mt-1 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-card-shadow)" }}>
          <span className="text-xs text-ink-secondary">已有解读，重新解读？</span>
          <button type="button" onClick={() => setConfirmReanalyze(false)} className="text-xs text-ink-tertiary hover:text-ink-primary">取消</button>
          <button type="button" onClick={() => { onAnalyze(paper.id); setConfirmReanalyze(false); }} className="text-xs font-medium text-apple-blue hover:underline">确认</button>
        </div>
      ) : null}
    </article>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Eye, FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@research-copilot/ui";
import type { Paper } from "@research-copilot/types";

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

  const openReader = () => navigate(`/papers/${paper.id}/reader`);

  const startAnalyze = () => {
    if (requiresReanalyzeConfirm(paper)) {
      setConfirmReanalyze(true);
      return;
    }
    onAnalyze(paper.id);
  };

  return (
    <article
      data-paper-compact-row
      data-testid="paper-compact-row"
      className="group relative flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors"
      style={{
        background: "var(--rc-card-bg)",
        borderColor: "var(--rc-card-outline)",
        boxShadow: "var(--rc-card-shadow)",
      }}
    >
      {paper.file_path ? (
        <button
          type="button"
          onClick={openReader}
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink-primary transition-colors hover:text-apple-blue"
          title="打开批注阅读"
        >
          {paper.title}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-primary">{paper.title}</span>
      )}

      <div className="flex flex-shrink-0 items-center gap-1" aria-label={`${paper.title} 的操作`}>
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
          className="h-8 whitespace-nowrap px-2.5"
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

import { AlertTriangle, ClipboardList, Link, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "@research-copilot/ui";
import EvidenceDrawer from "../research-context/EvidenceDrawer";
import {
  DIAGNOSIS_RISK_CFG,
  getDiagnosisReportIssues,
  type SubmissionDiagnosisReport,
} from "./shared";

interface DiagnosisReportPanelProps {
  reports: SubmissionDiagnosisReport[];
  loading: boolean;
  importingReportId: string | null;
  importingTaskReportId: string | null;
  onImportReport: (reportId: string) => void | Promise<void>;
  onImportTasks: (reportId: string) => void | Promise<void>;
}

function formatReportDate(date: Date): string {
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DiagnosisReportPanel({
  reports,
  loading,
  importingReportId,
  importingTaskReportId,
  onImportReport,
  onImportTasks,
}: DiagnosisReportPanelProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const latest = reports[0];

  return (
    <Card padding="md" variant="flat" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-ink-tertiary" />
            <p className="font-semibold text-ink-primary">投稿前诊断</p>
          </div>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            {latest ? `${reports.length} 份报告 · 最近 ${formatReportDate(latest.createdAt)}` : "暂无报告"}
          </p>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-ink-tertiary" /> : null}
          {latest && (
            <button
              type="button"
              onClick={() => setEvidenceOpen(true)}
              className="flex h-7 items-center gap-1 rounded-xl px-2 text-[11px] font-medium transition-colors hover:text-ink-primary"
              style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)", color: "var(--rc-text-secondary)" as string }}
              title="查看证据链"
            >
              <Link className="h-3 w-3" />
              证据
            </button>
          )}
      </div>

      {!latest ? (
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-card-inset-outline)" }}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-ink-tertiary" />
          <p className="text-xs leading-5 text-ink-tertiary">
            暂无诊断报告。后续风险问题会在这里归档。
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.slice(0, 3).map((report) => {
            const riskStyle = DIAGNOSIS_RISK_CFG[report.riskLevel];
            const issues = getDiagnosisReportIssues(report, 3);
            const importing = importingReportId === report.id;
            const importingTasks = importingTaskReportId === report.id;

            return (
              <div
                key={report.id}
                className="rounded-2xl px-3 py-2.5"
                style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-card-inset-outline)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-lg px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: riskStyle.bg, color: riskStyle.color }}
                      >
                        {riskStyle.label}
                      </span>
                      <span className="text-[11px] text-ink-tertiary">{formatReportDate(report.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-secondary">{report.summary}</p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={importing}
                      onClick={() => void onImportReport(report.id)}
                    >
                      {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
                      转清单
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={importingTasks}
                      onClick={() => void onImportTasks(report.id)}
                    >
                      {importingTasks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
                      转任务
                    </Button>
                  </div>
                </div>
                {issues.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {issues.map((issue) => (
                      <span
                        key={issue}
                        className="max-w-full truncate rounded-lg px-2 py-1 text-[11px] text-ink-secondary"
                        style={{ background: "var(--rc-chip-bg)" }}
                      >
                        {issue}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
      <EvidenceDrawer
        targetId={latest?.submissionId ?? ""}
        targetType="submission_diagnosis"
        isOpen={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
      />
  );
}

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  FileUp,
  Info,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardSection,
  Input,
  Select,
} from "@research-copilot/ui";
import {
  DOCUMENT_TEMPLATES,
  type DocumentCheckCategory,
  type DocumentCheckSeverity,
} from "./shared";
import { useDocumentChecker } from "./useDocumentChecker";

const CATEGORY_LABELS: Record<DocumentCheckCategory, string> = {
  page: "页面",
  font: "字体字号",
  heading: "标题层级",
  figure: "图表编号",
  citation: "参考文献",
  hidden: "隐藏内容",
};

const SEVERITY_META: Record<DocumentCheckSeverity, {
  label: string;
  variant: "danger" | "warning" | "info";
  icon: typeof AlertCircle;
  color: string;
}> = {
  error: { label: "严重", variant: "danger", icon: AlertCircle, color: "var(--rc-danger, #D92B21)" },
  warning: { label: "警告", variant: "warning", icon: TriangleAlert, color: "var(--rc-warning, #C07000)" },
  info: { label: "提示", variant: "info", icon: Info, color: "var(--rc-accent)" },
};

function NumberRule({
  label,
  value,
  onChange,
  suffix = "mm",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <Input
      type="number"
      min="0"
      step="0.1"
      label={`${label} (${suffix})`}
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      className="tabular-nums"
    />
  );
}

function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm text-apple-red"
      style={{
        background: "color-mix(in srgb, var(--rc-card-inset-bg) 88%, var(--rc-danger, #FF3B30) 12%)",
        borderColor: "color-mix(in srgb, var(--rc-danger, #FF3B30) 24%, var(--rc-border))",
        boxShadow: "var(--rc-card-inset-shadow)",
      }}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default function DocumentCheckerWorkspace() {
  const checker = useDocumentChecker();
  const [severityFilter, setSeverityFilter] = useState<"all" | DocumentCheckSeverity>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | DocumentCheckCategory>("all");
  const filteredIssues = useMemo(
    () => checker.report?.issues.filter((issue) => (
      (severityFilter === "all" || issue.severity === severityFilter)
      && (categoryFilter === "all" || issue.category === categoryFilter)
    )) ?? [],
    [categoryFilter, checker.report, severityFilter],
  );

  return (
    <div className="space-y-5">
      <Card padding="lg" className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <FileCheck2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-primary">论文与申请材料格式校验</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-tertiary">
              本地解析 PDF / DOCX，检查页面、字体字号、页码、图表、参考文献和修订残留；文件不会上传。
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {DOCUMENT_TEMPLATES.map((template) => {
            const active = checker.templateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                aria-pressed={active}
                onClick={() => checker.setTemplateId(template.id)}
                className="rounded-2xl border p-3 text-left transition-[transform,box-shadow,border-color,background-color] duration-150 hover:-translate-y-px active:translate-y-0"
                style={{
                  borderColor: active
                    ? "color-mix(in srgb, var(--rc-accent) 34%, var(--rc-border))"
                    : "var(--rc-card-outline)",
                  background: active ? "var(--rc-card-inset-bg)" : "var(--rc-chip-bg)",
                  boxShadow: active ? "var(--rc-card-inset-shadow)" : "var(--rc-chip-shadow)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-primary">{template.name}</span>
                  {active ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-apple-blue" /> : null}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-ink-tertiary">{template.description}</p>
              </button>
            );
          })}
        </div>

        {checker.templateId === "custom" ? (
          <Card variant="inset" padding="md">
            <p className="mb-4 text-xs font-semibold text-ink-secondary">自定义页面与正文规则</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <NumberRule label="页面宽度" value={checker.customRules.pageWidthMm} onChange={(value) => checker.updateRule("pageWidthMm", value)} />
              <NumberRule label="页面高度" value={checker.customRules.pageHeightMm} onChange={(value) => checker.updateRule("pageHeightMm", value)} />
              <NumberRule label="上边距" value={checker.customRules.marginTopMm} onChange={(value) => checker.updateRule("marginTopMm", value)} />
              <NumberRule label="下边距" value={checker.customRules.marginBottomMm} onChange={(value) => checker.updateRule("marginBottomMm", value)} />
              <NumberRule label="左边距" value={checker.customRules.marginLeftMm} onChange={(value) => checker.updateRule("marginLeftMm", value)} />
              <NumberRule label="右边距" value={checker.customRules.marginRightMm} onChange={(value) => checker.updateRule("marginRightMm", value)} />
              <Input
                label="正文字体"
                value={checker.customRules.bodyFont}
                onChange={(event) => checker.updateRule("bodyFont", event.target.value)}
              />
              <NumberRule label="正文字号" value={checker.customRules.bodyFontSizePt} onChange={(value) => checker.updateRule("bodyFontSizePt", value)} suffix="pt" />
            </div>
          </Card>
        ) : null}

        <Card variant="flat" padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-primary">{checker.fileName || "尚未选择文档"}</p>
            <p className="mt-1 text-xs text-ink-tertiary">支持可复制文字的 PDF 与标准 .docx 文件</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void checker.chooseFile()}>
              <FileUp className="h-4 w-4" />
              选择文档
            </Button>
            <Button onClick={() => void checker.runCheck()} loading={checker.loading} disabled={!checker.fileName}>
              <ShieldCheck className="h-4 w-4" />
              开始校验
            </Button>
          </div>
        </Card>

        <ErrorNotice message={checker.error} />
        <p className="text-xs leading-5 text-ink-tertiary">
          预设是通用自查基线，不代表学校、基金委或期刊的最新正式要求；提交前仍应以目标单位当期模板为准。
        </p>
      </Card>

      {checker.report ? (
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card padding="md">
              <h3 className="text-sm font-semibold text-ink-primary">文档概览</h3>
              <dl className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-ink-tertiary">类型</dt><dd className="font-medium uppercase text-ink-secondary">{checker.report.inspection.fileType}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-tertiary">页数</dt><dd className="font-medium tabular-nums text-ink-secondary">{checker.report.inspection.pageCount ?? "未识别"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-tertiary">页面尺寸</dt><dd className="text-right font-medium tabular-nums text-ink-secondary">{checker.report.inspection.pageWidthMm && checker.report.inspection.pageHeightMm ? `${checker.report.inspection.pageWidthMm.toFixed(1)} × ${checker.report.inspection.pageHeightMm.toFixed(1)} mm` : "未识别"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-tertiary">字体</dt><dd className="max-w-[180px] text-right font-medium text-ink-secondary">{checker.report.inspection.fonts.slice(0, 4).join("、") || "未识别"}</dd></div>
              </dl>
            </Card>

            <Card padding="md">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-apple-green" />
                <h3 className="text-sm font-semibold text-ink-primary">通过项</h3>
                <Badge variant="success">{checker.report.passed.length}</Badge>
              </div>
              <CardSection>
                {checker.report.passed.length > 0 ? (
                  <ul className="space-y-2 text-xs leading-5 text-ink-tertiary">
                    {checker.report.passed.map((item) => <li key={item}>✓ {item}</li>)}
                  </ul>
                ) : <p className="text-xs text-ink-tertiary">暂无明确通过项。</p>}
              </CardSection>
            </Card>
          </div>

          <Card padding="md" className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">分类审校报告</h3>
                <p className="mt-1 text-xs text-ink-tertiary">共发现 {checker.report.issues.length} 项需要关注的问题。</p>
              </div>
              <div className="grid min-w-[280px] grid-cols-2 gap-2 max-sm:min-w-0 max-sm:w-full">
                <Select
                  aria-label="筛选严重程度"
                  value={severityFilter}
                  onChange={(value) => setSeverityFilter(value as typeof severityFilter)}
                  options={[
                    { value: "all", label: "全部严重程度" },
                    { value: "error", label: "严重" },
                    { value: "warning", label: "警告" },
                    { value: "info", label: "提示" },
                  ]}
                />
                <Select
                  aria-label="筛选问题类别"
                  value={categoryFilter}
                  onChange={(value) => setCategoryFilter(value as typeof categoryFilter)}
                  options={[
                    { value: "all", label: "全部类别" },
                    ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
            </div>

            <CardSection>
              {filteredIssues.length > 0 ? (
                <div>
                  {filteredIssues.map((issue, index) => {
                    const meta = SEVERITY_META[issue.severity];
                    const Icon = meta.icon;
                    return (
                      <article
                        key={issue.id}
                        className="py-4 first:pt-0 last:pb-0"
                        style={index > 0 ? { borderTop: "1px solid var(--rc-border)" } : undefined}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                            style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-card-inset-shadow)", color: meta.color }}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={meta.variant}>{meta.label}</Badge>
                              <Badge>{CATEGORY_LABELS[issue.category]}</Badge>
                              {issue.location ? <span className="text-[11px] text-ink-tertiary">{issue.location}</span> : null}
                            </div>
                            <p className="mt-2 text-sm font-medium leading-6 text-ink-primary">{issue.message}</p>
                            <p className="mt-1 text-xs leading-5 text-ink-tertiary">建议：{issue.suggestion}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Card variant="inset" padding="lg" className="text-center">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-apple-green" />
                  <p className="mt-2 text-sm font-medium text-ink-secondary">当前筛选下没有问题</p>
                </Card>
              )}
            </CardSection>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

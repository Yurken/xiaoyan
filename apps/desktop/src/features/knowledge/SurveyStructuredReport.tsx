import type { ReactNode } from "react";
import { Card } from "@research-copilot/ui";
import ExternalLink from "../../components/ExternalLink";
import { buildPaperSearchUrl } from "../../lib/links";
import { CITATION_FORMATS, type StructuredSurveyResult } from "./shared";

interface SurveyStructuredReportProps {
  structured: StructuredSurveyResult;
  fallbackCitationFormatLabel: string;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">{children}</p>;
}

function LinkedTitleList({ titles }: { titles?: string[] }) {
  if (!titles?.length) return null;
  return (
    <>
      {titles.map((title, index) => (
        <span key={`${title}-${index}`}>
          {index > 0 ? "；" : ""}
          <ExternalLink href={buildPaperSearchUrl(title)} className="text-[11px] text-ink-tertiary hover:text-apple-blue hover:underline">
            {title}
          </ExternalLink>
        </span>
      ))}
    </>
  );
}

function PlainListSection({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <ul className="space-y-1.5 pl-4 text-sm leading-6 text-ink-secondary">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="list-disc">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SurveyStructuredReport({ structured, fallbackCitationFormatLabel }: SurveyStructuredReportProps) {
  const report = structured.report;

  return (
    <Card padding="sm" className="space-y-5">
      <div>
        <p className="text-lg font-semibold text-ink-primary">结构化综述</p>
        <p className="mt-1 text-xs text-ink-tertiary">研究问题：{structured.query}</p>
      </div>

      {report.background ? (
        <div>
          <SectionLabel>研究背景</SectionLabel>
          <p className="text-sm leading-relaxed text-ink-secondary">{report.background}</p>
        </div>
      ) : null}

      {report.development_timeline?.length ? (
        <div>
          <SectionLabel>发展脉络</SectionLabel>
          {report.earliest_period ? <p className="mb-2 text-xs italic text-ink-tertiary">{report.earliest_period}</p> : null}
          <div className="space-y-2">
            {report.development_timeline.map((stage, index) => (
              <div key={`${stage.period}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                <p className="text-sm font-semibold text-apple-blue">{stage.period}</p>
                <p className="mt-1 text-sm text-ink-primary">{stage.milestone}</p>
                {stage.key_works?.length ? (
                  <p className="mt-1.5 text-[11px] text-ink-tertiary">
                    代表工作：<LinkedTitleList titles={stage.key_works} />
                  </p>
                ) : null}
                {stage.significance ? <p className="mt-1 text-[11px] text-ink-tertiary">{stage.significance}</p> : null}
              </div>
            ))}
          </div>
          {report.current_frontier ? (
            <p className="mt-2 rounded-xl border border-apple-blue/20 bg-apple-blue/5 px-3 py-2 text-xs text-apple-blue">
              当前前沿：{report.current_frontier}
            </p>
          ) : null}
        </div>
      ) : null}

      {report.major_methods?.length ? (
        <div>
          <SectionLabel>主要方法</SectionLabel>
          <div className="space-y-2">
            {report.major_methods.map((method, index) => (
              <div key={`${method.name}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                <p className="text-sm font-medium text-ink-primary">{method.name || `方法 ${index + 1}`}</p>
                {method.description ? <p className="mt-1 text-xs leading-5 text-ink-secondary">{method.description}</p> : null}
                {method.pros || method.cons ? (
                  <p className="mt-2 text-[11px] text-ink-tertiary">
                    优势：{method.pros || "-"}；局限：{method.cons || "-"}
                  </p>
                ) : null}
                {method.representative_papers?.length ? (
                  <p className="mt-2 text-[11px] text-ink-tertiary">
                    代表论文：<LinkedTitleList titles={method.representative_papers} />
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {report.schools_of_thought?.length ? (
        <div>
          <SectionLabel>主要学派与流派</SectionLabel>
          <div className="space-y-2">
            {report.schools_of_thought.map((school, index) => (
              <div key={`${school.name}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                <p className="text-sm font-medium text-ink-primary">{school.name}</p>
                {school.description ? <p className="mt-1 text-xs leading-5 text-ink-secondary">{school.description}</p> : null}
                {school.representatives?.length ? (
                  <p className="mt-1.5 text-[11px] text-ink-tertiary">代表：{school.representatives.join("、")}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {report.methodology_summary ? (
        <div>
          <SectionLabel>研究方法总结</SectionLabel>
          <div className="space-y-1.5 rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
            {report.methodology_summary.mainstream ? (
              <p className="text-xs text-ink-secondary">
                <span className="font-medium text-ink-primary">主流：</span>
                {report.methodology_summary.mainstream}
              </p>
            ) : null}
            {report.methodology_summary.emerging ? (
              <p className="text-xs text-ink-secondary">
                <span className="font-medium text-ink-primary">新兴：</span>
                {report.methodology_summary.emerging}
              </p>
            ) : null}
            {report.methodology_summary.comparison ? (
              <p className="text-xs text-ink-secondary">
                <span className="font-medium text-ink-primary">对比：</span>
                {report.methodology_summary.comparison}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {report.research_trends?.length ? (
        <div>
          <SectionLabel>研究趋势</SectionLabel>
          <div className="space-y-2">
            {report.research_trends.map((trend, index) => (
              <div key={`${trend.trend}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                <p className="text-sm font-medium text-ink-primary">{trend.trend}</p>
                <p className="mt-1 text-xs leading-5 text-ink-secondary">{trend.signal}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {report.controversies?.length ? (
        <div>
          <SectionLabel>研究争议</SectionLabel>
          <div className="space-y-2">
            {report.controversies.map((controversy, index) => (
              <div key={`${controversy.topic}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                <p className="text-sm font-medium text-ink-primary">{controversy.topic}</p>
                {controversy.positions?.length ? (
                  <ul className="mt-1.5 space-y-0.5 pl-3">
                    {controversy.positions.map((position, positionIndex) => (
                      <li key={positionIndex} className="list-disc text-xs leading-5 text-ink-secondary">
                        {position}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <PlainListSection title="关键挑战" items={report.challenges} />

      {report.research_gaps?.length ? (
        <div>
          <SectionLabel>研究缺口</SectionLabel>
          <div className="space-y-1.5">
            {report.research_gaps.map((gap, index) => (
              <div key={`${gap}-${index}`} className="flex items-start gap-2 rounded-xl border border-apple-orange/20 bg-apple-orange/5 px-3 py-2">
                <span className="mt-0.5 flex-shrink-0 rounded-full bg-apple-orange/20 px-1.5 text-[10px] font-bold text-apple-orange">
                  {index + 1}
                </span>
                <p className="text-xs leading-5 text-ink-secondary">{gap}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <PlainListSection title="未来研究主题" items={report.future_directions} />

      {report.recommended_topics?.length ? (
        <div>
          <SectionLabel>建议研究主题</SectionLabel>
          <div className="grid gap-2 md:grid-cols-2">
            {report.recommended_topics.map((topic, index) => (
              <div key={`${topic.topic}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                <p className="text-sm font-medium text-ink-primary">{topic.topic}</p>
                {topic.why ? <p className="mt-1 text-xs leading-5 text-ink-secondary">{topic.why}</p> : null}
                {topic.first_step ? <p className="mt-2 text-[11px] text-ink-tertiary">第一步：{topic.first_step}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {report.overall_summary ? (
        <div>
          <SectionLabel>总结建议</SectionLabel>
          <p className="text-sm leading-relaxed text-ink-secondary">{report.overall_summary}</p>
        </div>
      ) : null}

      {structured.formatted_citations?.length ? (
        <div>
          <SectionLabel>
            参考文献（{CITATION_FORMATS.find((format) => format.value === structured.citation_format)?.label ?? fallbackCitationFormatLabel} 格式）
          </SectionLabel>
          <div className="space-y-1.5 rounded-2xl border border-nm-dark/10 bg-white/30 p-3">
            {structured.formatted_citations.map((citation) => (
              <p key={citation} className="text-[11px] leading-5 text-ink-secondary">
                {citation}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

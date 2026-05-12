import type { ReactNode } from "react";
import { AlertCircle, FileSearch, Loader2, Settings2 } from "lucide-react";
import { Button, Card, Input, Select } from "@research-copilot/ui";
import {
  CITATION_FORMATS,
  DATABASE_OPTIONS,
  LANGUAGE_OPTIONS,
  LIT_TYPE_OPTIONS,
  SURVEY_PAPER_LIMIT_PRESETS,
  researchInterestDisplayName,
} from "./shared";
import type { SurveyGenerationController } from "./useSurveyGeneration";

function ToggleChip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "rc-accent-chip" : "border-nm-dark/15 bg-white/40 text-ink-secondary hover:text-ink-primary"
      }`}
    >
      {label}
    </button>
  );
}

interface SurveyComposerPanelProps {
  controller: SurveyGenerationController;
  hideInterestPanel?: boolean;
}

export default function SurveyComposerPanel({ controller, hideInterestPanel = false }: SurveyComposerPanelProps) {
  const showInterestSelect = !hideInterestPanel && controller.interests.length > 0;

  return (
    <div className="space-y-3">
      <Card padding="sm" className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-primary">结构化文献综述生成</p>
            <p className="mt-1 text-xs leading-5 text-ink-tertiary">
              先规划检索范围，再整合本地论文库与外部学术源，生成可复制、可沉淀的综述初稿。
            </p>
          </div>
          {showInterestSelect ? (
            <Select
              className="w-48 flex-shrink-0"
              prefix="研究主题："
              value={controller.selectedInterestId}
              onChange={controller.selectInterest}
              options={[
                { value: "", label: "自由检索" },
                ...controller.interests.map((interest) => ({
                  value: interest.id,
                  label: researchInterestDisplayName(interest),
                })),
              ]}
              placeholder="选择研究主题"
              disabled={controller.generating}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            value={controller.query}
            onChange={(event) => controller.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void controller.handleGenerate();
            }}
            placeholder="请输入研究问题，例如：Transformer attention 机制的发展"
            disabled={controller.generating}
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => controller.setAdvancedOpen((value) => !value)}
              disabled={controller.generating}
              className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
                controller.advancedOpen
                  ? "rc-accent-chip"
                  : "border-nm-dark/15 bg-white/40 text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              生成参数
              {controller.hasAdvancedSettings && !controller.advancedOpen ? (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-apple-blue" />
              ) : null}
            </button>
            <Button onClick={() => void controller.handleGenerate()} loading={controller.generating} disabled={!controller.query.trim()}>
              <FileSearch className="h-4 w-4" />
              生成综述
            </Button>
          </div>
        </div>

        {controller.error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{controller.error}</span>
          </div>
        ) : null}
      </Card>

      {controller.selectedInterestId ? <SurveyPaperPicker controller={controller} /> : null}
      {controller.advancedOpen ? <SurveyAdvancedSettings controller={controller} /> : null}
    </div>
  );
}

function SurveyPaperPicker({ controller }: { controller: SurveyGenerationController }) {
  return (
    <Card padding="sm" className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-tertiary">
          该方向论文库
          {controller.interestPapers.length > 0 ? (
            <span className="ml-1 font-normal text-ink-tertiary/70">
              （{controller.selectedPaperIds.length}/{controller.interestPapers.length}）
            </span>
          ) : null}
        </p>
        {controller.interestPapers.length > 0 ? (
          <button type="button" onClick={controller.toggleAllPapers} className="text-[11px] text-apple-blue hover:underline">
            {controller.allPapersSelected ? "取消全选" : "全选"}
          </button>
        ) : null}
      </div>

      {controller.loadingPapers ? (
        <div className="flex items-center gap-1.5 py-2 text-xs text-ink-tertiary">
          <Loader2 className="h-3 w-3 animate-spin" />
          正在加载…
        </div>
      ) : controller.interestPapers.length === 0 ? (
        <p className="text-xs text-ink-tertiary">该研究主题下暂无论文。</p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-nm-dark/10">
          {controller.interestPapers.map((paper, index) => {
            const checked = controller.selectedPaperIds.includes(paper.id);
            const isLast = index === controller.interestPapers.length - 1;
            return (
              <label
                key={paper.id}
                className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors ${
                  isLast ? "" : "border-b border-nm-dark/8"
                } ${checked ? "bg-apple-blue/5" : "hover:bg-white/50"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={controller.generating}
                  onChange={() => controller.togglePaper(paper.id)}
                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-apple-blue"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs leading-4 text-ink-primary">{paper.title}</p>
                  {paper.year || paper.venue ? (
                    <p className="mt-0.5 truncate text-[11px] text-ink-tertiary">
                      {[paper.year, paper.venue].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {controller.selectedPaperLimitMessage ? (
        <p className="text-[11px] text-ink-tertiary">{controller.selectedPaperLimitMessage}</p>
      ) : controller.somePapersSelected ? (
        <p className="text-[11px] text-ink-tertiary">当前仅使用已勾选的 {controller.selectedPaperIds.length} 篇论文生成综述。</p>
      ) : controller.selectedInterestId && controller.selectedPaperIds.length === 0 ? (
        <p className="text-[11px] text-ink-tertiary">未勾选论文时会按研究问题重新检索候选文献。</p>
      ) : null}
    </Card>
  );
}

function SurveyAdvancedSettings({ controller }: { controller: SurveyGenerationController }) {
  return (
    <Card padding="sm" className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-apple-blue" />
        <p className="text-sm font-semibold text-ink-primary">综述生成参数</p>
        <p className="ml-1 text-xs text-ink-tertiary">以下参数会在点击“生成综述”后生效</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-ink-secondary">候选文献数量</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={5}
            max={50}
            value={controller.maxPapers}
            onChange={(event) => controller.setMaxPapers(event.target.value)}
            disabled={controller.generating}
            className="w-32"
          />
          {SURVEY_PAPER_LIMIT_PRESETS.map((count) => (
            <ToggleChip
              key={count}
              label={`${count} 篇`}
              selected={controller.maxPapers === String(count)}
              disabled={controller.generating}
              onClick={() => controller.setMaxPapers(String(count))}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-ink-secondary">文献时间范围</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={controller.timeFrom}
            onChange={(event) => controller.setTimeFrom(event.target.value)}
            placeholder="起始年份，如 2015"
            disabled={controller.generating}
            className="w-36"
          />
          <span className="text-xs text-ink-tertiary">至</span>
          <Input
            value={controller.timeTo}
            onChange={(event) => controller.setTimeTo(event.target.value)}
            placeholder="截止年份，如 2026"
            disabled={controller.generating}
            className="w-36"
          />
          {controller.timeFrom || controller.timeTo ? (
            <button
              type="button"
              onClick={() => {
                controller.setTimeFrom("");
                controller.setTimeTo("");
              }}
              className="text-xs text-ink-tertiary hover:text-ink-secondary"
            >
              清除
            </button>
          ) : null}
        </div>
      </div>

      <SurveyChipGroup title="文献类型" emptyText="未选择则不限类型">
        {LIT_TYPE_OPTIONS.map((option) => (
          <ToggleChip
            key={option.value}
            label={option.label}
            selected={controller.litTypes.includes(option.value)}
            disabled={controller.generating}
            onClick={() => controller.toggleLitType(option.value)}
          />
        ))}
      </SurveyChipGroup>

      <SurveyChipGroup title="检索数据库偏好" emptyText="未选择则不限数据库">
        {DATABASE_OPTIONS.map((database) => (
          <ToggleChip
            key={database}
            label={database}
            selected={controller.databases.includes(database)}
            disabled={controller.generating}
            onClick={() => controller.toggleDatabase(database)}
          />
        ))}
      </SurveyChipGroup>

      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <SurveyChipGroup title="参考文献格式">
          {CITATION_FORMATS.map((format) => (
            <ToggleChip
              key={format.value}
              label={format.label}
              selected={controller.citationFormat === format.value}
              disabled={controller.generating}
              onClick={() => controller.setCitationFormat(format.value)}
            />
          ))}
        </SurveyChipGroup>
        <SurveyChipGroup title="输出语言">
          {LANGUAGE_OPTIONS.map((option) => (
            <ToggleChip
              key={option.value}
              label={option.label}
              selected={controller.language === option.value}
              disabled={controller.generating}
              onClick={() => controller.setLanguage(option.value)}
            />
          ))}
        </SurveyChipGroup>
      </div>

      {controller.hasAdvancedSettings ? (
        <div className="rounded-xl border border-nm-dark/10 bg-white/40 px-3 py-2 text-[11px] text-ink-tertiary">
          <span>数量：{controller.effectiveMaxPapers} 篇　</span>
          {controller.timeFrom || controller.timeTo ? (
            <span>
              时间：{controller.timeFrom || "不限"} - {controller.timeTo || "至今"}　
            </span>
          ) : null}
          {controller.litTypes.length > 0 ? <span>类型：{controller.litTypes.join("、")}　</span> : null}
          {controller.databases.length > 0 ? <span>数据库：{controller.databases.join("、")}　</span> : null}
          <span>引用格式：{controller.citationFormatLabel}</span>
        </div>
      ) : null}
    </Card>
  );
}

function SurveyChipGroup({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-ink-secondary">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
      {emptyText ? <p className="mt-1 text-[11px] text-ink-tertiary">{emptyText}</p> : null}
    </div>
  );
}

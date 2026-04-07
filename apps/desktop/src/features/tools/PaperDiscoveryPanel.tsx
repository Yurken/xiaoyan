import type { KeyboardEvent } from "react";
import { AlertCircle, FileSearch, Globe2, Loader2, Sparkles } from "lucide-react";
import { Button, Card, Input, Textarea } from "@research-copilot/ui";
import type { ArxivRankingMode } from "@research-copilot/types";
import {
  ARXIV_MODE_OPTIONS,
  CS_GROUPS,
  DOMAIN_VENUES,
  NON_CS_KEYS,
  RANK_OPTIONS,
  computeStaticVenues,
  type RankKey,
} from "./shared";

const insetShadow = "var(--rc-inset-shadow)";
const raisedShadow = "var(--rc-raised-shadow)";

interface PaperDiscoveryPanelProps {
  topic: string;
  allTerms: string;
  titleTerms: string;
  abstractTerms: string;
  authors: string;
  commentsTerms: string;
  excludeTerms: string;
  selectedDomains: string[];
  venueType: "all" | "conference" | "journal";
  selectedRanks: RankKey[];
  venueFilterLoading: boolean;
  dynamicJournalTerms: string[];
  days: string;
  limit: string;
  mode: ArxivRankingMode;
  loading: boolean;
  error: string;
  hasSearchTerms: boolean;
  onTopicChange: (value: string) => void;
  onAllTermsChange: (value: string) => void;
  onTitleTermsChange: (value: string) => void;
  onAbstractTermsChange: (value: string) => void;
  onAuthorsChange: (value: string) => void;
  onCommentsTermsChange: (value: string) => void;
  onExcludeTermsChange: (value: string) => void;
  onDomainsChange: (value: string[]) => void;
  onVenueTypeChange: (value: "all" | "conference" | "journal") => void;
  onRanksChange: (value: RankKey[]) => void;
  onDaysChange: (value: string) => void;
  onLimitChange: (value: string) => void;
  onModeChange: (value: ArxivRankingMode) => void;
  onSubmit: () => void | Promise<void>;
}

export function PaperDiscoveryPanel({
  topic,
  allTerms,
  titleTerms,
  abstractTerms,
  authors,
  commentsTerms,
  excludeTerms,
  selectedDomains,
  venueType,
  selectedRanks,
  venueFilterLoading,
  dynamicJournalTerms,
  days,
  limit,
  mode,
  loading,
  error,
  hasSearchTerms,
  onTopicChange,
  onAllTermsChange,
  onTitleTermsChange,
  onAbstractTermsChange,
  onAuthorsChange,
  onCommentsTermsChange,
  onExcludeTermsChange,
  onDomainsChange,
  onVenueTypeChange,
  onRanksChange,
  onDaysChange,
  onLimitChange,
  onModeChange,
  onSubmit,
}: PaperDiscoveryPanelProps) {
  const currentMode = ARXIV_MODE_OPTIONS.find((item) => item.value === mode) ?? ARXIV_MODE_OPTIONS[0];
  const { categories, journalTerms: staticTerms } = computeStaticVenues(selectedDomains, venueType, selectedRanks);
  const totalTerms = new Set([...staticTerms, ...dynamicJournalTerms]).size;

  const handleSubmitKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      void onSubmit();
    }
  };

  return (
    <Card padding="md" className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
          <Globe2 className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink-primary">论文检索</p>
          <p className="text-xs leading-5 text-ink-tertiary">
            小妍会联网检索全网论文，并按相关性与研究价值做聚合排序，帮你快速定位值得读的工作。
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-apple-blue/15 bg-apple-blue/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-apple-blue" />
          <div>
            <p className="text-sm font-semibold text-ink-primary">论文智能检索模块</p>
            <p className="mt-1 text-xs leading-5 text-ink-tertiary">
              支持关键词、标题、摘要、作者、排除词组合检索；同一字段内多个词按 OR 合并，不同字段按 AND 组合。
            </p>
          </div>
        </div>
      </div>

      <Textarea
        value={topic}
        onChange={(event) => onTopicChange(event.target.value)}
        onKeyDown={handleSubmitKeyDown}
        rows={2}
        placeholder="例如：LLM, diffusion, reinforcement learning…"
        label="研究主题说明（可选，小妍根据你的输入自动优化检索策略）"
      />

      <div className="space-y-3">
        <p className="ml-1 text-xs font-semibold text-ink-tertiary">
          检索词<span className="ml-0.5 text-apple-red">*</span>
          <span className="ml-1 font-normal">（通用、标题、摘要、作者、扩展词中至少填写一项）</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Input
            value={allTerms}
            onChange={(event) => onAllTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：model memory, tool use"
            label="通用关键词"
          />
          <Input
            value={titleTerms}
            onChange={(event) => onTitleTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：planning, memory"
            label="标题关键词"
          />
          <Input
            value={abstractTerms}
            onChange={(event) => onAbstractTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：benchmark, long-term"
            label="摘要关键词"
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Input
            value={authors}
            onChange={(event) => onAuthorsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：Geoffrey Hinton, Percy Liang"
            label="作者"
          />
          <Input
            value={commentsTerms}
            onChange={(event) => onCommentsTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：code, benchmark, workshop"
            label="扩展关键词"
          />
          <Input
            value={excludeTerms}
            onChange={(event) => onExcludeTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：robotics, medical imaging"
            label="排除词"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl p-4" style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold tracking-wide text-ink-tertiary">
              步骤 1 · 研究领域
              <span className="ml-1 font-normal">（可多选）</span>
            </label>
            {selectedDomains.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  onDomainsChange([]);
                  onRanksChange([]);
                }}
                className="text-[11px] text-ink-tertiary transition-colors hover:text-apple-red"
              >
                清空筛选
              </button>
            ) : null}
          </div>

          <div className="space-y-2 rounded-xl p-2.5" style={{ background: "var(--rc-elevated)", boxShadow: insetShadow }}>
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">计算机科学</p>
            {CS_GROUPS.map((group) => {
              const groupKeys = group.keys;
              const allSelected = groupKeys.every((key) => selectedDomains.includes(key));
              const someSelected = groupKeys.some((key) => selectedDomains.includes(key));
              return (
                <div key={group.label} className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onDomainsChange(
                        allSelected
                          ? selectedDomains.filter((key) => !groupKeys.includes(key))
                          : [...new Set([...selectedDomains, ...groupKeys])]
                      )
                    }
                    className="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all duration-100 active:scale-95"
                    style={
                      allSelected
                        ? { background: "#0062CC", color: "#fff" }
                        : someSelected
                          ? {
                              background: "rgba(0,122,255,0.15)",
                              color: "var(--apple-blue,#007AFF)",
                              border: "1px solid rgba(0,122,255,0.3)",
                            }
                          : { background: "var(--rc-surface)", color: "var(--rc-text-muted)", boxShadow: raisedShadow }
                    }
                  >
                    {group.label}
                  </button>
                  <span className="text-ink-tertiary" style={{ fontSize: 10 }}>
                    ›
                  </span>
                  {groupKeys.map((key) => {
                    const domain = DOMAIN_VENUES[key];
                    const selected = selectedDomains.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          onDomainsChange(
                            selected
                              ? selectedDomains.filter((value) => value !== key)
                              : [...selectedDomains, key]
                          )
                        }
                        className="rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-100 active:scale-95"
                        style={
                          selected
                            ? {
                                background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
                                color: "#fff",
                                boxShadow: "2px 2px 6px rgba(0,62,204,0.3)",
                              }
                            : { background: "var(--rc-surface)", color: "var(--rc-text-soft)", boxShadow: raisedShadow }
                        }
                      >
                        {domain?.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">其他领域</p>
            <div className="flex flex-wrap gap-1.5">
              {NON_CS_KEYS.map((key) => {
                const domain = DOMAIN_VENUES[key];
                const selected = selectedDomains.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      onDomainsChange(
                        selected
                          ? selectedDomains.filter((value) => value !== key)
                          : [...selectedDomains, key]
                      )
                    }
                    className="rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-100 active:scale-95"
                    style={
                      selected
                        ? {
                            background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
                            color: "#fff",
                            boxShadow: "2px 2px 6px rgba(0,62,204,0.3)",
                          }
                        : { background: "var(--rc-elevated)", color: "var(--rc-text-soft)", boxShadow: raisedShadow }
                    }
                  >
                    {domain?.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selectedDomains.length > 0 ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-wide text-ink-tertiary">步骤 2 · 类型</label>
              <div className="inline-flex gap-0.5 rounded-xl p-0.5" style={{ background: "var(--rc-elevated)", boxShadow: insetShadow }}>
                {(["all", "conference", "journal"] as const).map((type) => {
                  const label = type === "all" ? "全部" : type === "conference" ? "会议" : "期刊";
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onVenueTypeChange(type)}
                      className="rounded-lg px-3 py-1 text-xs font-medium transition-all duration-150"
                      style={
                        venueType === type
                          ? { background: "var(--rc-surface)", color: "var(--rc-text)", boxShadow: raisedShadow }
                          : { color: "var(--rc-text-muted)" }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-wide text-ink-tertiary">
                步骤 3 · 等级
                <span className="ml-1 font-normal">（可多选）</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {RANK_OPTIONS.map(({ key, label, color }) => {
                  const selected = selectedRanks.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        onRanksChange(
                          selected
                            ? selectedRanks.filter((value) => value !== key)
                            : [...selectedRanks, key]
                        )
                      }
                      className="rounded-xl px-2.5 py-1 text-xs font-semibold transition-all duration-100 active:scale-95"
                      style={
                        selected
                          ? { background: color, color: "#fff", boxShadow: `0 2px 6px ${color}55` }
                          : { background: `${color}15`, color, border: `1px solid ${color}40` }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}

        {selectedDomains.length > 0 && selectedRanks.length > 0 ? (
          <p className="flex items-center gap-1.5 text-[11px] text-ink-tertiary">
            {venueFilterLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                正在从本地数据库加载期刊列表…
              </>
            ) : (
              <>
                已匹配 <span className="font-semibold text-apple-blue">{totalTerms}</span> 个会议/期刊
                {categories.length > 0 ? (
                  <>
                    ，<span className="font-semibold text-apple-blue">{categories.length}</span> 个 arXiv 分类
                  </>
                ) : null}
              </>
            )}
          </p>
        ) : null}

        {selectedDomains.length === 0 ? (
          <p className="text-[11px] text-ink-tertiary">选择领域后，继续选择类型和等级，自动填充期刊/会议检索范围。</p>
        ) : null}
        {selectedDomains.length > 0 && selectedRanks.length === 0 ? (
          <p className="text-[11px] text-ink-tertiary">请在步骤 3 选择至少一个等级以确定检索范围。</p>
        ) : null}
      </div>

      <p className="text-xs leading-5 text-ink-tertiary">
        检索会结合最近时间窗口，并对候选论文做相关性和质量信号排序。
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          label="最近天数"
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(event) => onDaysChange(event.target.value)}
          placeholder="14"
        />
        <Input
          label="返回篇数"
          type="number"
          min={1}
          max={20}
          value={limit}
          onChange={(event) => onLimitChange(event.target.value)}
          placeholder="6"
        />
        <div className="w-full">
          <label className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">排序方式</label>
          <div className="inline-flex w-full gap-0.5 rounded-2xl p-1" style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}>
            {ARXIV_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onModeChange(option.value)}
                className="flex-1 rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-150"
                style={
                  mode === option.value
                    ? { background: "var(--rc-elevated)", boxShadow: raisedShadow, color: "var(--rc-text)" }
                    : { color: "var(--rc-text-muted)" }
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs leading-5 text-ink-tertiary">
          当前模式：<span className="font-medium text-ink-secondary">{currentMode.label}</span>
          {`，${currentMode.description}`}
        </p>
        <Button onClick={() => void onSubmit()} loading={loading} disabled={!hasSearchTerms}>
          <FileSearch className="h-4 w-4" />
          联网检索论文
        </Button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </Card>
  );
}

import type { KeyboardEvent } from "react";
import { AlertCircle, FileSearch, Plus, Sparkles, X } from "lucide-react";
import { Button, Card, Input, Textarea } from "@research-copilot/ui";
import type { ArxivRankingMode } from "@research-copilot/types";
import { ARXIV_CATEGORIES, ARXIV_MODE_OPTIONS } from "./shared";

const insetShadow = "var(--rc-inset-shadow)";
const raisedShadow = "var(--rc-raised-shadow)";

interface ArxivFieldSearchPanelProps {
  topic: string;
  allTerms: string;
  titleTerms: string;
  abstractTerms: string;
  authors: string;
  categories: string[];
  categoryPickerOpen: boolean;
  commentsTerms: string;
  journalTerms: string;
  excludeTerms: string;
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
  onToggleCategory: (value: string) => void;
  onRemoveCategory: (value: string) => void;
  onClearCategories: () => void;
  onToggleCategoryPicker: () => void;
  onCommentsTermsChange: (value: string) => void;
  onJournalTermsChange: (value: string) => void;
  onExcludeTermsChange: (value: string) => void;
  onDaysChange: (value: string) => void;
  onLimitChange: (value: string) => void;
  onModeChange: (value: ArxivRankingMode) => void;
  onSubmit: () => void | Promise<void>;
}

export function ArxivFieldSearchPanel({
  topic,
  allTerms,
  titleTerms,
  abstractTerms,
  authors,
  categories,
  categoryPickerOpen,
  commentsTerms,
  journalTerms,
  excludeTerms,
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
  onToggleCategory,
  onRemoveCategory,
  onClearCategories,
  onToggleCategoryPicker,
  onCommentsTermsChange,
  onJournalTermsChange,
  onExcludeTermsChange,
  onDaysChange,
  onLimitChange,
  onModeChange,
  onSubmit,
}: ArxivFieldSearchPanelProps) {
  const currentMode = ARXIV_MODE_OPTIONS.find((item) => item.value === mode) ?? ARXIV_MODE_OPTIONS[0];
  const handleSubmitKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      void onSubmit();
    }
  };

  return (
    <Card padding="md" className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink-primary">arXiv 智能检索</p>
          <p className="text-xs leading-5 text-ink-tertiary">
            arXiv 是全球最早且规模最大的学术预印本开放仓储，1991 年由物理学家 Paul Ginsparg 创立，现由康奈尔大学图书馆运营。小妍会帮你按官方字段拆分检索式：同一字段内多个值按 OR 合并，不同字段按 AND 组合，排除词走 ANDNOT。
          </p>
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
          <span className="ml-1 font-normal">（通用、标题、摘要、作者、备注、期刊词中至少填写一项）</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Input
            value={allTerms}
            onChange={(event) => onAllTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：model memory, tool use"
            label="通用关键词（all）"
          />
          <Input
            value={titleTerms}
            onChange={(event) => onTitleTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：planning, memory"
            label="标题关键词（ti）"
          />
          <Input
            value={abstractTerms}
            onChange={(event) => onAbstractTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：benchmark, long-term"
            label="摘要关键词（abs）"
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Input
            value={authors}
            onChange={(event) => onAuthorsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：Geoffrey Hinton, Percy Liang"
            label="作者（au）"
          />

          <div className="space-y-2">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">arXiv 分类（cat）</label>
            <div className="flex min-h-[28px] flex-wrap items-center gap-1.5">
              {categories.length === 0 ? (
                <span className="text-xs text-ink-tertiary">未选择分类，检索时不限分类</span>
              ) : (
                categories.map((category) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium text-apple-blue"
                    style={{ background: "rgba(0,122,255,0.1)" }}
                  >
                    {category}
                    <button
                      type="button"
                      onClick={() => onRemoveCategory(category)}
                      className="transition-colors hover:text-apple-red"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
              {categories.length > 0 ? (
                <button
                  type="button"
                  onClick={onClearCategories}
                  className="ml-1 text-[11px] text-ink-tertiary transition-colors hover:text-apple-red"
                >
                  清空
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onToggleCategoryPicker}
              className="flex items-center gap-1 text-xs font-medium text-apple-blue transition-opacity hover:opacity-75"
            >
              <Plus className="h-3.5 w-3.5" />
              {categoryPickerOpen ? "收起分类面板" : "展开分类面板"}
            </button>

            {categoryPickerOpen ? (
              <div className="space-y-3 rounded-2xl p-3" style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}>
                {ARXIV_CATEGORIES.map((group) => (
                  <div key={group.domain}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">
                      {group.domain}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map(({ id, zh }) => {
                        const selected = categories.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onToggleCategory(id)}
                            className="flex flex-col items-start rounded-xl px-2.5 py-1.5 transition-all duration-100 active:scale-95"
                            style={
                              selected
                                ? {
                                    background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                                    color: "#FFFFFF",
                                    boxShadow: "2px 2px 6px rgba(0,62,204,0.3), -1px -1px 4px rgba(58,155,255,0.2)",
                                  }
                                : {
                                    background: "var(--rc-surface)",
                                    color: "var(--rc-text-soft)",
                                    boxShadow: raisedShadow,
                                  }
                            }
                          >
                            <span className="text-xs font-semibold leading-tight">{id}</span>
                            <span className="mt-0.5 text-[10px] leading-tight" style={{ opacity: selected ? 0.8 : 0.55 }}>
                              {zh}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <Input
            value={commentsTerms}
            onChange={(event) => onCommentsTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：code, benchmark, workshop"
            label="备注关键词（co）"
          />
          <Input
            value={journalTerms}
            onChange={(event) => onJournalTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：ICLR, ACL, NeurIPS"
            label="期刊/会议信息（jr）"
          />
          <Input
            value={excludeTerms}
            onChange={(event) => onExcludeTermsChange(event.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="例如：robotics, medical imaging"
            label="排除词（ANDNOT）"
          />
        </div>
      </div>

      <p className="text-xs leading-5 text-ink-tertiary">
        检索时会自动加入最近时间窗口的 <span className="font-medium text-ink-secondary">submittedDate</span> 条件，多个分类之间以 OR 合并。
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
          检索 arXiv
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

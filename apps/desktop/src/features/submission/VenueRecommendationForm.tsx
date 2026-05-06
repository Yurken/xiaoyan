import { FileSearch } from "lucide-react";
import { Button, Input, Select, Textarea } from "@research-copilot/ui";
import type { VenueRecommendationInput } from "./shared";

interface VenueRecommendationFormProps {
  input: VenueRecommendationInput;
  loading: boolean;
  onChangeInput: (value: VenueRecommendationInput) => void;
  onGenerate: () => void;
}

const targetTypeOptions = [
  { value: "all", label: "不限" },
  { value: "conference", label: "会议" },
  { value: "journal", label: "期刊" },
];

const targetRankOptions = [
  { value: "any", label: "不限" },
  { value: "ccf-a", label: "CCF A" },
  { value: "ccf-b", label: "CCF B" },
  { value: "ccf-c", label: "CCF C" },
  { value: "sci-q1", label: "SCI Q1" },
  { value: "sci-q2", label: "SCI Q2" },
  { value: "sci", label: "SCI" },
  { value: "custom", label: "自定义" },
];

const riskPreferenceOptions = [
  { value: "safe", label: "稳妥" },
  { value: "balanced", label: "均衡" },
  { value: "stretch", label: "冲刺" },
];

const timePreferenceOptions = [
  { value: "any", label: "不限" },
  { value: "fast", label: "快速审稿" },
  { value: "normal", label: "常规周期" },
];

export default function VenueRecommendationForm({
  input,
  loading,
  onChangeInput,
  onGenerate,
}: VenueRecommendationFormProps) {
  return (
    <form
      className="space-y-4 rounded-3xl border p-4"
      style={{
        background: "var(--rc-card-inset-bg)",
        borderColor: "var(--rc-card-inset-outline)",
        boxShadow: "var(--rc-card-inset-shadow)",
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (loading) return;
        onGenerate();
      }}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Input
            label="论文标题"
            type="text"
            placeholder="输入论文标题，用于判断主题边界"
            value={input.title}
            onChange={(event) => onChangeInput({ ...input, title: event.target.value })}
          />
          <Input
            label="研究方向"
            type="text"
            placeholder="如：多模态检索、图神经网络、软件工程"
            value={input.direction}
            onChange={(event) => onChangeInput({ ...input, direction: event.target.value })}
          />
          <Textarea
            label="摘要"
            rows={5}
            className="min-h-[140px]"
            placeholder="粘贴摘要，小妍会用它评估主题适配和拒稿风险…"
            value={input.abstract}
            onChange={(event) => onChangeInput({ ...input, abstract: event.target.value })}
          />
        </div>

        <div className="space-y-3">
          <Input
            label="关键词"
            type="text"
            placeholder="如：LLM, diffusion, reinforcement learning…"
            value={input.keywords}
            onChange={(event) => onChangeInput({ ...input, keywords: event.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="目标类型"
              value={input.targetType}
              options={targetTypeOptions}
              onChange={(value) => onChangeInput({ ...input, targetType: value as VenueRecommendationInput["targetType"] })}
            />
            <Select
              label="目标档位"
              value={input.targetRank}
              options={targetRankOptions}
              onChange={(value) => onChangeInput({ ...input, targetRank: value as VenueRecommendationInput["targetRank"] })}
            />
          </div>
          {input.targetRank === "custom" ? (
            <Input
              label="自定义梯度"
              type="text"
              placeholder="如：中科院一区 / 顶会 / 工程向"
              value={input.customRank}
              onChange={(event) => onChangeInput({ ...input, customRank: event.target.value })}
            />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="风险偏好"
              value={input.riskPreference}
              options={riskPreferenceOptions}
              onChange={(value) => onChangeInput({ ...input, riskPreference: value as VenueRecommendationInput["riskPreference"] })}
            />
            <Select
              label="时间偏好"
              value={input.timePreference}
              options={timePreferenceOptions}
              onChange={(value) => onChangeInput({ ...input, timePreference: value as VenueRecommendationInput["timePreference"] })}
            />
          </div>
          <Input
            label="补充说明（可选）"
            type="text"
            placeholder="如：偏理论 / 工程落地 / 希望 CCF A 类…"
            value={input.extra}
            onChange={(event) => onChangeInput({ ...input, extra: event.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-ink-tertiary">输出冲刺 / 主投 / 保底梯度，并提示风险与可能拒稿原因</p>
        <Button type="submit" size="sm" loading={loading} className="sm:min-w-[124px]">
          {loading ? (
            "分析中..."
          ) : (
            <>
              <FileSearch className="h-3.5 w-3.5" />
              生成推荐
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

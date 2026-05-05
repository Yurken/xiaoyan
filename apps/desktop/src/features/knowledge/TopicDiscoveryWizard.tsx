import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../../lib/client";

const FIELDS = [
  "计算机 / 人工智能",
  "生物医学",
  "材料与化学",
  "教育技术",
  "经济与金融",
  "社会与人文",
  "电子 / 通信",
  "其他",
];

const GOAL_TYPES = [
  "提出新方法 / 算法",
  "解决工程落地问题",
  "系统调研与综述",
  "数据分析与挖掘",
  "理论证明与推导",
  "跨学科融合创新",
];

type Step = "field" | "goal" | "background" | "results";

interface Props {
  onSelect: (topic: string) => void;
  onClose: () => void;
}

export default function TopicDiscoveryWizard({ onSelect, onClose }: Props) {
  const [step, setStep] = useState<Step>("field");
  const [field, setField] = useState("");
  const [goalType, setGoalType] = useState("");
  const [background, setBackground] = useState("");
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setStep("results");
    try {
      const result = await apiClient.knowledge.suggestTopics(field, goalType, background);
      setTopics(result);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4 space-y-4"
      style={{ background: "var(--rc-elevated)", boxShadow: "var(--rc-inset-shadow)" }}
    >
      {/* 头部 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-primary flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-apple-blue flex-shrink-0" />
            让小妍帮你找方向
          </p>
          <p className="mt-0.5 text-xs text-ink-tertiary">回答几个问题，小妍推荐适合你的研究课题</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-ink-tertiary hover:text-ink-primary px-2 py-1 rounded-lg transition-colors flex-shrink-0"
        >
          收起
        </button>
      </div>

      {/* Step 1: 领域 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-secondary">你的研究领域</p>
        <div className="flex flex-wrap gap-1.5">
          {FIELDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setField(f);
                if (step === "field") setStep("goal");
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
              style={{
                background: field === f ? "#007AFF" : "var(--rc-surface)",
                color: field === f ? "#fff" : "var(--rc-text-soft)",
                boxShadow: field === f
                  ? "inset 1px 1px 3px rgba(0,0,0,0.2)"
                  : "var(--rc-chip-shadow)",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: 目标类型 */}
      {(step === "goal" || step === "background" || step === "results") && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-secondary">你想做什么类型的研究</p>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_TYPES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGoalType(g);
                  if (step === "goal") setStep("background");
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                style={{
                  background: goalType === g ? "#007AFF" : "var(--rc-surface)",
                  color: goalType === g ? "#fff" : "var(--rc-text-soft)",
                  boxShadow: goalType === g
                    ? "inset 1px 1px 3px rgba(0,0,0,0.2)"
                    : "var(--rc-chip-shadow)",
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: 背景 + 生成 */}
      {(step === "background" || step === "results") && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-secondary">
            简单说说你的背景
            <span className="ml-1 text-ink-tertiary font-normal">（可选）</span>
          </p>
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="例如：硕士在读，熟悉 Python，对 NLP 和医疗数据感兴趣…"
            rows={2}
            className="w-full resize-none rounded-xl px-3 py-2 text-xs text-ink-primary placeholder:text-ink-tertiary outline-none"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          />
          {step === "background" && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => void handleGenerate()} disabled={!field || !goalType}>
                <Sparkles className="h-3.5 w-3.5" />
                让小妍来推荐
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 4: 结果 */}
      {step === "results" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-ink-secondary">选一个感兴趣的方向</p>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={loading}
              className="text-xs text-apple-blue hover:underline disabled:opacity-50"
            >
              换一批
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-apple-blue" />
              <span className="text-xs text-ink-tertiary">小妍正在思考…</span>
            </div>
          ) : error ? (
            <p className="text-xs text-apple-red py-2">{error}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => onSelect(topic)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-ink-primary transition-all duration-150 hover:text-apple-blue"
                  style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
                >
                  {topic}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

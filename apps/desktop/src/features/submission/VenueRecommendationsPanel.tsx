import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { VenueTemplate } from "../../data/venues";
import { CCF_STYLE, type VenueRecommendation } from "./shared";

interface RecommendationInput {
  direction: string;
  keywords: string;
  extra: string;
}

interface VenueRecommendationsPanelProps {
  open: boolean;
  recommendations: VenueRecommendation[];
  loading: boolean;
  input: RecommendationInput;
  onToggle: () => void;
  onChangeInput: (value: RecommendationInput) => void;
  onGenerate: () => void;
  isVenueAdded: (template: VenueTemplate) => boolean;
  onAddVenue: (template: VenueTemplate) => void | Promise<void>;
}

export default function VenueRecommendationsPanel({
  open,
  recommendations,
  loading,
  input,
  onToggle,
  onChangeInput,
  onGenerate,
  isVenueAdded,
  onAddVenue,
}: VenueRecommendationsPanelProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--rc-border)", background: "var(--rc-card-bg)" }}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-black/[0.02]"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: "#AF52DE" }} />
          <span className="text-sm font-semibold text-ink-primary">智能推荐刊会</span>
          {recommendations.length > 0 ? (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(175,82,222,0.12)", color: "#AF52DE" }}
            >
              {recommendations.length} 个推荐
            </span>
          ) : null}
          <span className="text-xs text-ink-tertiary">根据研究方向与投稿历史自动匹配</span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
        }
      </button>

      {open ? (
        <>
          <div className="px-4 pb-4 pt-1 space-y-3 border-t" style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}>
            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <p className="text-xs font-medium text-ink-secondary mb-1">研究方向 / 论文主题</p>
                <textarea
                  rows={3}
                  placeholder="告诉小妍你的研究方向或论文主题…"
                  value={input.direction}
                  onChange={(event) => onChangeInput({ ...input, direction: event.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs resize-none leading-relaxed"
                  style={{ background: "var(--rc-card-bg)", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07)" }}
                />
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-medium text-ink-secondary mb-1">关键词</p>
                  <input
                    type="text"
                    placeholder="如：LLM, diffusion, reinforcement learning…"
                    value={input.keywords}
                    onChange={(event) => onChangeInput({ ...input, keywords: event.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs"
                    style={{ background: "var(--rc-card-bg)", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07)" }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-secondary mb-1">补充说明（可选）</p>
                  <input
                    type="text"
                    placeholder="如：偏理论 / 工程落地 / 希望 CCF A 类…"
                    value={input.extra}
                    onChange={(event) => onChangeInput({ ...input, extra: event.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs"
                    style={{ background: "var(--rc-card-bg)", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07)" }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-ink-tertiary">基于投稿历史 · 关键词匹配 · CCF/SCI 评级综合评分</p>
              <button
                onClick={onGenerate}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #AF52DE, #007AFF)", color: "#fff", boxShadow: "2px 4px 10px rgba(0,122,255,0.25)" }}
              >
                {loading
                  ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />分析中…</>
                  : <><Sparkles className="w-3 h-3" />生成推荐</>
                }
              </button>
            </div>
          </div>

          {recommendations.length > 0 ? (
            <div className="p-3 space-y-2 border-t" style={{ borderColor: "var(--rc-border)" }}>
              <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">推荐结果</p>
              {recommendations.map((recommendation) => {
                const ccfStyle = CCF_STYLE[recommendation.ccf];
                const alreadyAdded = isVenueAdded(recommendation);
                return (
                  <div
                    key={recommendation.id}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: "var(--rc-card-inset-bg)" }}
                  >
                    <div className="flex-shrink-0 flex flex-col items-center gap-0.5 w-10">
                      <span
                        className="text-base font-bold tabular-nums"
                        style={{
                          color: recommendation.matchScore >= 80 ? "#34C759" : recommendation.matchScore >= 55 ? "#007AFF" : "#FF9500",
                        }}
                      >
                        {recommendation.matchScore}
                      </span>
                      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--rc-border)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${recommendation.matchScore}%`,
                            background: recommendation.matchScore >= 80 ? "#34C759" : recommendation.matchScore >= 55 ? "#007AFF" : "#FF9500",
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-ink-tertiary">匹配度</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-ink-primary">{recommendation.name}</span>
                        {recommendation.ccf !== "none" ? (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: ccfStyle.bg, color: ccfStyle.color }}
                          >
                            CCF {recommendation.ccf}
                          </span>
                        ) : null}
                        {recommendation.sci ? (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: "rgba(52,199,89,0.12)", color: "#1A7F37" }}
                          >
                            SCI
                          </span>
                        ) : null}
                        {recommendation.sciQuartile ? (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: "rgba(88,86,214,0.12)", color: "#5856D6" }}
                          >
                            {recommendation.sciQuartile}
                          </span>
                        ) : null}
                        {recommendation.ei ? (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}
                          >
                            EI
                          </span>
                        ) : null}
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(142,142,147,0.10)", color: "#8E8E93" }}
                        >
                          {recommendation.type === "conference" ? "会议" : "期刊"}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-tertiary mt-0.5 truncate">{recommendation.fullName}</p>
                      <p className="text-xs text-ink-secondary mt-1 leading-relaxed">{recommendation.reason}</p>
                      {recommendation.matchTags.length > 0 ? (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {recommendation.matchTags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded-md"
                              style={{ background: "rgba(175,82,222,0.10)", color: "#AF52DE" }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <button
                      onClick={() => {
                        if (!alreadyAdded) {
                          void onAddVenue(recommendation);
                        }
                      }}
                      disabled={alreadyAdded}
                      className="flex-shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-xl transition-all duration-150 disabled:opacity-40"
                      style={alreadyAdded
                        ? { background: "rgba(52,199,89,0.12)", color: "#34C759" }
                        : { background: "#007AFF", color: "#fff", boxShadow: "1px 2px 6px rgba(0,122,255,0.25)" }}
                    >
                      {alreadyAdded ? "已追踪 ✓" : "+ 追踪"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

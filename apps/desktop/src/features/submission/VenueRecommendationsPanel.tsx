import { AlertTriangle, ChevronDown, ChevronUp, FilePlus, FileSearch } from "lucide-react";
import { Badge, Button, Card } from "@research-copilot/ui";
import type { VenueTemplate } from "../../data/venues";
import {
  CCF_STYLE,
  type RecommendationRiskLevel,
  type RecommendationTier,
  type VenueRecommendation,
  type VenueRecommendationInput,
} from "./shared";
import VenueRecommendationForm from "./VenueRecommendationForm";

interface VenueRecommendationsPanelProps {
  open: boolean;
  recommendations: VenueRecommendation[];
  loading: boolean;
  input: VenueRecommendationInput;
  onToggle: () => void;
  onChangeInput: (value: VenueRecommendationInput) => void;
  onGenerate: () => void;
  isVenueAdded: (template: VenueTemplate) => boolean;
  onAddVenue: (template: VenueTemplate) => void | Promise<void>;
  onCreateSubmission: (recommendation: VenueRecommendation) => void;
}

const tierConfig: Record<RecommendationTier, { label: string; color: string; bg: string }> = {
  stretch: { label: "冲刺", color: "#AF52DE", bg: "rgba(175,82,222,0.12)" },
  primary: { label: "主投", color: "#007AFF", bg: "rgba(0,122,255,0.12)" },
  backup: { label: "保底", color: "#34C759", bg: "rgba(52,199,89,0.12)" },
};

const riskConfig: Record<RecommendationRiskLevel, { label: string; color: string; bg: string }> = {
  low: { label: "低风险", color: "#34C759", bg: "rgba(52,199,89,0.12)" },
  medium: { label: "中风险", color: "#FF9500", bg: "rgba(255,149,0,0.12)" },
  high: { label: "高风险", color: "#FF3B30", bg: "rgba(255,59,48,0.12)" },
};

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
  onCreateSubmission,
}: VenueRecommendationsPanelProps) {
  return (
    <Card padding="none" variant="flat" className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--rc-button-ghost-bg-hover)]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)", color: "var(--rc-accent)" }}
          >
            <FileSearch className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink-primary">智能推荐刊会</span>
              {recommendations.length > 0 ? <Badge variant="info">{recommendations.length} 个推荐</Badge> : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-tertiary">按标题、摘要、档位、风险和周期匹配</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-ink-tertiary" />
          : <ChevronDown className="h-4 w-4 flex-shrink-0 text-ink-tertiary" />
        }
      </button>

      {open ? (
        <>
          <div className="border-t p-4" style={{ borderColor: "var(--rc-border)" }}>
            <VenueRecommendationForm
              input={input}
              loading={loading}
              onChangeInput={onChangeInput}
              onGenerate={onGenerate}
            />
          </div>

          {recommendations.length > 0 ? (
            <div className="space-y-2 border-t p-4 pt-3" style={{ borderColor: "var(--rc-border)" }}>
              <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">推荐结果</p>
              {recommendations.map((recommendation) => {
                const ccfStyle = CCF_STYLE[recommendation.ccf];
                const alreadyAdded = isVenueAdded(recommendation);
                const tierStyle = tierConfig[recommendation.tier];
                const riskStyle = riskConfig[recommendation.riskLevel];
                return (
                  <div
                    key={recommendation.id}
                    className="flex items-start gap-3 rounded-2xl border p-3"
                    style={{
                      background: "var(--rc-card-inset-bg)",
                      borderColor: "var(--rc-card-inset-outline)",
                      boxShadow: "var(--rc-card-inset-shadow)",
                    }}
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
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: tierStyle.bg, color: tierStyle.color }}
                        >
                          {tierStyle.label}
                        </span>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: riskStyle.bg, color: riskStyle.color }}
                        >
                          {riskStyle.label}
                        </span>
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
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-xl px-2.5 py-2" style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}>
                          <p className="flex items-center gap-1 text-[10px] font-semibold text-ink-tertiary mb-1">
                            <AlertTriangle className="w-3 h-3" />
                            风险提示
                          </p>
                          <ul className="space-y-1">
                            {recommendation.riskTips.slice(0, 2).map((tip) => (
                              <li key={tip} className="text-[11px] text-ink-secondary leading-snug">{tip}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl px-2.5 py-2" style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}>
                          <p className="text-[10px] font-semibold text-ink-tertiary mb-1">可能拒稿原因</p>
                          <ul className="space-y-1">
                            {recommendation.rejectionReasons.slice(0, 2).map((reason) => (
                              <li key={reason} className="text-[11px] text-ink-secondary leading-snug">{reason}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {recommendation.matchTags.length > 0 ? (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {recommendation.matchTags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded-md"
                              style={{ background: "var(--rc-info-chip-bg)", color: "var(--rc-info-chip-text)" }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex-shrink-0 flex flex-col gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={alreadyAdded ? "secondary" : "primary"}
                        onClick={() => {
                          if (!alreadyAdded) {
                            void onAddVenue(recommendation);
                          }
                        }}
                        disabled={alreadyAdded}
                      >
                        {alreadyAdded ? "已追踪" : "追踪"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onCreateSubmission(recommendation)}
                      >
                        <FilePlus className="w-3 h-3" />
                        创建投稿
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

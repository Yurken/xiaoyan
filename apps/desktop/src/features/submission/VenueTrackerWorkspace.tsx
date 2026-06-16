import { useState } from "react";
import { Bell, BookOpen, Clock, Plus, RefreshCw, Star, StarOff } from "lucide-react";
import { Button, CapsuleTabs, Card } from "@research-copilot/ui";
import ExternalLink from "../../components/ExternalLink";
import type { ResearchInterest } from "@research-copilot/types";
import type { VenueTemplate } from "../../data/venues";
import VenueRecommendationsPanel from "./VenueRecommendationsPanel";
import {
  CCF_STYLE,
  getDaysUntil,
  getDdlStyle,
  type Conference,
  type Journal,
  type Venue,
  type VenueRecommendation,
  type VenueRecommendationInput,
} from "./shared";

interface VenueTrackerWorkspaceProps {
  venueFilter: "all" | "conference" | "journal" | "starred";
  visibleVenues: Venue[];
  conferencesCount: number;
  journalsCount: number;
  recommendations: VenueRecommendation[];
  recommendationLoading: boolean;
  recommendationInput: VenueRecommendationInput;
  researchInterests: ResearchInterest[];
  selectedRecommendationInterestId: string;
  onVenueFilterChange: (value: "all" | "conference" | "journal" | "starred") => void;
  onOpenAddVenue: () => void;
  onChangeRecommendationInput: (value: VenueRecommendationInput) => void;
  onSelectRecommendationInterest: (id: string) => void;
  onRecommendFromInterest: () => void;
  onGenerateRecommendations: () => void;
  isVenueAdded: (template: VenueTemplate) => boolean;
  onAddVenue: (template: VenueTemplate) => void | Promise<void>;
  onCreateSubmissionFromRecommendation: (recommendation: VenueRecommendation) => void;
  onToggleVenueStar: (id: string, type: Venue["type"]) => void;
  onSyncDdl?: () => void | Promise<void>;
  syncingDdl?: boolean;
}

export default function VenueTrackerWorkspace({
  venueFilter,
  visibleVenues,
  conferencesCount,
  journalsCount,
  recommendations,
  recommendationLoading,
  recommendationInput,
  researchInterests,
  selectedRecommendationInterestId,
  onVenueFilterChange,
  onOpenAddVenue,
  onChangeRecommendationInput,
  onSelectRecommendationInterest,
  onRecommendFromInterest,
  onGenerateRecommendations,
  isVenueAdded,
  onAddVenue,
  onCreateSubmissionFromRecommendation,
  onToggleVenueStar,
  onSyncDdl,
  syncingDdl,
}: VenueTrackerWorkspaceProps) {
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const filterOptions = [
    { value: "all", label: "全部", count: conferencesCount + journalsCount },
    { value: "conference", label: "会议", count: conferencesCount },
    { value: "journal", label: "期刊", count: journalsCount },
    { value: "starred", label: "已关注" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {(() => {
            const tabs = filterOptions.map((f) => ({
              value: f.value,
              label: "count" in f ? `${f.label} ${f.count}` : f.label,
            }));
            return (
              <CapsuleTabs
                compact
                options={tabs}
                value={venueFilter}
                onChange={(v) => onVenueFilterChange(v as typeof venueFilter)}
              />
            );
          })()}
        </div>
        <div className="flex items-center gap-2">
          {onSyncDdl ? (
            <Button variant="secondary" size="sm" loading={syncingDdl} onClick={() => void onSyncDdl()}>
              <RefreshCw className="w-3.5 h-3.5" />
              同步 DDL
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onOpenAddVenue}>
            <Plus className="w-3.5 h-3.5" />
            添加会议/期刊
          </Button>
        </div>
      </div>

      <div className="grid gap-2.5">
        {visibleVenues.length === 0 ? (
          <Card padding="lg" variant="inset" className="flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-semibold text-ink-primary">暂无匹配的刊会</p>
            <p className="text-xs text-ink-tertiary">切换筛选条件，或添加新的会议 / 期刊到追踪列表。</p>
          </Card>
        ) : null}
        {visibleVenues.map((venue) => {
          const conference = venue.type === "conference";
          const days = conference
            ? venue.deadline ? getDaysUntil(venue.deadline) : null
            : venue.specialIssueDeadline ? getDaysUntil(venue.specialIssueDeadline) : null;
          const deadlineStyle = days !== null ? getDdlStyle(days) : null;
          const ccfStyle = CCF_STYLE[venue.ccf];

          return (
            <Card key={venue.id} padding="sm" className="group">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {venue.website ? (
                      <ExternalLink
                        href={venue.website}
                        className="font-semibold text-base text-ink-primary truncate hover:text-blue-600 hover:underline"
                      >
                        {venue.name}
                      </ExternalLink>
                    ) : (
                      <p className="font-semibold text-base text-ink-primary truncate">{venue.name}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {venue.ccf !== "none" ? (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: ccfStyle.bg, color: ccfStyle.color }}
                      >
                        CCF {venue.ccf}
                      </span>
                    ) : null}
                    {!conference && (venue as Journal).sci ? (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: "rgba(52,199,89,0.12)", color: "#1A7F37" }}
                      >
                        SCI
                      </span>
                    ) : null}
                    {!conference && (venue as Journal).sciQuartile ? (() => {
                      const quartile = (venue as Journal).sciQuartile!;
                      const quartileColor = quartile === "Q1" ? { bg: "rgba(88,86,214,0.12)", color: "#5856D6" }
                        : quartile === "Q2" ? { bg: "rgba(0,122,255,0.12)", color: "#007AFF" }
                        : quartile === "Q3" ? { bg: "rgba(255,149,0,0.12)", color: "#E65100" }
                        : { bg: "rgba(142,142,147,0.12)", color: "#6B6B6B" };
                      return (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: quartileColor.bg, color: quartileColor.color }}
                        >
                          {quartile}
                        </span>
                      );
                    })() : null}
                    {venue.ei ? (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}
                      >
                        EI
                      </span>
                    ) : null}
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{
                        background: conference ? "rgba(0,122,255,0.10)" : "rgba(175,82,222,0.10)",
                        color: conference ? "#007AFF" : "#AF52DE",
                      }}
                    >
                      {conference ? "会议" : "期刊"}
                    </span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: "rgba(142,142,147,0.10)", color: "#8E8E93" }}
                    >
                      {venue.area}
                    </span>
                  </div>

                  <p className="text-xs text-ink-tertiary mt-0.5 truncate">{venue.fullName}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {conference ? (
                      <>
                        {(venue as Conference).deadline ? (
                          <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                            <Clock className="w-3 h-3" />
                            截止 {(venue as Conference).deadline!.toLocaleDateString("zh-CN")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                            <Clock className="w-3 h-3" />
                            等待官方 DDL
                          </span>
                        )}
                        {(venue as Conference).notificationDate ? (
                          <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                            <Bell className="w-3 h-3" />
                            通知 {(venue as Conference).notificationDate!.toLocaleDateString("zh-CN")}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                          <BookOpen className="w-3 h-3" />
                          随时投稿
                        </span>
                        {(venue as Journal).specialIssueDeadline && (venue as Journal).specialIssueTitle ? (
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: "#FF9500" }}>
                            <Bell className="w-3 h-3" />
                            特刊「{(venue as Journal).specialIssueTitle}」截止 {(venue as Journal).specialIssueDeadline!.toLocaleDateString("zh-CN")}
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>

                {deadlineStyle ? (
                  <div
                    className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: deadlineStyle.bg, color: deadlineStyle.color }}
                  >
                    {days! < 0 ? "已截止" : `还剩 ${deadlineStyle.label}`}
                  </div>
                ) : null}

                <button
                  type="button"
                  aria-label={venue.starred ? "取消关注刊会" : "关注刊会"}
                  onClick={() => onToggleVenueStar(venue.id, venue.type)}
                  className="flex-shrink-0 rounded-xl p-2 opacity-100 transition-all duration-150 hover:bg-[var(--rc-button-ghost-bg-hover)] md:opacity-0 md:group-hover:opacity-100"
                >
                  {venue.starred
                    ? <Star className="w-4 h-4 fill-current" style={{ color: "#FF9500" }} />
                    : <StarOff className="w-4 h-4 text-ink-tertiary" />
                  }
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <VenueRecommendationsPanel
        open={recommendationsOpen}
        recommendations={recommendations}
        loading={recommendationLoading}
        input={recommendationInput}
        interests={researchInterests}
        selectedInterestId={selectedRecommendationInterestId}
        onToggle={() => setRecommendationsOpen((currentOpen) => !currentOpen)}
        onChangeInput={onChangeRecommendationInput}
        onSelectInterest={onSelectRecommendationInterest}
        onRecommendInterest={onRecommendFromInterest}
        onGenerate={onGenerateRecommendations}
        isVenueAdded={isVenueAdded}
        onAddVenue={onAddVenue}
        onCreateSubmission={onCreateSubmissionFromRecommendation}
      />

      {/*
      <div
        className="rounded-3xl p-4 flex items-center gap-3 border-2 border-dashed opacity-50"
        style={{ borderColor: "var(--rc-border)" }}
      >
        <Users className="w-5 h-5 text-ink-tertiary flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-ink-secondary">课题组共享日历（即将上线）</p>
          <p className="text-xs text-ink-tertiary mt-0.5">邀请课题组成员，共同追踪会议与期刊，统一管理投稿节奏。</p>
        </div>
      </div>
      */}
    </div>
  );
}

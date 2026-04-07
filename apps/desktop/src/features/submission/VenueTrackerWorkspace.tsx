import { Bell, BookOpen, Clock, Plus, Star, StarOff, Users } from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
import ExternalLink from "../../components/ExternalLink";
import type { VenueTemplate } from "../../data/venues";
import VenueRecommendationsPanel from "./VenueRecommendationsPanel";
import { CCF_STYLE, getDaysUntil, getDdlStyle, type Conference, type Journal, type Venue, type VenueRecommendation } from "./shared";

interface RecommendationInput {
  direction: string;
  keywords: string;
  extra: string;
}

interface VenueTrackerWorkspaceProps {
  venueFilter: "all" | "conference" | "journal" | "starred";
  visibleVenues: Venue[];
  conferencesCount: number;
  journalsCount: number;
  showRecommendations: boolean;
  recommendations: VenueRecommendation[];
  recommendationLoading: boolean;
  recommendationInput: RecommendationInput;
  onVenueFilterChange: (value: "all" | "conference" | "journal" | "starred") => void;
  onOpenAddVenue: () => void;
  onToggleRecommendations: () => void;
  onChangeRecommendationInput: (value: RecommendationInput) => void;
  onGenerateRecommendations: () => void;
  isVenueAdded: (template: VenueTemplate) => boolean;
  onAddVenue: (template: VenueTemplate) => void | Promise<void>;
  onToggleVenueStar: (id: string, type: Venue["type"]) => void;
}

export default function VenueTrackerWorkspace({
  venueFilter,
  visibleVenues,
  showRecommendations,
  recommendations,
  recommendationLoading,
  recommendationInput,
  onVenueFilterChange,
  onOpenAddVenue,
  onToggleRecommendations,
  onChangeRecommendationInput,
  onGenerateRecommendations,
  isVenueAdded,
  onAddVenue,
  onToggleVenueStar,
}: VenueTrackerWorkspaceProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "conference", "journal", "starred"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => onVenueFilterChange(filter)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
              style={venueFilter === filter
                ? { background: "#007AFF", color: "#fff" }
                : {
                    background: "var(--rc-card-bg)",
                    color: "var(--rc-text-secondary)" as string,
                    boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)",
                  }}
            >
              {filter === "all" ? "全部" : filter === "conference" ? "会议" : filter === "journal" ? "期刊" : "⭐ 已关注"}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={onOpenAddVenue}>
          <Plus className="w-3.5 h-3.5" />
          添加会议/期刊
        </Button>
      </div>

      <VenueRecommendationsPanel
        open={showRecommendations}
        recommendations={recommendations}
        loading={recommendationLoading}
        input={recommendationInput}
        onToggle={onToggleRecommendations}
        onChangeInput={onChangeRecommendationInput}
        onGenerate={onGenerateRecommendations}
        isVenueAdded={isVenueAdded}
        onAddVenue={onAddVenue}
      />

      <div className="grid gap-2.5">
        {visibleVenues.map((venue) => {
          const conference = venue.type === "conference";
          const days = conference
            ? getDaysUntil(venue.deadline)
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
                        <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                          <Clock className="w-3 h-3" />
                          截止 {(venue as Conference).deadline.toLocaleDateString("zh-CN")}
                        </span>
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
                  onClick={() => onToggleVenueStar(venue.id, venue.type)}
                  className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-150 hover:bg-black/5 opacity-0 group-hover:opacity-100"
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
    </div>
  );
}

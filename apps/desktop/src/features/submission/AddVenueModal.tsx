import { Check, Plus, Search, X } from "lucide-react";
import { Select } from "@research-copilot/ui";
import type { VenueTemplate } from "../../data/venues";
import ExternalLink from "../../components/ExternalLink";

interface AddVenueModalProps {
  open: boolean;
  search: string;
  areaFilter: string;
  typeFilter: "all" | "conference" | "journal";
  areas: string[];
  filteredVenueTemplates: VenueTemplate[];
  trackedCount: number;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onAreaFilterChange: (value: string) => void;
  onTypeFilterChange: (value: "all" | "conference" | "journal") => void;
  isVenueAdded: (venue: VenueTemplate) => boolean;
  onAddVenue: (venue: VenueTemplate) => void | Promise<void>;
}

export default function AddVenueModal({
  open,
  search,
  areaFilter,
  typeFilter,
  areas,
  filteredVenueTemplates,
  trackedCount,
  onClose,
  onSearchChange,
  onAreaFilterChange,
  onTypeFilterChange,
  isVenueAdded,
  onAddVenue,
}: AddVenueModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] mx-4 rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)" }}
      >
        <div className="flex-shrink-0 px-6 py-5 border-b" style={{ borderColor: "var(--rc-border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink-primary">添加会议/期刊</h2>
              <p className="text-xs text-ink-tertiary mt-0.5">从 CCF 推荐目录中选择要追踪的会议或期刊</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
              <X className="w-5 h-5 text-ink-tertiary" />
            </button>
          </div>

          <div className="mt-4 flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary" />
              <input
                type="text"
                placeholder="搜索会议或期刊…"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm"
                style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
              />
            </div>
            <Select
              value={areaFilter}
              onChange={onAreaFilterChange}
              className="min-w-[148px]"
              options={[
                { value: "all", label: "全部领域" },
                ...areas.map((area) => ({ value: area, label: area })),
              ]}
            />
            <div className="flex gap-1">
              {(["all", "conference", "journal"] as const).map((venueType) => (
                <button
                  key={venueType}
                  onClick={() => onTypeFilterChange(venueType)}
                  className="px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150"
                  style={
                    typeFilter === venueType
                      ? { background: "#007AFF", color: "#fff" }
                      : {
                          background: "var(--rc-card-bg)",
                          color: "var(--rc-text-secondary)" as string,
                          boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)",
                        }
                  }
                >
                  {venueType === "all" ? "全部" : venueType === "conference" ? "会议" : "期刊"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filteredVenueTemplates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-ink-tertiary">未找到匹配的会议或期刊</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredVenueTemplates.map((venue) => {
                const added = isVenueAdded(venue);
                return (
                  <div
                    key={venue.id}
                    className="rounded-2xl p-4 transition-all duration-150"
                    style={{
                      background: added ? "rgba(52,199,89,0.07)" : "var(--rc-card-bg)",
                      boxShadow: added ? "none" : "2px 2px 8px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.7)",
                      opacity: added ? 0.7 : 1,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {venue.website ? (
                          <ExternalLink
                            href={venue.website}
                            className="font-bold text-base text-ink-primary truncate hover:text-blue-600 hover:underline block"
                          >
                            {venue.name}
                          </ExternalLink>
                        ) : (
                          <p className="font-bold text-base text-ink-primary truncate">{venue.name}</p>
                        )}
                        <p className="text-[11px] text-ink-tertiary truncate mt-0.5">{venue.fullName}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (!added) void onAddVenue(venue);
                        }}
                        disabled={added}
                        className="flex-shrink-0 p-2 rounded-xl transition-all duration-150"
                        style={
                          added
                            ? { background: "rgba(52,199,89,0.15)", cursor: "default" }
                            : { background: "#007AFF", boxShadow: "2px 2px 6px rgba(0,122,255,0.3)" }
                        }
                      >
                        {added ? <Check className="w-4 h-4" style={{ color: "#34C759" }} /> : <Plus className="w-4 h-4 text-white" />}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                        style={{
                          background:
                            venue.ccf === "A"
                              ? "rgba(255,59,48,0.12)"
                              : venue.ccf === "B"
                                ? "rgba(255,149,0,0.12)"
                                : venue.ccf === "C"
                                  ? "rgba(0,122,255,0.12)"
                                  : "rgba(142,142,147,0.12)",
                          color:
                            venue.ccf === "A"
                              ? "#FF3B30"
                              : venue.ccf === "B"
                                ? "#FF9500"
                                : venue.ccf === "C"
                                  ? "#007AFF"
                                  : "#8E8E93",
                        }}
                      >
                        CCF {venue.ccf}
                      </span>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{
                          background: venue.type === "conference" ? "rgba(0,122,255,0.10)" : "rgba(175,82,222,0.10)",
                          color: venue.type === "conference" ? "#007AFF" : "#AF52DE",
                        }}
                      >
                        {venue.type === "conference" ? "会议" : "期刊"}
                      </span>
                      {venue.sci ? (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(52,199,89,0.12)", color: "#34C759" }}
                        >
                          SCI{venue.sciQuartile ? ` ${venue.sciQuartile}` : ""}
                        </span>
                      ) : null}
                      {venue.ei ? (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(88,86,214,0.12)", color: "#5856D6" }}
                        >
                          EI
                        </span>
                      ) : null}
                      <span className="text-[10px] text-ink-tertiary ml-auto">{venue.area}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--rc-border)" }}>
          <p className="text-xs text-ink-tertiary">
            共 {filteredVenueTemplates.length} 个结果，已追踪 {trackedCount} 个
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl text-sm font-medium transition-all duration-150"
            style={{ background: "var(--rc-surface)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

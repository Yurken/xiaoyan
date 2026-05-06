import { useEffect, useMemo, useState } from "react";
import { submissionApi } from "../../lib/client";
import {
  POPULAR_VENUES,
  getAllAreas,
  type VenueTemplate,
} from "../../data/venues";
import { useVenueRecommendations } from "./useVenueRecommendations";
import {
  getDaysUntil,
  rowToVenue,
  type Conference,
  type Journal,
  type Venue,
  type VenueType,
} from "./shared";

export function useSubmissionVenues(onError?: (error: unknown) => void) {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [venueFilter, setVenueFilter] = useState<"all" | "conference" | "journal" | "starred">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalSearch, setAddModalSearch] = useState("");
  const [addModalAreaFilter, setAddModalAreaFilter] = useState<string>("all");
  const [addModalTypeFilter, setAddModalTypeFilter] = useState<"all" | "conference" | "journal">("all");
  const {
    recInput,
    recommendations,
    recLoading,
    setRecInput,
    generateRecommendations,
  } = useVenueRecommendations(conferences, journals);

  useEffect(() => {
    let cancelled = false;

    submissionApi
      .listVenues()
      .then((response) => {
        if (cancelled) {
          return;
        }

        const venues = response.venues.map(rowToVenue);
        setConferences(venues.filter((venue): venue is Conference => venue.type === "conference"));
        setJournals(venues.filter((venue): venue is Journal => venue.type === "journal"));
      })
      .catch((error) => {
        onError?.(error);
      });

    return () => {
      cancelled = true;
    };
  }, [onError]);

  const allVenues = useMemo<Venue[]>(() => [...conferences, ...journals], [conferences, journals]);
  const visibleVenues = useMemo(
    () =>
      allVenues
        .filter((venue) => {
          if (venueFilter === "starred") return venue.starred;
          if (venueFilter === "conference") return venue.type === "conference";
          if (venueFilter === "journal") return venue.type === "journal";
          return true;
        })
        .sort((left, right) => {
          const leftDays =
            left.type === "conference"
              ? getDaysUntil(left.deadline)
              : left.specialIssueDeadline
                ? getDaysUntil(left.specialIssueDeadline)
                : 999;
          const rightDays =
            right.type === "conference"
              ? getDaysUntil(right.deadline)
              : right.specialIssueDeadline
                ? getDaysUntil(right.specialIssueDeadline)
                : 999;
          if (leftDays < 0 && rightDays >= 0) return 1;
          if (rightDays < 0 && leftDays >= 0) return -1;
          return leftDays - rightDays;
        }),
    [allVenues, venueFilter]
  );

  const toggleVenueStar = (id: string, type: VenueType) => {
    if (type === "conference") {
      setConferences((currentConferences) =>
        currentConferences.map((conference) =>
          conference.id === id ? { ...conference, starred: !conference.starred } : conference
        )
      );
    } else {
      setJournals((currentJournals) =>
        currentJournals.map((journal) => (journal.id === id ? { ...journal, starred: !journal.starred } : journal))
      );
    }
    submissionApi.toggleVenueStar(id).catch((error) => {
      onError?.(error);
    });
  };

  const handleAddVenue = async (template: VenueTemplate) => {
    const defaultConferenceDeadline =
      template.type === "conference" ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : null;

    try {
      const response = await submissionApi.createVenue({
        name: template.name,
        fullName: template.fullName,
        venueType: template.type,
        website: template.website,
        ccf: template.ccf,
        area: template.area,
        ei: template.ei,
        sci: template.sci,
        sciQuartile: template.sciQuartile,
        deadline: defaultConferenceDeadline?.toISOString().slice(0, 10),
      });

      if (template.type === "conference") {
        setConferences((currentConferences) => [
          ...currentConferences,
          {
            id: response.id,
            type: "conference",
            name: template.name,
            fullName: template.fullName,
            website: template.website,
            deadline: defaultConferenceDeadline ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            ccf: template.ccf,
            area: template.area,
            starred: false,
            ei: template.ei,
          },
        ]);
      } else {
        setJournals((currentJournals) => [
          ...currentJournals,
          {
            id: response.id,
            type: "journal",
            name: template.name,
            fullName: template.fullName,
            website: template.website,
            ccf: template.ccf,
            area: template.area,
            starred: false,
            sci: template.sci,
            sciQuartile: template.sciQuartile,
            ei: template.ei,
          },
        ]);
      }
    } catch (error) {
      onError?.(error);
      return;
    }

    setShowAddModal(false);
  };

  const isVenueAdded = (template: VenueTemplate) =>
    template.type === "conference"
      ? conferences.some((conference) => conference.name === template.name)
      : journals.some((journal) => journal.name === template.name);

  const filteredVenueTemplates = useMemo(
    () =>
      POPULAR_VENUES.filter((venue) => {
        const normalizedSearch = addModalSearch.toLowerCase();
        const matchesSearch =
          venue.name.toLowerCase().includes(normalizedSearch) ||
          venue.fullName.toLowerCase().includes(normalizedSearch);
        const matchesArea = addModalAreaFilter === "all" || venue.area === addModalAreaFilter;
        const matchesType = addModalTypeFilter === "all" || venue.type === addModalTypeFilter;
        return matchesSearch && matchesArea && matchesType;
      }),
    [addModalAreaFilter, addModalSearch, addModalTypeFilter]
  );

  return {
    conferences,
    journals,
    venueFilter,
    visibleVenues,
    showAddModal,
    addModalSearch,
    addModalAreaFilter,
    addModalTypeFilter,
    recInput,
    recommendations,
    recLoading,
    filteredVenueTemplates,
    areas: getAllAreas(),
    setVenueFilter,
    setShowAddModal,
    setAddModalSearch,
    setAddModalAreaFilter,
    setAddModalTypeFilter,
    setRecInput,
    toggleVenueStar,
    handleAddVenue,
    isVenueAdded,
    generateRecommendations,
  };
}

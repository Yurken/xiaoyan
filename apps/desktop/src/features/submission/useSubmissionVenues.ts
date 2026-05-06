import { useCallback, useEffect, useMemo, useState } from "react";
import { ccfApi, submissionApi } from "../../lib/client";
import {
  POPULAR_VENUES,
  buildVenueTemplatesFromCcfCatalog,
  filterVenueTemplates,
  getAllAreas,
  getVenueTemplateDates,
  normalizeVenueKey,
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
  const [loadedVenueTemplates, setLoadedVenueTemplates] = useState<VenueTemplate[]>([]);
  const [venueTemplateLoading, setVenueTemplateLoading] = useState(true);
  const venueTemplates = loadedVenueTemplates.length > 0 ? loadedVenueTemplates : POPULAR_VENUES;
  const {
    recInput,
    recommendations,
    recLoading,
    setRecInput,
    generateRecommendations,
  } = useVenueRecommendations(conferences, journals, venueTemplates);

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

  useEffect(() => {
    let cancelled = false;

    ccfApi
      .list()
      .then((response) => {
        if (!cancelled) {
          setLoadedVenueTemplates(buildVenueTemplatesFromCcfCatalog(response.venues));
        }
      })
      .catch((error) => {
        onError?.(error);
      })
      .finally(() => {
        if (!cancelled) {
          setVenueTemplateLoading(false);
        }
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
              ? left.deadline ? getDaysUntil(left.deadline) : 9999
              : left.specialIssueDeadline
                ? getDaysUntil(left.specialIssueDeadline)
                : 9999;
          const rightDays =
            right.type === "conference"
              ? right.deadline ? getDaysUntil(right.deadline) : 9999
              : right.specialIssueDeadline
                ? getDaysUntil(right.specialIssueDeadline)
                : 9999;
          if (leftDays < 0 && rightDays >= 0) return 1;
          if (rightDays < 0 && leftDays >= 0) return -1;
          return leftDays - rightDays;
        }),
    [allVenues, venueFilter]
  );

  const areas = useMemo(() => getAllAreas(venueTemplates), [venueTemplates]);

  const filteredVenueTemplates = useMemo(
    () =>
      filterVenueTemplates({
        area: addModalAreaFilter,
        query: addModalSearch,
        templates: venueTemplates,
        type: addModalTypeFilter,
      }),
    [addModalAreaFilter, addModalSearch, addModalTypeFilter, venueTemplates]
  );

  const toggleVenueStar = useCallback((id: string, type: VenueType) => {
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
  }, [onError]);

  const handleAddVenue = useCallback(async (template: VenueTemplate) => {
    const dates = getVenueTemplateDates(template);

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
        deadline: dates.deadline,
        notificationDate: dates.notificationDate,
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
            deadline: dates.deadline ? new Date(dates.deadline) : undefined,
            notificationDate: dates.notificationDate ? new Date(dates.notificationDate) : undefined,
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
  }, [onError]);

  const isVenueAdded = useCallback(
    (template: VenueTemplate) => {
      const templateName = normalizeVenueKey(template.name);
      const templateFullName = normalizeVenueKey(template.fullName);
      return allVenues.some((venue) => {
        const venueName = normalizeVenueKey(venue.name);
        const venueFullName = normalizeVenueKey(venue.fullName);
        return venueName === templateName || venueFullName === templateFullName;
      });
    },
    [allVenues]
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
    areas,
    venueTemplateLoading,
    venueTemplates,
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

import { useEffect, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { ResearchTheme, ResearchActivityEvent } from "./shared";

export function useResearchThemes(limit = 3) {
  const [themes, setThemes] = useState<ResearchTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiClient.researchContext
      .getRecentThemes(limit)
      .then((data) => {
        if (cancelled) return;
        setThemes(data);
        setLoading(false);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setThemes([]);
        setLoading(false);
        setError(formatErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { themes, loading, error };
}

export function useThemeContext(themeId: string) {
  const [theme, setTheme] = useState<ResearchTheme | null>(null);
  const [events, setEvents] = useState<ResearchActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!themeId) return;
    
    let cancelled = false;
    setLoading(true);

    apiClient.researchContext
      .getThemeContext(themeId)
      .then(({ theme, events }) => {
        if (cancelled) return;
        setTheme(theme);
        setEvents(events);
        setLoading(false);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setTheme(null);
        setEvents([]);
        setLoading(false);
        setError(formatErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [themeId]);

  return { theme, events, loading, error };
}

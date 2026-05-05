import { useEffect, useState } from "react";
import { apiClient } from "../../lib/client";
import {
  COMPANION_PREFERENCE_EVENT,
  COMPANION_PREFERENCE_STORAGE_KEY,
  DEFAULT_COMPANION_ID,
  normalizeCompanionId,
  type CompanionId,
} from "./shared";

function readStoredPreference(): CompanionId {
  if (typeof window === "undefined") {
    return DEFAULT_COMPANION_ID;
  }
  return normalizeCompanionId(window.localStorage.getItem(COMPANION_PREFERENCE_STORAGE_KEY));
}

export function useCompanionPreference() {
  const [companionId, setCompanionId] = useState<CompanionId>(() => readStoredPreference());

  useEffect(() => {
    let cancelled = false;
    void apiClient.settings.get()
      .then((settings) => {
        if (cancelled) return;
        const next = normalizeCompanionId(settings.xiaoyan_companion_id);
        window.localStorage.setItem(COMPANION_PREFERENCE_STORAGE_KEY, next);
        setCompanionId(next);
      })
      .catch(() => {
        if (!cancelled) {
          setCompanionId(readStoredPreference());
        }
      });

    const onPreferenceChange = (event: Event) => {
      const next = normalizeCompanionId((event as CustomEvent<{ id?: string }>).detail?.id);
      setCompanionId(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === COMPANION_PREFERENCE_STORAGE_KEY) {
        setCompanionId(normalizeCompanionId(event.newValue));
      }
    };

    window.addEventListener(COMPANION_PREFERENCE_EVENT, onPreferenceChange);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener(COMPANION_PREFERENCE_EVENT, onPreferenceChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return companionId;
}

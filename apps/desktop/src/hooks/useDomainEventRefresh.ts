import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

export function useDomainEventRefresh(
  eventName: string,
  onRefresh: () => void,
  active = true
) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const p = listen(eventName, () => {
      if (!cancelled) onRefresh();
    });
    return () => {
      cancelled = true;
      p.then((unlisten) => unlisten());
    };
  }, [eventName, onRefresh, active]);
}

import { useEffect } from "react";
import { safeListen } from "../lib/tauriEvent";

export function useDomainEventRefresh(
  eventName: string,
  onRefresh: () => void,
  active = true
) {
  useEffect(() => {
    if (!active) return;
    let unlisten: (() => void) | undefined;
    let mounted = true;
    void safeListen(eventName, () => {
      if (mounted) onRefresh();
    }).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });
    return () => {
      mounted = false;
      unlisten?.();
      unlisten = undefined;
    };
  }, [eventName, onRefresh, active]);
}

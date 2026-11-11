import { useCallback, useEffect, useRef, useState } from "react";

/** Reserve room for the editor before opening the outline beside split previews. */
export function useWritingPanelLayout(ready: boolean) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(true);
  const [sidebarPreference, setSidebarPreference] = useState<boolean | null>(null);

  useEffect(() => {
    if (!ready) return;
    const element = layoutRef.current;
    if (!element) return;
    const measure = () => setCompact(element.clientWidth < 1120);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready]);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarPreference(collapsed);
  }, []);

  return {
    layoutRef,
    compact,
    sidebarCollapsed: sidebarPreference ?? compact,
    setSidebarCollapsed,
  };
}

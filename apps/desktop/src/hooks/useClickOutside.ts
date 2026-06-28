import { useEffect, useRef } from "react";

/**
 * Returns a ref to attach to a container element.
 * Calls `onClose` whenever a mousedown event fires outside that container.
 * Only registers the listener while `isOpen` is true.
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose: () => void,
): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return ref;
}

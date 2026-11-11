import { useEffect, type RefObject } from "react";

/** Keep keyboard focus in the library, while allowing its editing and confirmation layers. */
export function useCopilotSkillLibraryFocus(open: boolean, dialogRef: RefObject<HTMLDivElement | null>, closeRef: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    let lastFocus: HTMLElement | null = closeRef.current;
    const restoreLibraryFocus = () => {
      const dialog = dialogRef.current;
      if (!dialog?.isConnected) return;
      // Editing and confirmation dialogs are separate portals above this one.
      if ([...document.querySelectorAll('[role="dialog"]')].some((element) => element !== dialog)) return;
      if (!dialog.contains(document.activeElement)) {
        (lastFocus?.isConnected && dialog.contains(lastFocus) ? lastFocus : closeRef.current)?.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && dialogRef.current?.contains(event.target)) lastFocus = event.target;
      else restoreLibraryFocus();
    };
    closeRef.current?.focus();
    document.addEventListener("focusin", onFocus);
    const observer = new MutationObserver(restoreLibraryFocus);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", onFocus);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open, dialogRef, closeRef]);
}

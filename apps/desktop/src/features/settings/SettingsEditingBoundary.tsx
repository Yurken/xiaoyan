import type { ReactNode, SyntheticEvent } from "react";

interface SettingsEditingBoundaryProps {
  locked: boolean;
  children: ReactNode;
}

/** Native controls inherit disabled; capture also blocks custom clickable rows. */
export default function SettingsEditingBoundary({ locked, children }: SettingsEditingBoundaryProps) {
  const blockWhenLocked = (event: SyntheticEvent<HTMLFieldSetElement>) => {
    if (!locked) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <fieldset
      disabled={locked}
      aria-busy={locked}
      className="min-w-0 space-y-5 border-0 p-0"
      onClickCapture={blockWhenLocked}
      onMouseDownCapture={blockWhenLocked}
      onKeyDownCapture={(event) => {
        if (event.key === "Tab" || event.key === "Escape") return;
        blockWhenLocked(event);
      }}
    >
      {children}
    </fieldset>
  );
}

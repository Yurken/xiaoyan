import { usePersistentStringState } from "../../hooks/usePersistentStringState";
import type { PaperDisplayMode } from "./shared";

const PAPER_DISPLAY_MODES: readonly PaperDisplayMode[] = ["card", "minimal"];

export function usePaperDisplayMode() {
  return usePersistentStringState<PaperDisplayMode>(
    "rc:papers:display-mode",
    "card",
    PAPER_DISPLAY_MODES,
  );
}

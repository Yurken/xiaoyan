import { useEffect, useState } from "react";
import type { WritingCompileStatus } from "./shared";

interface CompileFlashState {
  draftId: string;
  status: WritingCompileStatus;
  token: object | null;
}

/** A success flash belongs to one transition in one draft, not to the button mount. */
export function useWritingCompileFlash(draftId: string, status: WritingCompileStatus) {
  const [state, setState] = useState<CompileFlashState>(() => ({ draftId, status, token: null }));
  let current = state;
  if (state.draftId !== draftId || state.status !== status) {
    const enteredReady = state.draftId === draftId && state.status !== "ready" && status === "ready";
    current = { draftId, status, token: enteredReady ? {} : null };
    // Reset before children render: a new draft or compiling state must not show
    // the previous success while waiting for an effect.
    setState(current);
  }
  const { token } = current;

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => {
      setState((latest) => latest.token === token ? { ...latest, token: null } : latest);
    }, 3000);
    return () => clearTimeout(timer);
  }, [token]);

  return token !== null;
}

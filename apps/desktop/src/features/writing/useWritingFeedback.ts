import { useCallback, useState } from "react";

interface WritingFeedback {
  scope: { draftId: string };
  message: string;
  error: string;
}

function emptyFeedback(draftId: string): WritingFeedback {
  return { scope: { draftId }, message: "", error: "" };
}

/** Messages belong to one visit to a draft, including callbacks already in flight. */
export function useWritingFeedback(draftId: string) {
  const [feedback, setFeedback] = useState(() => emptyFeedback(draftId));
  let current = feedback;
  if (feedback.scope.draftId !== draftId) {
    current = emptyFeedback(draftId);
    setFeedback(current);
  }
  const { scope, message, error } = current;

  const clearStatus = useCallback(() => {
    setFeedback((previous) => previous.scope === scope
      ? { ...previous, message: "", error: "" }
      : previous);
  }, [scope]);

  const showMessage = useCallback((nextMessage: string, targetDraftId = scope.draftId) => {
    // Only synchronous create/delete navigation supplies a destination. Async
    // callbacks keep their originating scope and cannot choose a new draft.
    setFeedback((previous) => previous.scope === scope
      ? {
        ...previous,
        scope: targetDraftId === scope.draftId ? scope : { draftId: targetDraftId },
        message: nextMessage,
        error: "",
      }
      : previous);
  }, [scope]);

  const showError = useCallback((nextError: string) => {
    setFeedback((previous) => previous.scope === scope
      ? { ...previous, error: nextError }
      : previous);
  }, [scope]);

  return { message, error, clearStatus, showMessage, showError };
}

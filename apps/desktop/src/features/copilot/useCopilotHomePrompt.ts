import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Consume a homepage submission once, in a fresh general conversation. */
export function useCopilotHomePrompt(options: {
  prepare: (prompt: string) => void;
  input: string;
  ready: boolean;
  send: () => Promise<void>;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const pending = useRef<{ text: string; prepared: boolean; sent: boolean } | null>(null);
  const state = location.state as { homePrompt?: unknown } | null;
  if (!pending.current && typeof state?.homePrompt === "string" && state.homePrompt.trim()) {
    pending.current = { text: state.homePrompt.trim(), prepared: false, sent: false };
  }
  useEffect(() => {
    const submission = pending.current;
    if (!submission || submission.sent) return;
    if (!submission.prepared) {
      submission.prepared = true;
      options.prepare(submission.text);
      // Remove the command from history so Back/Forward cannot send it again.
      navigate(location.pathname + location.search, { replace: true, state: null });
      return;
    }
    if (options.ready && options.input === submission.text) {
      submission.sent = true;
      void options.send();
    }
  }, [location.pathname, location.search, navigate, options]);
  return pending.current !== null;
}

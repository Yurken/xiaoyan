import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { StructuredSurveyResult, SurveyAgentState } from "./shared";

interface SurveyGenerationResultState {
  agents: SurveyAgentState[];
  structured: StructuredSurveyResult | null;
  content: string;
  error: string;
}

interface ClearSurveyGenerationResultOptions {
  cleanupSurveyListeners: () => void;
  clearSnapshot: () => void;
  contentRef: MutableRefObject<string>;
  requestIdRef: MutableRefObject<string | null>;
  setContent: Dispatch<SetStateAction<string>>;
  setAgents: Dispatch<SetStateAction<SurveyAgentState[]>>;
  setStructured: Dispatch<SetStateAction<StructuredSurveyResult | null>>;
  setError: Dispatch<SetStateAction<string>>;
  setActionMessage: Dispatch<SetStateAction<string>>;
  setActionError: Dispatch<SetStateAction<string>>;
  setGenerating: Dispatch<SetStateAction<boolean>>;
}

export function hasSurveyGenerationResultState({
  agents,
  structured,
  content,
  error,
}: SurveyGenerationResultState) {
  return agents.length > 0 || Boolean(structured) || Boolean(content.trim()) || Boolean(error.trim());
}

export function clearSurveyGenerationResult({
  cleanupSurveyListeners,
  clearSnapshot,
  contentRef,
  requestIdRef,
  setContent,
  setAgents,
  setStructured,
  setError,
  setActionMessage,
  setActionError,
  setGenerating,
}: ClearSurveyGenerationResultOptions) {
  cleanupSurveyListeners();
  clearSnapshot();
  requestIdRef.current = null;
  contentRef.current = "";
  setContent("");
  setAgents([]);
  setStructured(null);
  setError("");
  setActionMessage("");
  setActionError("");
  setGenerating(false);
}

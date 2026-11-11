import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Skill } from "@research-copilot/types";
import { apiClient } from "../../lib/client";

interface CopilotSkillsState {
  skills: Skill[];
  selectedSkillId: string | null;
  skillLocked: boolean;
}

type SkillsAction =
  | { type: "replace"; skills: Skill[] }
  | { type: "select"; id: string | null }
  | { type: "lock"; locked: boolean }
  | { type: "consume" };

function reduceSkills(state: CopilotSkillsState, action: SkillsAction): CopilotSkillsState {
  switch (action.type) {
    case "replace": {
      const skills = action.skills.filter((skill) => skill.is_enabled);
      const selectedSkillId = skills.some((skill) => skill.id === state.selectedSkillId)
        ? state.selectedSkillId : null;
      return { skills, selectedSkillId, skillLocked: selectedSkillId ? state.skillLocked : false };
    }
    case "select":
      return { ...state, selectedSkillId: action.id, skillLocked: action.id ? state.skillLocked : false };
    case "lock":
      return { ...state, skillLocked: action.locked };
    case "consume":
      return state.skillLocked ? state : { ...state, selectedSkillId: null };
  }
}

export function useCopilotSkills() {
  const [state, dispatch] = useReducer(reduceSkills, { skills: [], selectedSkillId: null, skillLocked: false });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const revision = useRef(0);

  const updateSkills = useCallback((skills: Skill[]) => {
    revision.current += 1;
    dispatch({ type: "replace", skills });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestRevision = revision.current;
    void apiClient.skills.list().then((skills) => {
      // A slower initial read must not overwrite edits made in the library.
      if (!cancelled && revision.current === requestRevision) updateSkills(skills);
    }).catch((error) => console.warn("Failed to load skills:", error));
    return () => { cancelled = true; };
  }, [updateSkills]);

  return {
    ...state,
    libraryOpen,
    updateSkills,
    setSelectedSkillId: useCallback((id: string | null) => dispatch({ type: "select", id }), []),
    setSkillLocked: useCallback((locked: boolean) => dispatch({ type: "lock", locked }), []),
    onSkillConsumed: useCallback(() => dispatch({ type: "consume" }), []),
    openLibrary: useCallback(() => setLibraryOpen(true), []),
    closeLibrary: useCallback(() => setLibraryOpen(false), []),
  };
}

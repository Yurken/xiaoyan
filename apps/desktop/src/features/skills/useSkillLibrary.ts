import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Skill } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";
import {
  filterSkills,
  mergeBuiltinSkills,
  skillDraftPayload,
  upsertSkill,
  type SkillConfirmation,
  type SkillDraft,
  type SkillEditTarget,
  type SkillLibraryOptions,
  type SkillOperation,
} from "./shared";

export function useSkillLibrary({ onSkillsChange }: SkillLibraryOptions = {}) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [editingSkill, setEditingSkill] = useState<SkillEditTarget>(null);
  const [confirmState, setConfirmState] = useState<SkillConfirmation>(null);
  const [operation, setOperation] = useState<SkillOperation>(null);
  const [search, setSearch] = useState("");
  const skillsRef = useRef<Skill[]>([]);
  const mountedRef = useRef(false);
  const callbackRef = useRef(onSkillsChange);
  const operationRef = useRef<SkillOperation>(null);
  const loadIdRef = useRef(0);

  useEffect(() => { callbackRef.current = onSkillsChange; }, [onSkillsChange]);

  const publish = useCallback((next: Skill[]) => {
    skillsRef.current = next;
    if (mountedRef.current) setSkills(next);
    callbackRef.current?.(next);
  }, []);

  const reload = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setError("");
    try {
      const next = await apiClient.skills.list();
      if (mountedRef.current && loadId === loadIdRef.current) publish(next);
    } catch (nextError) {
      if (mountedRef.current && loadId === loadIdRef.current) setError(formatErrorMessage(nextError));
    } finally {
      if (mountedRef.current && loadId === loadIdRef.current) setLoading(false);
    }
  }, [publish]);

  useEffect(() => {
    mountedRef.current = true;
    void reload();
    return () => {
      mountedRef.current = false;
      loadIdRef.current += 1;
    };
  }, [reload]);

  const begin = (next: Exclude<SkillOperation, null>) => {
    if (operationRef.current || loading) return false;
    operationRef.current = next;
    setOperation(next);
    return true;
  };
  const finish = () => {
    operationRef.current = null;
    if (mountedRef.current) setOperation(null);
  };
  const reportError = (nextError: unknown, editing = false) => {
    if (mountedRef.current) (editing ? setEditError : setError)(formatErrorMessage(nextError));
  };

  const toggle = async (skill: Skill) => {
    if (!begin(`toggle:${skill.id}`)) return;
    setError("");
    try {
      const updated = await apiClient.skills.update(skill.id, { is_enabled: !skill.is_enabled });
      publish(upsertSkill(skillsRef.current, updated));
    } catch (nextError) { reportError(nextError); }
    finally { finish(); }
  };

  const save = async (draft: SkillDraft) => {
    if (editingSkill === null || !begin("save")) return;
    setEditError("");
    try {
      const payload = skillDraftPayload(draft);
      const updated = editingSkill === "new"
        ? await apiClient.skills.create(payload)
        : await apiClient.skills.update(editingSkill.id, payload);
      publish(upsertSkill(skillsRef.current, updated));
      if (mountedRef.current) setEditingSkill(null);
    } catch (nextError) { reportError(nextError, true); }
    finally { finish(); }
  };

  const remove = async (skill: Skill) => {
    if (!begin("delete")) return;
    setError("");
    try {
      await apiClient.skills.delete(skill.id);
      publish(skillsRef.current.filter((item) => item.id !== skill.id));
      if (mountedRef.current) setConfirmState(null);
    } catch (nextError) { reportError(nextError); }
    finally { finish(); }
  };

  const enableAll = async () => {
    if (!begin("enableAll")) return;
    setError("");
    try {
      const disabled = skillsRef.current.filter((skill) => !skill.is_enabled);
      const results = await Promise.allSettled(disabled.map((skill) => apiClient.skills.update(skill.id, { is_enabled: true })));
      const updated = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      if (updated.length > 0) publish(updated.reduce(upsertSkill, skillsRef.current));
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") reportError(failed.reason);
    } catch (nextError) { reportError(nextError); }
    finally { finish(); }
  };

  const resetBuiltins = async (forEditor = false): Promise<Skill | null> => {
    if (!begin("reset")) return null;
    if (forEditor) setEditError("");
    else setError("");
    try {
      const updated = await apiClient.skills.resetBuiltins();
      publish(mergeBuiltinSkills(skillsRef.current, updated));
      if (mountedRef.current) setConfirmState(null);
      return editingSkill && editingSkill !== "new"
        ? updated.find((skill) => skill.id === editingSkill.id) ?? null
        : null;
    } catch (nextError) {
      reportError(nextError, forEditor);
      return null;
    } finally { finish(); }
  };

  const openEditor = (skill: Skill | "new") => {
    if (operationRef.current) return;
    setEditError("");
    setEditingSkill(skill);
  };
  const closeEditor = () => {
    if (!operationRef.current) setEditingSkill(null);
  };
  const closeConfirmation = () => {
    if (!operationRef.current) setConfirmState(null);
  };
  const confirm = () => {
    if (confirmState?.type === "delete") void remove(confirmState.skill);
    else if (confirmState?.type === "resetBuiltins") void resetBuiltins();
  };
  const filtered = useMemo(() => filterSkills(skills, search), [search, skills]);

  return {
    skills, loading, error, editError, search, setSearch, editingSkill, confirmState, operation,
    busy: loading || operation !== null,
    builtin: filtered.filter((skill) => skill.is_builtin),
    custom: filtered.filter((skill) => !skill.is_builtin),
    builtinTotal: skills.filter((skill) => skill.is_builtin).length,
    filteredCount: filtered.length,
    reload, toggle, save, enableAll, openEditor, closeEditor, closeConfirmation, confirm,
    requestDelete: (skill: Skill) => setConfirmState({ type: "delete", skill }),
    requestReset: () => setConfirmState({ type: "resetBuiltins" }),
    resetForEditor: () => resetBuiltins(true),
  };
}

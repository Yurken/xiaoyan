import type { Skill } from "@research-copilot/types";

export interface SkillLibraryOptions {
  onSkillsChange?: (skills: Skill[]) => void;
}

export interface SkillDraft {
  name: string;
  title: string;
  description: string;
  prompt: string;
  tagsInput: string;
}

export type SkillEditTarget = Skill | "new" | null;
export type SkillConfirmation = { type: "delete"; skill: Skill } | { type: "resetBuiltins" } | null;
export type SkillOperation = "save" | "reset" | "enableAll" | "delete" | `toggle:${string}` | null;

export const SKILL_TAG_STYLES: Record<string, { background: string; color: string }> = {
  prompt: { background: "var(--rc-info-chip-bg)", color: "var(--rc-info-chip-text)" },
  writing: { background: "var(--rc-badge-purple-bg)", color: "var(--rc-badge-purple-text)" },
  reasoning: { background: "var(--rc-badge-warning-bg)", color: "var(--rc-badge-warning-text)" },
  coding: { background: "var(--rc-badge-success-bg)", color: "var(--rc-badge-success-text)" },
  research: { background: "var(--rc-info-chip-bg)", color: "var(--rc-info-chip-text)" },
};

export const SKILL_CONTROL_STYLE = {
  background: "var(--rc-control-bg)",
  color: "var(--rc-text)",
  border: "1px solid var(--rc-control-border)",
  boxShadow: "var(--rc-control-shadow)",
} as const;

export const RESET_BUILTINS_DESCRIPTION = "确认将所有内置技能恢复为默认内容吗？你对内置技能的修改会被覆盖，自定义技能不受影响。";

export function createSkillDraft(skill: Skill | null): SkillDraft {
  return {
    name: skill?.name ?? "",
    title: skill?.title ?? "",
    description: skill?.description ?? "",
    prompt: skill?.prompt ?? "",
    tagsInput: skill?.tags.join("、") ?? "",
  };
}

export function skillDraftPayload(draft: SkillDraft) {
  return {
    name: draft.name.trim(),
    title: draft.title.trim(),
    description: draft.description.trim(),
    prompt: draft.prompt,
    tags: [...new Set(draft.tagsInput.split(/[,，、\s]+/).map((tag) => tag.trim()).filter(Boolean))],
  };
}

export function filterSkills(skills: Skill[], search: string): Skill[] {
  const query = search.trim().toLowerCase();
  if (!query) return skills;
  return skills.filter((skill) => [skill.title, skill.name, skill.description, ...skill.tags]
    .some((value) => value.toLowerCase().includes(query)));
}

export function upsertSkill(skills: Skill[], updated: Skill): Skill[] {
  return skills.some((skill) => skill.id === updated.id)
    ? skills.map((skill) => skill.id === updated.id ? updated : skill)
    : [...skills, updated];
}

/** Reset responses can contain the complete library; keep custom skills exactly once. */
export function mergeBuiltinSkills(skills: Skill[], updated: Skill[]): Skill[] {
  const updatedIds = new Set(updated.map((skill) => skill.id));
  return [...updated, ...skills.filter((skill) => !skill.is_builtin && !updatedIds.has(skill.id))];
}

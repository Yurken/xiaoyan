import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Badge, IconButton } from "@research-copilot/ui";
import type { Skill } from "@research-copilot/types";
import { SKILL_TAG_STYLES } from "./shared";

interface SkillCardProps {
  skill: Skill;
  disabled: boolean;
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SkillCard({ skill, disabled, toggling, onToggle, onEdit, onDelete }: SkillCardProps) {
  return (
    <article
      className="flex min-w-0 flex-col gap-3 rounded-[22px] border p-4 transition-[background,box-shadow] duration-150"
      style={{
        background: skill.is_enabled ? "var(--rc-card-bg)" : "var(--rc-card-inset-bg)",
        borderColor: skill.is_enabled ? "var(--rc-card-outline)" : "var(--rc-card-inset-outline)",
        boxShadow: skill.is_enabled ? "var(--rc-card-shadow)" : "var(--rc-card-inset-shadow)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="break-words text-sm font-semibold leading-5 text-ink-primary">{skill.title}</h3>
        {skill.is_builtin ? <Badge variant="info">内置</Badge> : null}
        {skill.kind === "tool" ? <span title="工具技能通过专用流程执行，可在对话中选择，也可在工具页使用。"><Badge variant="warning">工具</Badge></span> : null}
        <code className="max-w-full break-all rounded-md px-1.5 py-0.5 font-mono text-xs" style={{ background: "var(--rc-chip-inset-bg)", color: "var(--rc-text-muted)" }}>/{skill.name}</code>
      </div>
      {skill.description ? <p className="break-words text-xs leading-5 text-ink-tertiary">{skill.description}</p> : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1">
          {skill.tags.map((tag) => (
            <span
              key={tag}
              className="max-w-full break-all rounded-lg px-2 py-0.5 text-xs font-medium"
              style={SKILL_TAG_STYLES[tag] ?? { background: "var(--rc-badge-bg)", color: "var(--rc-badge-text)" }}
            >{tag}</span>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <IconButton size="sm" disabled={disabled} title="编辑" aria-label={`编辑技能 ${skill.title}`} onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></IconButton>
          {!skill.is_builtin ? <IconButton size="sm" disabled={disabled} title="删除" aria-label={`删除技能 ${skill.title}`} onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></IconButton> : null}
          <button
            type="button"
            role="switch"
            aria-checked={skill.is_enabled}
            aria-label={`${skill.is_enabled ? "禁用" : "启用"}技能 ${skill.title}`}
            title={skill.is_enabled ? "禁用" : "启用"}
            disabled={disabled}
            onClick={onToggle}
            className="relative h-6 w-10 shrink-0 overflow-hidden rounded-full transition-colors disabled:cursor-wait"
            style={{ background: skill.is_enabled ? "var(--rc-toggle-on-bg)" : "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}
          >
            <span
              className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full transition-transform duration-200"
              style={{ background: "var(--rc-toggle-knob-bg)", boxShadow: "var(--rc-toggle-knob-shadow)", transform: skill.is_enabled ? "translateX(16px)" : "translateX(0)" }}
            >{toggling ? <Loader2 className="h-3 w-3 animate-spin text-apple-blue" /> : null}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

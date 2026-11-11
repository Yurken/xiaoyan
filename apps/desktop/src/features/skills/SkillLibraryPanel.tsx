import { AlertCircle, CheckCircle, Loader2, Plus, RefreshCw, Search, Zap } from "lucide-react";
import { Button, ConfirmDialog, Input } from "@research-copilot/ui";
import { SkillCard } from "./SkillCard";
import { SkillEditModal } from "./SkillEditModal";
import { RESET_BUILTINS_DESCRIPTION, type SkillLibraryOptions } from "./shared";
import { useSkillLibrary } from "./useSkillLibrary";

export function SkillLibraryPanel({ onSkillsChange }: SkillLibraryOptions) {
  const library = useSkillLibrary({ onSkillsChange });
  const confirming = library.operation === "delete" || library.operation === "reset";

  return (
    <section className="min-w-0 space-y-4" aria-busy={library.busy}>
      {library.editingSkill !== null ? (
        <SkillEditModal
          key={library.editingSkill === "new" ? "new" : library.editingSkill.id}
          skill={library.editingSkill === "new" ? null : library.editingSkill}
          saving={library.operation === "save"}
          resetting={library.operation === "reset"}
          error={library.editError}
          onSave={library.save}
          onReset={library.resetForEditor}
          onClose={library.closeEditor}
        />
      ) : null}
      <ConfirmDialog
        open={library.confirmState !== null}
        title={library.confirmState?.type === "delete" ? "删除技能" : "重置内置技能"}
        description={library.confirmState?.type === "delete"
          ? `确认删除技能「${library.confirmState.skill.title}」吗？删除后无法恢复。`
          : RESET_BUILTINS_DESCRIPTION}
        confirmLabel={library.confirmState?.type === "delete" ? "确认删除" : "确认重置"}
        tone="danger"
        loading={confirming}
        onClose={library.closeConfirmation}
        onConfirm={library.confirm}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--rc-info-chip-bg)", color: "var(--rc-info-chip-text)" }}><Zap className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-primary">技能库</h2>
            <p className="mt-0.5 text-xs leading-5 text-ink-tertiary">
              {library.builtinTotal > 0 ? `内置 ${library.builtinTotal} 条研究技能，` : ""}支持 / 唤起、{"{{变量}}"} 占位，也可新建自定义技能
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={library.busy} loading={library.operation === "enableAll"} onClick={() => void library.enableAll()}>
            <CheckCircle className="h-3.5 w-3.5" />全部打开
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={library.busy} onClick={library.requestReset}>
            <RefreshCw className="h-3.5 w-3.5" />重置内置
          </Button>
          <Button type="button" size="sm" disabled={library.busy} onClick={() => library.openEditor("new")}>
            <Plus className="h-3.5 w-3.5" />新建技能
          </Button>
        </div>
      </div>

      {library.error ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: "var(--rc-badge-danger-bg)", color: "var(--rc-badge-danger-text)" }}>
          <AlertCircle className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-words">{library.error}</span>
          {library.skills.length === 0 ? <Button type="button" size="sm" variant="ghost" onClick={() => void library.reload()}>重试</Button> : null}
        </div>
      ) : null}
      {library.loading ? (
        <div role="status" className="flex items-center gap-2 py-4 text-sm text-ink-tertiary"><Loader2 className="h-4 w-4 animate-spin" />加载技能库…</div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-ink-tertiary" />
            <Input value={library.search} onChange={(event) => library.setSearch(event.target.value)} aria-label="搜索技能" placeholder="搜索技能名称、标签或描述…" className="pl-9" />
          </div>
          {([
            { title: "自定义", skills: library.custom },
            { title: `内置技能（共 ${library.builtin.length} 条）`, skills: library.builtin },
          ]).map((group) => group.skills.length > 0 ? (
            <div key={group.title} className="space-y-2">
              <p className="ml-1 text-xs font-semibold tracking-wide text-ink-tertiary">{group.title}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {group.skills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    disabled={library.busy}
                    toggling={library.operation === `toggle:${skill.id}`}
                    onToggle={() => void library.toggle(skill)}
                    onEdit={() => library.openEditor(skill)}
                    onDelete={() => library.requestDelete(skill)}
                  />
                ))}
              </div>
            </div>
          ) : null)}
          {library.filteredCount === 0 && !library.error ? <p className="py-8 text-center text-sm text-ink-tertiary">{library.search ? `没有匹配「${library.search}」的技能` : "还没有任何技能，点击上方新建"}</p> : null}
        </>
      )}
    </section>
  );
}

export default SkillLibraryPanel;

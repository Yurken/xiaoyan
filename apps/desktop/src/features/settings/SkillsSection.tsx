import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { Skill } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  prompt: { bg: "rgba(10,132,255,0.10)", text: "#0A84FF" },
  writing: { bg: "rgba(175,82,222,0.12)", text: "#AF52DE" },
  reasoning: { bg: "rgba(255,149,0,0.12)", text: "#FF9500" },
  coding: { bg: "rgba(52,199,89,0.12)", text: "#34C759" },
  research: { bg: "rgba(48,176,199,0.12)", text: "#30B0C7" },
};

function SectionIcon({
  icon: Icon,
  color,
}: {
  icon: ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{
        background: `${color}12`,
        color,
        boxShadow: "var(--rc-chip-shadow)",
      }}
    >
      <Icon className="w-5 h-5" />
    </div>
  );
}

function TagBadge({ tag }: { tag: string }) {
  const color = TAG_COLORS[tag] ?? { bg: "rgba(120,120,128,0.10)", text: "#8E8E93" };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium"
      style={{ background: color.bg, color: color.text }}
    >
      {tag}
    </span>
  );
}

function SkillEditModal({
  skill,
  onSave,
  onClose,
}: {
  skill: Skill | null;
  onSave: (skill: Skill) => void;
  onClose: () => void;
}) {
  const isCreate = skill === null;
  const [name, setName] = useState(skill?.name ?? "");
  const [title, setTitle] = useState(skill?.title ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [prompt, setPrompt] = useState(skill?.prompt ?? "");
  const [tagsInput, setTagsInput] = useState(skill?.tags.join("、") ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!skill?.is_builtin) return;
    if (!window.confirm(`重置「${skill.title}」为默认内容？当前编辑将被覆盖。`)) return;
    setResetting(true);
    setError("");
    try {
      const builtins = await apiClient.skills.resetBuiltins();
      const original = builtins.find((item) => item.id === skill.id);
      if (original) {
        setTitle(original.title);
        setDescription(original.description);
        setPrompt(original.prompt);
        setTagsInput(original.tags.join("、"));
      }
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setResetting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const tags = tagsInput
        .split(/[,，、\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean);

      const result = isCreate
        ? await apiClient.skills.create({ name, title, description, prompt, tags })
        : await apiClient.skills.update(skill!.id, { title, description, prompt, tags });

      onSave(result);
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-[28px] p-6 space-y-4 overflow-y-auto max-h-[90vh]"
        style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-primary">{isCreate ? "新建技能" : "编辑技能"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink-tertiary hover:text-ink-secondary transition-colors"
            style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isCreate ? (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink-tertiary ml-1">
              技能标识（唯一名称，用于 /name 触发）
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：my-skill（英文、数字、连字符）"
              className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none"
              style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-ink-tertiary ml-1">显示标题</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：我的分析技能"
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-ink-tertiary ml-1">简短描述</label>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="用一句话说明这个技能的用途"
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-ink-tertiary ml-1">提示词模板</label>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={8}
            placeholder="在此输入提示词模板，支持 {{变量名}} 占位符…"
            className="w-full rounded-2xl px-4 py-3 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none resize-none font-mono leading-6"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-ink-tertiary ml-1">标签（逗号 / 顿号分隔）</label>
          <input
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="例如：论文、分析"
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          />
        </div>

        {error ? (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            {!isCreate && skill?.is_builtin ? (
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium text-ink-tertiary hover:text-ink-secondary transition-all disabled:opacity-50"
                style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
              >
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                重置默认
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-2xl text-sm font-medium text-ink-secondary transition-all"
              style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-2xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
                boxShadow: "4px 4px 10px rgba(0,62,204,0.3)",
              }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {isCreate ? "创建" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  onToggle,
  onEdit,
  onDelete,
}: {
  skill: Skill;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="rounded-[22px] p-4 flex flex-col gap-2 transition-all duration-150"
      style={{
        background: skill.is_enabled ? "var(--rc-chip-bg)" : "var(--rc-chip-inset-bg)",
        boxShadow: skill.is_enabled
          ? "5px 5px 14px #CBD0D7, -5px -5px 14px #FFFFFF"
          : "inset 2px 2px 6px #CBD0D7, inset -2px -2px 6px #FFFFFF",
        opacity: skill.is_enabled ? 1 : 0.65,
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-ink-primary leading-tight">{skill.title}</span>
        {skill.is_builtin ? (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium"
            style={{ background: "rgba(0,122,255,0.08)", color: "#0A84FF" }}
          >
            内置
          </span>
        ) : null}
        <code
          className="text-xs font-mono px-1.5 py-0.5 rounded-md"
          style={{ background: "rgba(120,120,128,0.08)", color: "#8E8E93" }}
        >
          /{skill.name}
        </code>
      </div>

      {skill.description ? (
        <p className="text-xs text-ink-tertiary leading-5 line-clamp-2">{skill.description}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 mt-0.5">
        <div className="flex flex-wrap gap-1">
          {skill.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onEdit}
            title="编辑"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-ink-tertiary hover:text-ink-secondary transition-colors"
            style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            <Pencil className="w-3 h-3" />
          </button>
          {!skill.is_builtin ? (
            <button
              type="button"
              onClick={onDelete}
              title="删除"
              className="w-6 h-6 rounded-lg flex items-center justify-center text-ink-tertiary hover:text-red-500 transition-colors"
              style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)" }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            title={skill.is_enabled ? "禁用" : "启用"}
            className="relative w-9 h-5 rounded-full transition-all duration-200 flex-shrink-0 overflow-hidden"
            style={{
              background: skill.is_enabled ? "linear-gradient(145deg,#34C759,#28A844)" : "#DDE1E6",
              boxShadow: skill.is_enabled
                ? "inset 1px 1px 3px rgba(0,0,0,0.1)"
                : "var(--rc-inset-shadow)",
            }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-200"
              style={{
                background: "#FFFFFF",
                boxShadow: "1px 1px 2px rgba(0,0,0,0.15)",
                transform: skill.is_enabled ? "translateX(16px)" : "translateX(0)",
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SkillsSection() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingSkill, setEditingSkill] = useState<Skill | "new" | null>(null);
  const [resetting, setResetting] = useState(false);
  const [enablingAll, setEnablingAll] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.skills.list().then((data) => {
      if (!cancelled) {
        setSkills(data);
        setLoading(false);
      }
    }).catch((nextError) => {
      if (!cancelled) {
        setError(formatErrorMessage(nextError));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return skills;
    return skills.filter(
      (skill) =>
        skill.title.toLowerCase().includes(query) ||
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.tags.some((tag) => tag.includes(query))
    );
  }, [search, skills]);

  const builtin = filtered.filter((skill) => skill.is_builtin);
  const custom = filtered.filter((skill) => !skill.is_builtin);

  const handleToggle = async (skill: Skill) => {
    try {
      const updated = await apiClient.skills.update(skill.id, { is_enabled: !skill.is_enabled });
      setSkills((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    }
  };

  const handleDelete = async (skill: Skill) => {
    if (!window.confirm(`确定要删除技能「${skill.title}」吗？`)) return;
    try {
      await apiClient.skills.delete(skill.id);
      setSkills((current) => current.filter((item) => item.id !== skill.id));
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    }
  };

  const handleSave = (updated: Skill) => {
    setSkills((current) => {
      const exists = current.find((item) => item.id === updated.id);
      return exists ? current.map((item) => (item.id === updated.id ? updated : item)) : [...current, updated];
    });
    setEditingSkill(null);
  };

  const handleEnableAll = async () => {
    setEnablingAll(true);
    try {
      const disabled = skills.filter((skill) => !skill.is_enabled);
      const updated = await Promise.all(
        disabled.map((skill) => apiClient.skills.update(skill.id, { is_enabled: true }))
      );
      setSkills((current) => current.map((skill) => updated.find((item) => item.id === skill.id) ?? skill));
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setEnablingAll(false);
    }
  };

  const handleResetBuiltins = async () => {
    if (!window.confirm("重置所有内置技能为默认内容？您对内置技能的编辑将被覆盖，自定义技能不受影响。")) return;
    setResetting(true);
    try {
      const updated = await apiClient.skills.resetBuiltins();
      setSkills((current) => {
        const customSkills = current.filter((skill) => !skill.is_builtin);
        return [...updated, ...customSkills];
      });
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      {editingSkill !== null ? (
        <SkillEditModal
          skill={editingSkill === "new" ? null : editingSkill}
          onSave={handleSave}
          onClose={() => setEditingSkill(null)}
        />
      ) : null}

      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SectionIcon icon={Zap} color="#FF9F0A" />
            <div>
              <h2 className="text-base font-semibold text-ink-primary">技能库</h2>
              <p className="text-xs text-ink-tertiary mt-0.5">
                内置 15 条研究技能，迁移自 Claude / Codex；也可新建自定义技能
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnableAll}
              disabled={enablingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-ink-secondary transition-all hover:text-ink-primary disabled:opacity-50"
              style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
            >
              {enablingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              全部打开
            </button>
            <button
              type="button"
              onClick={handleResetBuiltins}
              disabled={resetting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-ink-secondary transition-all hover:text-ink-primary disabled:opacity-50"
              style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
            >
              {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              重置内置
            </button>
            <button
              type="button"
              onClick={() => setEditingSkill("new")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(145deg,#1A8AFF,#0062CC)", boxShadow: "3px 3px 8px rgba(0,62,204,0.3)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              新建技能
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-ink-tertiary py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载技能库…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary pointer-events-none" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索技能名称、标签或描述…"
                className="w-full rounded-2xl pl-9 pr-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none"
                style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
              />
            </div>

            {custom.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink-tertiary uppercase tracking-wide ml-1">自定义</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {custom.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onToggle={() => handleToggle(skill)}
                      onEdit={() => setEditingSkill(skill)}
                      onDelete={() => handleDelete(skill)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {builtin.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink-tertiary uppercase tracking-wide ml-1">
                  内置技能（共 {builtin.length} 条）
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {builtin.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onToggle={() => handleToggle(skill)}
                      onEdit={() => setEditingSkill(skill)}
                      onDelete={() => handleDelete(skill)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-ink-tertiary">
                {search ? `没有匹配「${search}」的技能` : "还没有任何技能，点击右上角新建"}
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}

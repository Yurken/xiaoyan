import { Sparkles } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { AppSettings } from "@research-copilot/types";
import { AgentChip, SectionIcon } from "../settings/shared";
import { getCompanionMotionCoverage } from "./actionExpansion";
import { COMPANION_OPTIONS, getCompanionDefinition } from "./petRegistry";
import { emitCompanionPreferenceChange, normalizeCompanionId } from "./shared";

interface CompanionSettingsSectionProps {
  form: AppSettings;
  set: (key: keyof AppSettings) => (value: string) => void;
}

export default function CompanionSettingsSection({
  form,
  set,
}: CompanionSettingsSectionProps) {
  const activeId = normalizeCompanionId(form.xiaoyan_companion_id);
  const activeDefinition = getCompanionDefinition(activeId);
  const coverage = getCompanionMotionCoverage(activeDefinition);
  const actionPreview = coverage.highPriorityCandidates.slice(0, 6);

  const chooseCompanion = (id: string) => {
    const next = normalizeCompanionId(id);
    set("xiaoyan_companion_id")(next);
    emitCompanionPreferenceChange(next);
  };

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={Sparkles} color="#AF52DE" />
        <div>
          <h2 className="text-base font-semibold text-ink-primary">桌面伴侣形象</h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            选择右下角与侧栏里的陪伴形象；后续新形象会接入同一套动作注册表。
          </p>
        </div>
      </div>

      <div
        className="rounded-3xl px-4 py-4 space-y-3"
        style={{
          background: "var(--rc-chip-inset-bg)",
          boxShadow: "var(--rc-chip-inset-shadow)",
        }}
      >
        <div className="flex flex-wrap gap-2">
          {COMPANION_OPTIONS.map((option) => (
            <AgentChip
              key={option.id}
              label={option.label}
              active={activeId === option.id}
              onClick={() => chooseCompanion(option.id)}
            />
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {COMPANION_OPTIONS.map((option) => (
            <p key={option.id} className="text-xs leading-5 text-ink-secondary">
              {option.label}：{option.description}
            </p>
          ))}
        </div>
      </div>

      <div
        className="rounded-3xl px-4 py-4 space-y-3"
        style={{
          background: "var(--rc-chip-inset-bg)",
          boxShadow: "var(--rc-chip-inset-shadow)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-primary">动作覆盖</p>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              {activeDefinition.label}当前接入 {coverage.animationCount} 个实际动画，覆盖 {coverage.semanticActionCount} 个语义动作。
            </p>
          </div>
          <span
            className="rounded-2xl px-3 py-1.5 text-xs font-medium"
            style={{
              background: "var(--rc-chip-bg)",
              color: "var(--rc-text-soft)",
              boxShadow: "var(--rc-chip-shadow)",
            }}
          >
            {coverage.fallbackActionCount > 0 ? `${coverage.fallbackActionCount} 个动作待独立化` : "已完整独立"}
          </span>
        </div>

        {actionPreview.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actionPreview.map((item) => (
              <span
                key={item.actionKey}
                className="rounded-2xl px-3 py-1.5 text-xs font-medium text-ink-secondary"
                style={{
                  background: "var(--rc-chip-bg)",
                  boxShadow: "var(--rc-chip-shadow)",
                }}
                title={`${item.group}：${item.intent}`}
              >
                {item.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-5 text-ink-secondary">这个形象已经有完整的独立动作资源。</p>
        )}
      </div>
    </Card>
  );
}

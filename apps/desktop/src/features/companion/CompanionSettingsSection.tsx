import { Sparkles } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { AppSettings } from "@research-copilot/types";
import { SectionIcon } from "../settings/shared";
import { COMPANION_OPTIONS, getCompanionDefinition } from "./petRegistry";
import { emitCompanionPreferenceChange, normalizeCompanionId } from "./shared";
import { CompanionVisual } from "./CompanionRenderer";

interface CompanionSettingsSectionProps {
  form: AppSettings;
  set: (key: keyof AppSettings) => (value: string) => void;
}

export default function CompanionSettingsSection({
  form,
  set,
}: CompanionSettingsSectionProps) {
  const activeId = normalizeCompanionId(form.xiaoyan_companion_id);

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
            选择桌面陪伴形象。
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        {COMPANION_OPTIONS.map((option) => {
          const def = getCompanionDefinition(option.id);
          const isSelected = activeId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => chooseCompanion(option.id)}
              className="flex-1 rounded-2xl p-3 flex flex-col items-center gap-2 transition-all duration-150 cursor-pointer"
              style={{
                background: isSelected
                  ? "linear-gradient(145deg, rgba(26,138,255,0.12), rgba(26,138,255,0.06))"
                  : "var(--rc-chip-inset-bg)",
                boxShadow: isSelected
                  ? "0 0 0 2px rgba(26,138,255,0.4), var(--rc-chip-inset-shadow)"
                  : "var(--rc-chip-inset-shadow)",
              }}
            >
              <div className="flex items-center justify-center h-16">
                <CompanionVisual
                  definition={def}
                  actionKey="idle"
                  inline
                  opacity={1}
                />
              </div>
              <span
                className={`text-xs font-medium ${
                  isSelected ? "text-[#1A8AFF]" : "text-ink-secondary"
                }`}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

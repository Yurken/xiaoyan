import { Check, Sparkles, Wand2 } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { AppSettings } from "@research-copilot/types";
import AgentCollaborationSection from "./AgentCollaborationSection";
import RoleModelCards from "./RoleModelCards";
import { RecommendationList, SectionIcon } from "./shared";
import { MODEL_PRESETS, applyModelPreset, detectModelPreset } from "./modelPresets";
import { countSpecializedRoles } from "./roleRegistry";

interface RolesSectionProps {
  form: AppSettings;
  enabledAgents: string[];
  set: (key: keyof AppSettings) => (value: string) => void;
  setMany: (keys: (keyof AppSettings)[]) => (value: string) => void;
  getSharedValue: (keys: (keyof AppSettings)[]) => string;
  hasMixedValue: (keys: (keyof AppSettings)[]) => boolean;
  toggleAgent: (agentName: string) => void;
  /** 批量设置多个 key（用于预设应用） */
  setManyFlat: (updates: Partial<Record<keyof AppSettings, string>>) => void;
}

/**
 * 任务分工设置。
 *
 * 默认语义是「统一」：除视觉与向量化两个硬能力边界外，所有任务都沿用上方主模型。
 * 按任务指定模型属于成本 / 延迟微调，收在高级折叠里；本组件只负责组合，
 * 卡片与步骤协作各自独立成组件。
 */
export default function RolesSection({
  form,
  enabledAgents,
  set,
  setMany,
  getSharedValue,
  hasMixedValue,
  toggleAgent,
  setManyFlat,
}: RolesSectionProps) {
  const activePreset = detectModelPreset(form);
  const specializedCount = countSpecializedRoles(form);

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={Sparkles} color="#0A84FF" />
        <div>
          <h2 className="text-base font-semibold text-ink-primary">任务分工</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">
            默认所有任务都用上方的主模型。留空即沿用主模型，只有确实需要区别对待时才单独指定。
          </p>
        </div>
      </div>

      {/* 一键对齐 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-[#AF52DE]" />
          <span className="text-xs font-semibold text-ink-secondary">快速对齐</span>
          {specializedCount > 0 && (
            <span className="text-[10px] text-ink-tertiary">
              （{specializedCount} 个任务已单独指定模型）
            </span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {MODEL_PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setManyFlat(applyModelPreset(preset.id))}
                className="rounded-2xl px-3 py-2 text-left transition-all duration-150 min-w-[140px]"
                style={
                  isActive
                    ? {
                        background: "var(--rc-button-primary-bg)",
                        color: "#FFFFFF",
                        boxShadow: "var(--rc-button-primary-shadow)",
                      }
                    : {
                        background: "var(--rc-chip-bg)",
                        color: "var(--rc-text-soft)",
                        boxShadow: "var(--rc-chip-shadow)",
                      }
                }
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">{preset.label}</span>
                  {isActive && <Check className="w-3 h-3 ml-auto" />}
                </div>
                <p
                  className="mt-1 text-[10px] leading-3.5"
                  style={{ opacity: isActive ? 0.85 : 0.65 }}
                >
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <RecommendationList
        items={[
          "只有视觉（多模态）和溯源（向量化）是硬能力边界——主模型不具备这两项能力时才需要单独指定，其余文本任务留空即沿用主模型。",
          "想把成本或延迟按任务分摊时，再展开「高级：按任务指定模型」逐项覆盖。",
        ]}
      />

      <RoleModelCards
        form={form}
        getSharedValue={getSharedValue}
        hasMixedValue={hasMixedValue}
        setMany={setMany}
      />

      <AgentCollaborationSection
        form={form}
        enabledAgents={enabledAgents}
        set={set}
        toggleAgent={toggleAgent}
      />
    </Card>
  );
}
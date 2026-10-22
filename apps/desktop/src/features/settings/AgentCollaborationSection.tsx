import { useState } from "react";
import { Bot, ChevronRight, Route } from "lucide-react";
import type { AppSettings } from "@research-copilot/types";
import { AgentChip, SectionIcon, SettingInput, ToggleRow } from "./shared";

/** 可参与小妍步骤协作的能力步骤，及其对应的角色卡片名称。 */
export const AGENT_OPTIONS = [
  ["planner", "谋策模型"],
  ["retrieval", "溯源模型"],
  ["literature_scout", "探知模型"],
  ["paper_analyst", "洞见模型"],
  ["survey", "翰章模型"],
  ["reproduction", "构域模型"],
  ["synthesis", "整合模型"],
] as const;

/** 各能力步骤的职责说明，用于高级设置里的卡片。 */
export const AGENT_GUIDES = [
  { key: "planner", label: "谋策模型", description: "拆解研究主题、学习路径和阶段目标。" },
  { key: "retrieval", label: "溯源模型", description: "先从知识库和论文库找证据，适合需要依据的问题。" },
  { key: "literature_scout", label: "探知模型", description: "先找代表性论文、研究脉络和阅读入口。" },
  { key: "paper_analyst", label: "洞见模型", description: "聚焦单篇论文的方法、实验和局限。" },
  { key: "survey", label: "翰章模型", description: "把线索整理成结构化综述和趋势判断。" },
  { key: "reproduction", label: "构域模型", description: "聚焦实现细节、实验配置和复现风险。" },
  { key: "synthesis", label: "整合模型", description: "把各小妍步骤的结果整合成最终回答。" },
];

interface AgentCollaborationSectionProps {
  form: AppSettings;
  enabledAgents: string[];
  set: (key: keyof AppSettings) => (value: string) => void;
  toggleAgent: (agentName: string) => void;
}

/**
 * 小妍步骤协作：总开关 + 折叠的高级设置（参与步骤与执行上限）。
 * 与角色模型配置无关，单独成组件，避免继续堆进设置页主组件。
 */
export default function AgentCollaborationSection({
  form,
  enabledAgents,
  set,
  toggleAgent,
}: AgentCollaborationSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="pt-4 border-t border-nm-dark/10 space-y-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={Bot} color="#34C759" />
        <div>
          <h2 className="text-base font-semibold text-ink-primary">小妍步骤协作</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">
            开启后，复杂问题会自动拆分成多步协作完成。
          </p>
        </div>
      </div>

      <ToggleRow
        title="启用小妍步骤协作"
        description="关闭后仅使用默认模型直接回复，不拆分复杂任务。"
        checked={form.multi_agent_enabled === "true"}
        onToggle={() =>
          set("multi_agent_enabled")(form.multi_agent_enabled === "true" ? "false" : "true")
        }
      />

      {/* 高级设置：参与步骤与执行上限，默认折叠，普通用户无需关心 */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-tertiary hover:text-ink-secondary transition-colors"
        >
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
          />
          高级设置（参与步骤与执行上限）
        </button>

        {showAdvanced && (
          <div className="space-y-4 pt-1">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-[#1A8AFF]" />
                <p className="text-sm font-semibold text-ink-primary">小妍步骤开关</p>
              </div>
              <p className="text-xs text-ink-tertiary">
                默认全部开启。如需限制小妍可调度的能力步骤，可在此关闭，关闭后不会被纳入考量。
              </p>

              <div className="flex gap-2 flex-wrap pb-2">
                {AGENT_OPTIONS.map(([value, label]) => (
                  <AgentChip
                    key={value}
                    label={label}
                    active={enabledAgents.includes(value)}
                    onClick={() => toggleAgent(value)}
                  />
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {AGENT_GUIDES.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3 shadow-sm"
                  >
                    <p className="text-xs font-semibold text-ink-primary">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-tertiary">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <SettingInput
                label="单次最多调用的小妍步骤上限"
                value={form.multi_agent_max_steps}
                onChange={set("multi_agent_max_steps")}
                placeholder="6"
                hint="超过该步数将强制中断小妍步骤流程。"
              />
              <SettingInput
                label="外部检索上限"
                value={form.multi_agent_search_limit}
                onChange={set("multi_agent_search_limit")}
                placeholder="8"
                hint="搜索接口每次返回的文献条数上限。"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
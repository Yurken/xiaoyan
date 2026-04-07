import { Bot, Route, Sparkles } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { AppSettings, MultiAgentRoutingMode } from "@research-copilot/types";
import {
  AGENT_GUIDES,
  AGENT_OPTIONS,
  AgentChip,
  CHARACTERISTIC_MODEL_CARDS,
  GroupedModelCard,
  ProviderTab,
  RecommendationList,
  ROUTING_MODE_COPY,
  SectionIcon,
  SettingInput,
  ToggleRow,
} from "./shared";

interface RolesSectionProps {
  form: AppSettings;
  routingMode: MultiAgentRoutingMode;
  enabledAgents: string[];
  set: (key: keyof AppSettings) => (value: string) => void;
  setMany: (keys: (keyof AppSettings)[]) => (value: string) => void;
  getSharedValue: (keys: (keyof AppSettings)[]) => string;
  hasMixedValue: (keys: (keyof AppSettings)[]) => boolean;
  toggleAgent: (agentName: string) => void;
}

export default function RolesSection({
  form,
  routingMode,
  enabledAgents,
  set,
  setMany,
  getSharedValue,
  hasMixedValue,
  toggleAgent,
}: RolesSectionProps) {
  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={Sparkles} color="#0A84FF" />
        <div>
          <h2 className="text-base font-semibold text-ink-primary">模型分工</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">
            将具备不同特征的模型分配给小妍的不同能力模块。完全留空则全部由“默认对话模型”承担。
          </p>
        </div>
      </div>

      <RecommendationList
        items={[
          "建议分工：溯源负责向量化与检索，流光负责极速轻量问答，元枢承担均衡主力，探知处理联网检索，谋策负责深度推理，洞见专注长文精读，翰章用于结构化写作，构域用于代码工程，视界主攻多模态解析。按场景分配，效果与成本更优。",
          "即使全部留空也可正常使用：所有角色会自动回退到“连接与检索”中的默认对话模型。",
          "如需让探知联网，可在其卡片中单独配置支持搜索的接口；其余角色仍使用主服务商。",
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {CHARACTERISTIC_MODEL_CARDS.map((item) => (
          <GroupedModelCard
            key={item.title}
            icon={item.icon}
            iconColor={item.iconColor}
            title={item.title}
            description={item.description}
            recommendation={item.recommendation}
            affectedScopes={item.affectedScopes}
            modelValue={getSharedValue(item.modelKeys)}
            temperatureValue={getSharedValue(item.temperatureKeys)}
            baseUrlValue={getSharedValue(item.baseUrlKeys)}
            apiKeyValue={getSharedValue(item.apiKeyKeys)}
            mixedBaseUrl={hasMixedValue(item.baseUrlKeys)}
            mixedApiKey={hasMixedValue(item.apiKeyKeys)}
            onModelChange={setMany(item.modelKeys)}
            onTemperatureChange={setMany(item.temperatureKeys)}
            onBaseUrlChange={setMany(item.baseUrlKeys)}
            onApiKeyChange={setMany(item.apiKeyKeys)}
            modelPlaceholder={item.modelPlaceholder}
            temperaturePlaceholder={item.temperaturePlaceholder}
            secondaryFieldLabel={item.secondaryFieldLabel}
            secondaryFieldHint={item.secondaryFieldHint}
          />
        ))}
      </div>

      <div className="pt-4 border-t border-nm-dark/10 space-y-4">
        <div className="flex items-center gap-3">
          <SectionIcon icon={Bot} color="#34C759" />
          <div>
            <h2 className="text-base font-semibold text-ink-primary">多能力域模型编排</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">
              控制小妍的多能力域模型协作心智、选路策略与可用角色。
            </p>
          </div>
        </div>

        <ToggleRow
          title="启用多能力域模型编排"
          description="关闭后将只使用小妍轻量对话模型直接回复，不再拆分复杂任务，也不展示中间能力域模型推理过程。"
          checked={form.multi_agent_enabled === "true"}
          onToggle={() =>
            set("multi_agent_enabled")(form.multi_agent_enabled === "true" ? "false" : "true")
          }
        />

        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink-tertiary ml-1">小妍路由判断模式</label>
          <div className="flex gap-2 flex-wrap">
            {(["rule", "llm", "hybrid"] as const).map((value) => (
              <ProviderTab
                key={value}
                label={ROUTING_MODE_COPY[value].label}
                active={routingMode === value}
                onClick={() => set("multi_agent_routing_mode")(value)}
              />
            ))}
          </div>
          <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
            <p className="text-sm font-semibold text-ink-primary">{ROUTING_MODE_COPY[routingMode].label}</p>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              {ROUTING_MODE_COPY[routingMode].description}
            </p>
            <p className="mt-2 text-xs leading-5 text-ink-tertiary">
              {ROUTING_MODE_COPY[routingMode].note}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-[#1A8AFF]" />
            <p className="text-sm font-semibold text-ink-primary">能力域模型开关</p>
          </div>
          <p className="text-xs text-ink-tertiary">选择小妍在多能力域模型协作时允许唤醒的能力域模型。关闭某个能力域模型后，调度模型将不会将其纳入考量。</p>

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
              <div key={item.key} className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold text-ink-primary">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-ink-tertiary">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <SettingInput
            label="单次最多调用的能力域模型步数上限"
            value={form.multi_agent_max_steps}
            onChange={set("multi_agent_max_steps")}
            placeholder="6"
            hint="超过该步数将强行中断能力域模型思考流程，防止发散。"
          />
          <SettingInput
            label="文献检索模型抓取条数上限"
            value={form.multi_agent_search_limit}
            onChange={set("multi_agent_search_limit")}
            placeholder="8"
            hint="限制搜索接口每次带回来的文献条数，过大可能会导致被拦截或上下文超限。"
          />
        </div>
      </div>
    </Card>
  );
}

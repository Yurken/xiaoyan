import { Database } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { Dispatch, SetStateAction } from "react";
import type { AppSettings, LlmProvider, MultiAgentRoutingMode } from "@research-copilot/types";
import type { ProviderPresetId } from "./providerPresets";
import ConnectionSection from "./ConnectionSection";
import RolesSection from "./RolesSection";
import { SectionIcon, ToggleRow } from "./shared";
import type { ConfigHistoryControls } from "./ConfigHistorySwitcher";
import CompanionSettingsSection from "../companion/CompanionSettingsSection";

interface AssistantSettingsSectionProps {
  contentUnavailable: boolean;
  provider: LlmProvider;
  activePreset: ProviderPresetId;
  form: AppSettings;
  ollamaModels: string[];
  loadingOllamaModels: boolean;
  routingMode: MultiAgentRoutingMode;
  enabledAgents: string[];
  configHistory: ConfigHistoryControls;
  onManageConfigHistory: () => void;
  setForm: Dispatch<SetStateAction<AppSettings>>;
  set: (key: keyof AppSettings) => (value: string) => void;
  setMany: (keys: (keyof AppSettings)[]) => (value: string) => void;
  setManyFlat: (updates: Partial<Record<keyof AppSettings, string>>) => void;
  getSharedValue: (keys: (keyof AppSettings)[]) => string;
  hasMixedValue: (keys: (keyof AppSettings)[]) => boolean;
  applyPreset: (presetId: ProviderPresetId) => void;
  loadOllamaModels: () => Promise<void>;
  toggleAgent: (agentName: string) => void;
}

function LongTermMemorySection({
  form,
  set,
}: Pick<AssistantSettingsSectionProps, "form" | "set">) {
  const enabled = form.xiaoyan_long_term_memory_enabled !== "false";

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={Database} color="#30B0C7" />
        <div>
          <h2 className="text-base font-semibold text-ink-primary">长期记忆</h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            控制小妍是否写入长期记忆并在新对话中读取。关闭后不影响已有记忆。
          </p>
        </div>
      </div>

      <ToggleRow
        title="启用小妍长期记忆"
        description="开启后小妍会自动沉淀对话记忆并在新对话中引用。"
        checked={enabled}
        onToggle={() => set("xiaoyan_long_term_memory_enabled")(enabled ? "false" : "true")}
      />
    </Card>
  );
}

export default function AssistantSettingsSection(props: AssistantSettingsSectionProps) {
  return (
    <div className="space-y-4">
      <ConnectionSection
        contentUnavailable={props.contentUnavailable}
        provider={props.provider}
        activePreset={props.activePreset}
        form={props.form}
        ollamaModels={props.ollamaModels}
        loadingOllamaModels={props.loadingOllamaModels}
        configHistory={props.configHistory}
        onManageConfigHistory={props.onManageConfigHistory}
        setForm={props.setForm}
        set={props.set}
        applyPreset={props.applyPreset}
        loadOllamaModels={props.loadOllamaModels}
      />
      <LongTermMemorySection form={props.form} set={props.set} />
      <CompanionSettingsSection form={props.form} set={props.set} />
      {!props.contentUnavailable ? (
        <RolesSection
          form={props.form}
          routingMode={props.routingMode}
          enabledAgents={props.enabledAgents}
          set={props.set}
          setMany={props.setMany}
          setManyFlat={props.setManyFlat}
          getSharedValue={props.getSharedValue}
          hasMixedValue={props.hasMixedValue}
          toggleAgent={props.toggleAgent}
        />
      ) : null}
    </div>
  );
}

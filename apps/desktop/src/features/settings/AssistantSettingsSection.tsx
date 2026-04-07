import type { Dispatch, SetStateAction } from "react";
import type { AppSettings, LlmProvider, MultiAgentRoutingMode } from "@research-copilot/types";
import type { ProviderPresetId } from "./providerPresets";
import ConnectionSection from "./ConnectionSection";
import RolesSection from "./RolesSection";

interface AssistantSettingsSectionProps {
  contentUnavailable: boolean;
  provider: LlmProvider;
  activePreset: ProviderPresetId;
  form: AppSettings;
  ollamaModels: string[];
  loadingOllamaModels: boolean;
  routingMode: MultiAgentRoutingMode;
  enabledAgents: string[];
  setForm: Dispatch<SetStateAction<AppSettings>>;
  set: (key: keyof AppSettings) => (value: string) => void;
  setMany: (keys: (keyof AppSettings)[]) => (value: string) => void;
  getSharedValue: (keys: (keyof AppSettings)[]) => string;
  hasMixedValue: (keys: (keyof AppSettings)[]) => boolean;
  applyPreset: (presetId: ProviderPresetId) => void;
  loadOllamaModels: () => Promise<void>;
  toggleAgent: (agentName: string) => void;
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
        setForm={props.setForm}
        set={props.set}
        applyPreset={props.applyPreset}
        loadOllamaModels={props.loadOllamaModels}
      />
      {!props.contentUnavailable ? (
        <RolesSection
          form={props.form}
          routingMode={props.routingMode}
          enabledAgents={props.enabledAgents}
          set={props.set}
          setMany={props.setMany}
          getSharedValue={props.getSharedValue}
          hasMixedValue={props.hasMixedValue}
          toggleAgent={props.toggleAgent}
        />
      ) : null}
    </div>
  );
}

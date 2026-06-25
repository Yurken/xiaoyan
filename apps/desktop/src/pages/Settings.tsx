import { useEffect, useRef, useState } from "react";
import { AlertCircle, FileSearch, Layers3, Loader2 } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { apiClient } from "../lib/client";
import AboutSection from "../features/settings/AboutSection";
import AssistantSettingsSection from "../features/settings/AssistantSettingsSection";
import { PAPER_TAG_OPTIONS, parsePaperTagVisibility, togglePaperTagVisibility } from "../lib/paperTags";
import CryptoConfigModal from "../features/settings/CryptoConfigModal";
import { emitAppLockStatusChange } from "../features/appLock/shared";
import MemorySection from "../features/settings/MemorySection";
import SettingsHistorySection from "../features/settings/SettingsHistorySection";
import ConfigHistoryManageModal from "../features/settings/ConfigHistoryManageModal";
import SkillsSection from "../features/settings/SkillsSection";
import SettingsChangelogCard, { formatUpdateDate, getChangelogReleaseDate } from "../features/settings/SettingsChangelogCard";
import FeedbackSection from "../features/settings/FeedbackSection";
import TaskSetupSection from "../features/settings/TaskSetupSection";
import LayoutSettingsSection from "../features/settings/LayoutSettingsSection";
import { DEFAULT_SETTINGS, SETTINGS_SECTIONS, type SettingsSectionKey } from "../features/settings/pageConfig";
import { AgentChip, SectionIcon } from "../features/settings/shared";
import { applyProviderPreset, detectPreset, PROVIDER_PRESETS, type ProviderPresetId } from "../features/settings/providerPresets";
import { useDataBackup } from "../features/settings/useDataBackup";
import { useSettingsController } from "../features/settings/useSettingsController";
import { useSettingsCrypto } from "../features/settings/useSettingsCrypto";
import { useSettingsHistory } from "../features/settings/useSettingsHistory";
import { useSettingsMemories } from "../features/settings/useSettingsMemories";
import { useLayoutSettingsController } from "../features/settings/useLayoutSettingsController";
import { usePersistentStringState } from "../hooks/usePersistentStringState";
import type { LlmProvider } from "@research-copilot/types";

const SETTINGS_SECTION_KEYS = SETTINGS_SECTIONS.map((section) => section.key);

function SettingsTabBar({
  sections,
  activeSection,
  onSelect,
}: {
  sections: typeof SETTINGS_SECTIONS;
  activeSection: SettingsSectionKey;
  onSelect: (key: SettingsSectionKey) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [ready, setReady] = useState(false);
  const [glow, setGlow] = useState({ left: 0, width: 0, opacity: 0 });

  useEffect(() => {
    const el = buttonRefs.current.get(activeSection);
    const container = containerRef.current;
    if (!el || !container) return;
    const cr = container.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setGlow({ left: er.left - cr.left + 4, width: er.width - 8, opacity: 1 });
    if (!ready) {
      requestAnimationFrame(() => setReady(true));
    }
  }, [activeSection, sections, ready]);

  return (
    <div
      ref={containerRef}
      className="relative grid min-w-0 gap-1 rounded-[28px] p-1"
      style={{
        gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`,
        background: "var(--rc-chip-inset-bg)",
        border: "1px solid var(--rc-card-inset-outline)",
        boxShadow: "var(--rc-chip-inset-shadow)",
      }}
    >
      {/* Sliding glow indicator */}
      <div
        className={`absolute top-1 rounded-[22px] pointer-events-none ${ready ? "transition-all duration-500" : ""}`}
        style={{
          height: "calc(100% - 8px)",
          left: glow.left,
          width: glow.width,
          opacity: glow.opacity,
          background: `radial-gradient(ellipse at center, color-mix(in srgb, var(--rc-accent) 18%, transparent), transparent 70%)`,
          boxShadow: `0 0 24px color-mix(in srgb, var(--rc-accent) 14%, transparent)`,
        }}
      />
      {sections.map((item) => (
        <button
          key={item.key}
          ref={(el) => {
            if (el) buttonRefs.current.set(item.key, el);
          }}
          type="button"
          onClick={() => onSelect(item.key)}
          aria-pressed={activeSection === item.key}
          title={item.description}
          className="relative z-10 min-w-0 rounded-[22px] px-2.5 py-2 text-left transition-all duration-300 active:scale-[0.98]"
          style={
            activeSection === item.key
              ? {
                  background: "color-mix(in srgb, var(--rc-accent) 10%, var(--rc-elevated))",
                  border: "1px solid color-mix(in srgb, var(--rc-accent) 22%, var(--rc-border))",
                  boxShadow: "var(--rc-card-flat-shadow)",
                }
              : { border: "1px solid transparent" }
          }
        >
          <div className="flex min-w-0 items-center justify-center gap-2">
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-300"
              style={{
                background: activeSection === item.key
                  ? `color-mix(in srgb, ${item.color} 16%, transparent)`
                  : "transparent",
                color: activeSection === item.key ? item.color : "var(--rc-text-muted)",
              }}
            >
              <item.icon className="h-4 w-4" />
            </span>
            <span
              className="min-w-0 truncate text-[13px] font-semibold leading-none transition-colors duration-200"
              style={{
                color: activeSection === item.key ? "var(--rc-text)" : "var(--rc-text-muted)",
              }}
            >
              {item.label}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const {
    form,
    setForm,
    replaceForm,
    set,
    setMany,
    setManyFlat,
    getSharedValue,
    hasMixedValue,
    loading,
    loadError,
    saveState,
    testState,
    testMsg,
    updateState,
    updateInfo,
    updateMsg,
    downloadProgress,
    appVersion,
    markSaved,
    handleTestConnection,
    handleCheckUpdate,
    handleInstallUpdate,
  } = useSettingsController(DEFAULT_SETTINGS);
  const [activeSection, setActiveSection] = usePersistentStringState<SettingsSectionKey>(
    "rc:settings:active-section",
    "guided",
    SETTINGS_SECTION_KEYS,
  );
  // 「切换与管理」弹窗（由小妍配置弹层的「更多管理」触发）。
  const [configManageOpen, setConfigManageOpen] = useState(false);
  const {
    currentTheme,
    pendingLayout,
    changeLayout,
    changeTheme,
  } = useLayoutSettingsController();
  const {
    memories,
    observations,
    loading: memoriesLoading,
    loadError: memoriesLoadError,
    clearingAuto,
    privacy: memoryPrivacy,
    enter: enterMemories,
    deleteMemory,
    clearAuto: clearAutoMemories,
  } = useSettingsMemories();
  const {
    modal: cryptoModal,
    password: cryptoPassword,
    confirm: cryptoConfirm,
    busy: cryptoBusy,
    error: cryptoError,
    setPassword: setCryptoPassword,
    setConfirm: setCryptoConfirm,
    closeModal: closeCryptoModal,
    openExportModal: openConfigExportModal,
    openImportPicker: openConfigImportPicker,
    handleConfirm: handleCryptoConfirm,
  } = useSettingsCrypto({
    onImported: (next) => replaceForm(next, true),
    onSaved: () => markSaved(),
  });
  const settingsHistory = useSettingsHistory({
    form,
    onApplied: (next) => replaceForm(next, true),
    onMarkedSaved: () => markSaved(),
  });
  const {
    modal: backupModal,
    password: backupPassword,
    confirm: backupConfirm,
    busy: backupBusy,
    error: backupError,
    setPassword: setBackupPassword,
    setConfirm: setBackupConfirm,
    closeModal: closeBackupModal,
    openExportModal: openBackupExportModal,
    openImportPicker: openBackupImportPicker,
    handleConfirm: handleBackupConfirm,
  } = useDataBackup({
    onImported: async () => {
      const fresh = await apiClient.settings.get();
      replaceForm(fresh, true);
      markSaved();
      await settingsHistory.reload();
      emitAppLockStatusChange({
        enabled: fresh.app_lock_enabled === "true",
        timeoutMinutes: Number(fresh.app_lock_timeout_minutes) || 0,
      });
    },
  });

  // Ollama models
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingOllamaModels, setLoadingOllamaModels] = useState(false);

  const provider = form.llm_provider as LlmProvider;
  const activePreset = detectPreset(form);
  const activePresetMeta = PROVIDER_PRESETS.find((preset) => preset.id === activePreset);

  const applyPreset = (presetId: ProviderPresetId) => {
    setForm((current) => applyProviderPreset(current, presetId));
  };

  const enabledAgents = form.multi_agent_enabled_agents
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const visiblePaperTags = parsePaperTagVisibility(form.paper_visible_venue_tags);

  const toggleAgent = (agentName: string) => {
    const next = enabledAgents.includes(agentName)
      ? enabledAgents.filter((item) => item !== agentName)
      : [...enabledAgents, agentName];
    set("multi_agent_enabled_agents")(next.join(","));
  };

  const togglePaperTag = (key: (typeof PAPER_TAG_OPTIONS)[number]["key"]) => {
    set("paper_visible_venue_tags")(togglePaperTagVisibility(form.paper_visible_venue_tags, key));
  };

  const loadOllamaModels = async () => {
    setLoadingOllamaModels(true);
    try {
      const models = await apiClient.settings.listOllamaModels(form.openai_compatible_base_url || undefined);
      setOllamaModels(models);
    } catch {
      setOllamaModels([]);
    } finally {
      setLoadingOllamaModels(false);
    }
  };

  const contentUnavailable = loading || Boolean(loadError);
  const displayVersion = updateInfo?.available ? updateInfo.version : appVersion || updateInfo?.current_version;
  const changelogPublishedAt = getChangelogReleaseDate(displayVersion);
  const updatePublishedAt = formatUpdateDate(updateInfo?.pub_date || changelogPublishedAt);
  const connectionReady = provider === "openai"
    ? Boolean(form.openai_api_key.trim() && form.openai_chat_model.trim())
    : provider === "anthropic"
      ? Boolean(form.anthropic_api_key.trim() && form.anthropic_chat_model.trim())
      : Boolean(
          form.openai_compatible_chat_model.trim()
            && (activePreset === "ollama" || form.openai_compatible_base_url.trim() || form.openai_compatible_api_key.trim()),
        );
  const rolesReady = Boolean(
    form.paper_analysis_model.trim()
      || form.survey_writer_model.trim()
      || form.paper_reproduction_model.trim()
      || form.vision_model.trim()
      || form.multi_agent_supervisor_model.trim(),
  );
  const multiAgentReady = form.multi_agent_enabled === "true" && enabledAgents.length > 0;
  const paperImportReady = [
    form.paper_import_recognize_title,
    form.paper_import_recognize_authors,
    form.paper_import_recognize_year,
    form.paper_import_recognize_venue,
    form.paper_import_recognize_keywords,
  ].some((value) => value !== "false");

  return (
    <>
    <div className="h-full flex flex-col" style={{ background: "var(--rc-surface)" }}>
      <div
        className="flex-shrink-0 px-6 pt-5 pb-4 border-b rc-settings-header"
        style={{ borderColor: "var(--rc-border)" }}
      >
        {/* 「设置」标题已移除，胶囊导航上移到此处；测试连接/保存在小妍卡片头部。 */}
        <SettingsTabBar
          sections={SETTINGS_SECTIONS}
          activeSection={activeSection}
          onSelect={setActiveSection}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* 当前分区摘要卡与上方导航重复，先注释掉。 */}
        {/*
        <Card padding="md" className="space-y-3">
          <div className="flex items-center gap-3">
            <SectionIcon icon={activeSectionMeta.icon} color={activeSectionMeta.color} />
            <div>
              <h2 className="text-base font-semibold text-ink-primary">{activeSectionMeta.label}</h2>
              <p className="text-xs text-ink-tertiary mt-0.5">{activeSectionMeta.description}</p>
            </div>
          </div>
        </Card>
        */}

        {loading ? (
          <Card padding="md" className="flex items-center gap-2 text-sm text-ink-tertiary">
            <Loader2 className="w-4 h-4 animate-spin" />
            从后端加载配置…
          </Card>
        ) : null}

        {loadError ? (
          <Card padding="md" className="flex items-center gap-2 text-sm text-apple-red">
            <AlertCircle className="w-4 h-4" />
            {loadError}
          </Card>
        ) : null}

        {activeSection === "guided" ? (
          <TaskSetupSection
            currentProviderLabel={activePresetMeta?.label ?? "自定义兼容服务"}
            connectionReady={connectionReady}
            rolesReady={rolesReady}
            multiAgentReady={multiAgentReady}
            paperImportReady={paperImportReady}
            appLockEnabled={form.app_lock_enabled === "true"}
            appLockTimeoutMinutes={Number(form.app_lock_timeout_minutes) || 0}
            onOpenAssistant={() => setActiveSection("assistant")}
            onOpenPaperLibrary={() => setActiveSection("paper_tags")}
            onOpenDataConfig={() => setActiveSection("history")}
            onSetAppLockPassword={async (password, hint, email) => {
              await apiClient.settings.appLock.setPassword(password, hint, email);
              set("app_lock_enabled")("true");
              emitAppLockStatusChange({
                enabled: true,
                timeoutMinutes: Number(form.app_lock_timeout_minutes) || 0,
              });
            }}
            onSetAppLockSecurity={async (question, answer) => {
              await apiClient.settings.appLock.setSecurity(question, answer);
            }}
            onClearAppLock={async () => {
              await apiClient.settings.appLock.clearPassword();
              set("app_lock_enabled")("false");
              emitAppLockStatusChange({ enabled: false, timeoutMinutes: 0 });
            }}
            onSetAppLockTimeout={async (minutes) => {
              await apiClient.settings.appLock.setTimeout(minutes);
              set("app_lock_timeout_minutes")(minutes);
              emitAppLockStatusChange({
                enabled: form.app_lock_enabled === "true",
                timeoutMinutes: Number(minutes) || 0,
              });
            }}
          />
        ) : null}

        {activeSection === "assistant" ? (
          <AssistantSettingsSection
            contentUnavailable={contentUnavailable}
            provider={provider}
            activePreset={activePreset}
            form={form}
            ollamaModels={ollamaModels}
            loadingOllamaModels={loadingOllamaModels}
            enabledAgents={enabledAgents}
            configHistory={{
              entries: settingsHistory.entries,
              loading: settingsHistory.loading,
              selectedId: settingsHistory.selectedId,
              saving: settingsHistory.saving,
              applyingId: settingsHistory.applyingId,
              actionError: settingsHistory.actionError,
              actionMessage: settingsHistory.actionMessage,
              busy: settingsHistory.busy,
              draftName: settingsHistory.draftName,
              setDraftName: settingsHistory.setDraftName,
              onSaveCurrent: settingsHistory.saveCurrent,
              onApplyHistory: settingsHistory.applyHistory,
            }}
            onManageConfigHistory={() => setConfigManageOpen(true)}
            connectionActions={{
              testState,
              testMsg,
              saveState,
              busy: loading,
              onTest: handleTestConnection,
            }}
            setForm={setForm}
            set={set}
            setMany={setMany}
            setManyFlat={setManyFlat}
            getSharedValue={getSharedValue}
            hasMixedValue={hasMixedValue}
            applyPreset={applyPreset}
            loadOllamaModels={loadOllamaModels}
            toggleAgent={toggleAgent}
          />
        ) : null}

        {activeSection === "paper_tags" && !contentUnavailable ? (
          <div className="space-y-4">
            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-3">
                <SectionIcon icon={FileSearch} color="#0A84FF" />
                <div>
                  <h2 className="text-base font-semibold text-ink-primary">导入论文识别内容</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">
                    导入 PDF 时自动识别并填写论文元数据，关闭后对应字段留空。
                  </p>
                </div>
              </div>

              <div className="rounded-3xl px-4 py-4 space-y-3" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "paper_import_recognize_title", label: "名称" },
                    { key: "paper_import_recognize_authors", label: "作者" },
                    { key: "paper_import_recognize_year", label: "年份" },
                    { key: "paper_import_recognize_venue", label: "期刊 / 会议" },
                    { key: "paper_import_recognize_keywords", label: "关键词" },
                  ] as { key: keyof typeof form; label: string }[]).map((item) => (
                    <AgentChip
                      key={item.key}
                      label={item.label}
                      active={form[item.key] !== "false"}
                      onClick={() => set(item.key)(form[item.key] !== "false" ? "false" : "true")}
                    />
                  ))}
                </div>
                <div className="grid gap-1.5 md:grid-cols-2">
                  {([
                    { label: "名称", description: "从正文提取正式标题" },
                    { label: "作者", description: "提取作者姓名，英文逗号分隔" },
                    { label: "年份", description: "提取发表年份" },
                    { label: "期刊 / 会议", description: "提取发表场所" },
                    { label: "关键词", description: "提取 3-8 个核心学术关键词" },
                  ]).map((item) => (
                    <p key={item.label} className="text-xs leading-5 text-ink-secondary">
                      {item.label}：{item.description}
                    </p>
                  ))}
                </div>
              </div>
            </Card>
            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-3">
                <SectionIcon icon={Layers3} color="#FF9F0A" />
                <div>
                  <h2 className="text-base font-semibold text-ink-primary">论文标签显示</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">
                    控制论文卡片上展示哪些来源标签，关闭仅影响显示。
                  </p>
                </div>
              </div>

              <div className="rounded-3xl px-4 py-4 space-y-3" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
                <div className="flex flex-wrap gap-2">
                  {PAPER_TAG_OPTIONS.map((item) => (
                    <AgentChip
                      key={item.key}
                      label={item.label}
                      active={visiblePaperTags.has(item.key)}
                      onClick={() => togglePaperTag(item.key)}
                    />
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {PAPER_TAG_OPTIONS.map((item) => (
                    <p key={item.key} className="text-xs leading-5 text-ink-secondary">
                      {item.label}：{item.description}
                    </p>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {activeSection === "layout" ? (
          <LayoutSettingsSection
            currentTheme={currentTheme}
            pendingLayout={pendingLayout}
            onThemeChange={changeTheme}
            onLayoutChange={changeLayout}
          />
        ) : null}

        {activeSection === "history" ? (
          <SettingsHistorySection
            draftName={settingsHistory.draftName}
            saving={settingsHistory.saving}
            actionError={settingsHistory.actionError}
            actionMessage={settingsHistory.actionMessage}
            busy={settingsHistory.busy}
            settingsTransferBusy={cryptoBusy}
            dataTransferBusy={backupBusy}
            setDraftName={settingsHistory.setDraftName}
            onExportSettings={openConfigExportModal}
            onImportSettings={openConfigImportPicker}
            onExportAllData={openBackupExportModal}
            onImportAllData={openBackupImportPicker}
            onSaveCurrent={settingsHistory.saveCurrent}
          />
        ) : null}

        {activeSection === "skills" ? (
          <SkillsSection />
        ) : null}

        {activeSection === "memory" ? (
          <MemorySection
            memories={memories}
            observations={observations}
            loading={memoriesLoading}
            loadError={memoriesLoadError}
            clearingAuto={clearingAuto}
            privacy={memoryPrivacy}
            onEnter={enterMemories}
            onDelete={deleteMemory}
            onClearAuto={clearAutoMemories}
          />
        ) : null}

        {activeSection === "about" ? (
          <div className="space-y-4">
            <AboutSection
              appVersion={appVersion}
              loading={loading}
              updateState={updateState}
              updateInfo={updateInfo}
              updateMsg={updateMsg}
              updatePublishedAt={updatePublishedAt}
              downloadProgress={downloadProgress}
              onCheckUpdate={handleCheckUpdate}
              onInstallUpdate={handleInstallUpdate}
            />
            <SettingsChangelogCard />
            <FeedbackSection />
          </div>
        ) : null}
      </div>
    </div>

    {/* 加密密码弹窗 */}
    {cryptoModal !== null && (
      <CryptoConfigModal
        modal={cryptoModal}
        password={cryptoPassword}
        confirm={cryptoConfirm}
        busy={cryptoBusy}
        error={cryptoError}
        onPasswordChange={(value) => {
          setCryptoPassword(value);
        }}
        onConfirmChange={(value) => {
          setCryptoConfirm(value);
        }}
        onClose={closeCryptoModal}
        onSubmit={handleCryptoConfirm}
      />
    )}

    {/* 数据备份弹窗 */}
    {backupModal !== null && (
      <CryptoConfigModal
        modal={backupModal}
        resourceLabel="全部数据备份"
        exportDescription="设置一个密码保护全量数据备份，导入时需要输入同一密码。"
        importDescription="输入导出时设置的密码解锁备份文件，导入后会覆盖本机现有数据。"
        exportWarning="备份包含配置、配置历史、论文、会话、记忆、投稿、实验数据和托管文件，请妥善保管。"
        password={backupPassword}
        confirm={backupConfirm}
        busy={backupBusy}
        error={backupError}
        onPasswordChange={(value) => {
          setBackupPassword(value);
        }}
        onConfirmChange={(value) => {
          setBackupConfirm(value);
        }}
        onClose={closeBackupModal}
        onSubmit={handleBackupConfirm}
      />
    )}

    <ConfigHistoryManageModal
      open={configManageOpen}
      entries={settingsHistory.entries}
      loading={settingsHistory.loading}
      loadError={settingsHistory.loadError}
      selectedId={settingsHistory.selectedId}
      applyingId={settingsHistory.applyingId}
      deletingId={settingsHistory.deletingId}
      busy={settingsHistory.busy}
      setSelectedId={settingsHistory.setSelectedId}
      onApplyHistory={settingsHistory.applyHistory}
      onDeleteHistory={settingsHistory.deleteHistory}
      onReload={settingsHistory.reload}
      onClose={() => setConfigManageOpen(false)}
    />
    </>
  );
}

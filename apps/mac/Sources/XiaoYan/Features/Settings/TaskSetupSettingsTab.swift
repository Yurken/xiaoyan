import SwiftUI

struct TaskSetupSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("设置页先做三件事就够了：先接通小妍，再按需要补任务分工，最后决定是否启用多能力域协作。剩下的参数放到后面的分区再看。")
                .font(.caption)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 12) {
                ForEach(steps) { step in
                    stepCard(step)
                }
            }

            HStack(spacing: 12) {
                suggestionCard(
                    title: "论文库默认建议",
                    description: paperImportReady
                        ? "论文导入识别当前已开启。你可以等小妍默认连接稳定后，再去调整标签显示和自动识别范围。"
                        : "如果导入结果不稳定，先恢复默认识别项，让小妍自动补标题、作者、年份和来源。",
                    icon: "doc.text",
                    color: .orange
                )
                suggestionCard(
                    title: "版本与备份",
                    description: "定期导出加密配置快照，方便在多台设备或重装后快速恢复。",
                    icon: "lock.shield",
                    color: .blue
                )
            }
        }
    }

    // MARK: - Steps

    private var steps: [SetupStep] {
        [
            SetupStep(
                id: "connection",
                title: "先接通小妍",
                description: connectionReady
                    ? "当前小妍默认模型已配置好。没有单独指定的场景，会先回退到这里。"
                    : "先选服务商，填好 URL、API Key 和默认对话模型。先让小妍稳定可用，再看细分分工。",
                ready: connectionReady,
                action: "打开模型服务设置",
                icon: "link"
            ),
            SetupStep(
                id: "roles",
                title: "再按需要补任务分工",
                description: rolesReady
                    ? "阅读、综述、复现或视觉识别里，至少有一类任务已经配置了专用模型。"
                    : "这一步不是必填。先从论文阅读、综述写作和视觉识别三类高频任务里挑需要单独提速的场景即可。",
                ready: rolesReady,
                action: "打开多 Agent 设置",
                icon: "route"
            ),
            SetupStep(
                id: "multiAgent",
                title: "最后决定是否启用多能力域协作",
                description: multiAgentReady
                    ? "多能力域协作已启用。复杂任务会走调度和分工流程。"
                    : "如果你只想先稳定使用单模型对话，可以暂时关闭，等基础配置跑顺再打开。",
                ready: multiAgentReady,
                action: "去调整协作模式",
                icon: "cpu"
            ),
        ]
    }

    private func stepCard(_ step: SetupStep) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: step.ready ? "checkmark.circle.fill" : "circle")
                .font(.body)
                .foregroundStyle(step.ready ? Color.green : Color.secondary)
                .frame(width: 32, height: 32)
                .background(step.ready ? Color.green.opacity(0.1) : Color.secondary.opacity(0.08))
                .cornerRadius(Theme.Radii.small)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Text(step.title)
                        .font(Theme.Typography.subheadline.bold())
                    Spacer()
                }
                Text(step.description)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }

            Spacer()
        }
        .padding(12)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    private func suggestionCard(title: String, description: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(color)
                Text(title)
                    .font(Theme.Typography.caption.bold())
            }
            Text(description)
                .font(Theme.Typography.caption)
                .foregroundStyle(.secondary)
                .lineLimit(3)
        }
        .padding(12)
        .background(Color.secondary.opacity(0.05))
        .cornerRadius(Theme.Radii.medium)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radii.medium)
                .stroke(Color.secondary.opacity(0.12), lineWidth: 1)
        )
    }

    // MARK: - Readiness Checks

    private var connectionReady: Bool {
        guard let provider = settings.get("llm_provider") else { return false }
        switch provider {
        case "openai":
            return !(settings.get("openai_api_key")?.isEmpty ?? true)
                && !(settings.get("openai_chat_model")?.isEmpty ?? true)
        case "anthropic":
            return !(settings.get("anthropic_api_key")?.isEmpty ?? true)
                && !(settings.get("anthropic_chat_model")?.isEmpty ?? true)
        default:
            // openai_compatible or ollama
            let hasModel = !(settings.get("openai_compatible_chat_model")?.isEmpty ?? true)
            let isOllama = provider == "ollama"
            let hasUrl = !(settings.get("openai_compatible_base_url")?.isEmpty ?? true)
            let hasKey = !(settings.get("openai_compatible_api_key")?.isEmpty ?? true)
            return hasModel && (isOllama || hasUrl || hasKey)
        }
    }

    private var rolesReady: Bool {
        let keys = [
            "paper_analysis_model",
            "survey_writer_model",
            "paper_reproduction_model",
            "vision_model",
            "copilot_simple_model",
            "multi_agent_supervisor_model",
        ]
        return keys.contains { !(settings.get($0)?.isEmpty ?? true) }
    }

    private var multiAgentReady: Bool {
        let enabled = settings.get("multi_agent_enabled") == "true"
        let agents = settings.get("multi_agent_enabled_agents")?.split(separator: ",").filter { !$0.isEmpty } ?? []
        return enabled && !agents.isEmpty
    }

    private var paperImportReady: Bool {
        let keys = [
            "paper_import_recognize_title",
            "paper_import_recognize_authors",
            "paper_import_recognize_year",
            "paper_import_recognize_venue",
            "paper_import_recognize_keywords",
        ]
        return keys.contains { settings.get($0) != "false" }
    }
}

private struct SetupStep: Identifiable {
    let id: String
    let title: String
    let description: String
    let ready: Bool
    let action: String
    let icon: String
}

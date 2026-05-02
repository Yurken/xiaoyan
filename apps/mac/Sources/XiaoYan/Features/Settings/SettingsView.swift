import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var selectedTab: Tab = .provider

    enum Tab: String, CaseIterable {
        case general = "通用"
        case provider = "模型服务"
        case rag = "RAG 检索"
        case agents = "多 Agent"
        case papers = "论文"
        case tools = "工具"
        case memory = "记忆"
        case skills = "技能"
        case importExport = "导入/导出"
        case layout = "布局"
        case taskSetup = "快速开始"
        case about = "关于"
        case changelog = "更新日志"

        var icon: String {
            switch self {
            case .general: return "gear"
            case .provider: return "network"
            case .rag: return "magnifyingglass"
            case .agents: return "cpu"
            case .papers: return "doc.text"
            case .tools: return "wrench"
            case .memory: return "brain"
            case .skills: return "bolt"
            case .importExport: return "arrow.up.arrow.down"
            case .layout: return "sidebar.left"
            case .taskSetup: return "slider.horizontal.3"
            case .about: return "info.circle"
            case .changelog: return "clock.arrow.circlepath"
            }
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            List(Tab.allCases, id: \.self, selection: $selectedTab) { tab in
                Label(tab.rawValue, systemImage: tab.icon)
                    .tag(tab)
            }
            .listStyle(.sidebar)
            .frame(width: 160)

            Divider()

            ScrollView {
                Group {
                    switch selectedTab {
                    case .general: GeneralSettingsTab()
                    case .provider: ProviderSettingsTab()
                    case .rag: RAGSettingsTab()
                    case .agents: AgentSettingsTab()
                    case .papers: PaperSettingsTab()
                    case .tools: ToolsSettingsTab()
                    case .memory: MemorySettingsTab()
                    case .skills: SkillsSettingsTab()
                    case .importExport: ImportExportSettingsTab()
                    case .layout: LayoutSettingsTab()
                    case .taskSetup: TaskSetupSettingsTab()
                    case .about: AboutSettingsTab()
                    case .changelog: ChangelogSettingsTab()
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .navigationTitle("设置")
    }
}

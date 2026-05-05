import SwiftUI

struct ToolsView: View {
    @State private var selectedTab: Tab = .arxiv

    enum Tab: String, CaseIterable {
        case discovery = "论文发现"
        case arxiv = "arXiv 搜索"
        case sourceLookup = "期刊查询"
        case translation = "学术翻译"
        case markdown = "Markdown 整理"
        case ppt = "幻灯片"
        case friendLinks = "科研友链"

        var icon: String {
            switch self {
            case .discovery: return "doc.text.magnifyingglass"
            case .arxiv: return "sparkles"
            case .sourceLookup: return "book.closed"
            case .translation: return "globe"
            case .markdown: return "doc.plaintext"
            case .ppt: return "rectangle.3.offgrid"
            case .friendLinks: return "link"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            customTabBar
            Divider()
            content
        }
        .navigationTitle("工具")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("实用工具")
                .font(.title2.bold())
            Text("辅助科研写作的各类工具")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
    }

    private var customTabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                ForEach(Tab.allCases, id: \.self) { tab in
                    Button(action: { selectedTab = tab }) {
                        HStack(spacing: 4) {
                            Image(systemName: tab.icon)
                                .font(.caption2)
                            Text(tab.rawValue)
                                .font(.caption)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(selectedTab == tab ? Theme.Colors.surface : Color.clear)
                        .foregroundStyle(selectedTab == tab ? .primary : .secondary)
                        .cornerRadius(8)
                        .nmShadow(level: selectedTab == tab ? Theme.Shadows.soft : Theme.Shadows.inner)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(4)
            .background(Theme.Colors.surface)
            .cornerRadius(Theme.Radii.medium)
            .nmShadow(level: Theme.Shadows.inner)
        }
        .padding(.horizontal)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var content: some View {
        switch selectedTab {
        case .discovery: PaperDiscoveryView()
        case .arxiv: ArxivSearchView()
        case .sourceLookup: SourceLookupView()
        case .translation: TranslationView()
        case .markdown: MarkdownFormatterView()
        case .ppt: PptWorkspaceView()
        case .friendLinks: FriendLinksView()
        }
    }
}

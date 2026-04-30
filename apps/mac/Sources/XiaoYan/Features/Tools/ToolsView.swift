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
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("工具", selection: $selectedTab) {
                ForEach(Tab.allCases, id: \.self) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding()

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
        .navigationTitle("工具")
    }
}

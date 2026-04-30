import SwiftUI

struct FriendLinkSection {
    let title: String
    let items: [FriendLinkItem]
}

struct FriendLinkItem {
    let name: String
    let href: String
}

let friendLinkSections: [FriendLinkSection] = [
    FriendLinkSection(title: "主流 AI 助手", items: [
        FriendLinkItem(name: "ChatGPT", href: "https://chatgpt.com/"),
        FriendLinkItem(name: "Claude", href: "https://claude.ai/"),
        FriendLinkItem(name: "Gemini", href: "https://gemini.google.com/"),
        FriendLinkItem(name: "DeepSeek", href: "https://chat.deepseek.com/"),
        FriendLinkItem(name: "Kimi", href: "https://kimi.moonshot.cn/"),
        FriendLinkItem(name: "通义千问", href: "https://tongyi.aliyun.com/"),
        FriendLinkItem(name: "Perplexity", href: "https://www.perplexity.ai/"),
    ]),
    FriendLinkSection(title: "AI 学术工具", items: [
        FriendLinkItem(name: "Semantic Scholar", href: "https://www.semanticscholar.org/"),
        FriendLinkItem(name: "Elicit", href: "https://elicit.com/"),
        FriendLinkItem(name: "Consensus", href: "https://consensus.app/"),
        FriendLinkItem(name: "Connected Papers", href: "https://www.connectedpapers.com/"),
        FriendLinkItem(name: "SciSpace", href: "https://typeset.io/"),
    ]),
    FriendLinkSection(title: "论文检索", items: [
        FriendLinkItem(name: "arXiv", href: "https://arxiv.org/"),
        FriendLinkItem(name: "Google Scholar", href: "https://scholar.google.com/"),
        FriendLinkItem(name: "DBLP", href: "https://dblp.org/"),
        FriendLinkItem(name: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov/"),
        FriendLinkItem(name: "Web of Science", href: "https://www.webofscience.com/"),
    ]),
    FriendLinkSection(title: "代码与数据", items: [
        FriendLinkItem(name: "GitHub", href: "https://github.com/"),
        FriendLinkItem(name: "Hugging Face", href: "https://huggingface.co/"),
        FriendLinkItem(name: "Papers with Code", href: "https://paperswithcode.com/"),
        FriendLinkItem(name: "Kaggle", href: "https://www.kaggle.com/"),
        FriendLinkItem(name: "Zenodo", href: "https://zenodo.org/"),
    ]),
    FriendLinkSection(title: "写作与投稿", items: [
        FriendLinkItem(name: "Overleaf", href: "https://www.overleaf.com/"),
        FriendLinkItem(name: "Grammarly", href: "https://www.grammarly.com/"),
        FriendLinkItem(name: "LanguageTool", href: "https://languagetool.org/"),
        FriendLinkItem(name: "QuillBot", href: "https://quillbot.com/"),
        FriendLinkItem(name: "知网", href: "https://www.cnki.net/"),
    ]),
]

struct FriendLinksView: View {
    @State private var expandedSections: Set<String> = Set(friendLinkSections.map(\.title))

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "globe")
                    .font(.title3)
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("科研友链")
                        .font(.headline)
                    Text("\(friendLinkSections.reduce(0) { $0 + $1.items.count }) 条链接 · \(friendLinkSections.count) 个分类")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(expandedSections.count == friendLinkSections.count ? "收起全部" : "展开全部") {
                    if expandedSections.count == friendLinkSections.count {
                        expandedSections.removeAll()
                    } else {
                        expandedSections = Set(friendLinkSections.map(\.title))
                    }
                }
                .font(.caption)
            }
            .padding()

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(friendLinkSections, id: \.title) { section in
                        FriendLinkSectionView(
                            section: section,
                            isExpanded: expandedSections.contains(section.title)
                        ) {
                            if expandedSections.contains(section.title) {
                                expandedSections.remove(section.title)
                            } else {
                                expandedSections.insert(section.title)
                            }
                        }
                    }
                }
                .padding()
            }
        }
    }
}

private struct FriendLinkSectionView: View {
    let section: FriendLinkSection
    let isExpanded: Bool
    let toggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) {
                HStack {
                    Text(section.title)
                        .font(.subheadline.bold())
                    Text("\(section.items.count) 条")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(4)
                    Spacer()
                    Text(isExpanded ? "收起" : "展开")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .padding(10)

            if isExpanded {
                Divider()
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180))], spacing: 8) {
                    ForEach(section.items, id: \.name) { item in
                        Link(destination: URL(string: item.href)!) {
                            HStack(spacing: 8) {
                                Image(systemName: "link.circle")
                                    .foregroundStyle(.blue)
                                Text(item.name)
                                    .font(.subheadline)
                                Spacer()
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(8)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(10)
            }
        }
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
    }
}

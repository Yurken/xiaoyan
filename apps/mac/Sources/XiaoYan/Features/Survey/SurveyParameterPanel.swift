import SwiftUI

/// 综述高级参数面板。
/// 1:1 desktop `SurveyPanel.tsx:94-117, 532-647` 五类高级参数：时间范围 / 文献类型 / 数据库 / 引用格式 / 语言。
struct SurveyParameterPanel: View {
    @Binding var timeRange: String
    @Binding var documentType: String
    @Binding var database: String
    @Binding var citationFormat: String
    @Binding var language: String

    static let timeRanges = [
        ("全部", "all"),
        ("最近1年", "1y"),
        ("最近3年", "3y"),
        ("最近5年", "5y"),
        ("最近10年", "10y"),
    ]

    static let documentTypes = [
        ("全部", "all"),
        ("期刊论文", "journal"),
        ("会议论文", "conference"),
        ("预印本", "preprint"),
        ("综述", "review"),
    ]

    static let databases = [
        ("全部", "all"),
        ("arXiv", "arxiv"),
        ("Semantic Scholar", "semantic_scholar"),
        ("PubMed", "pubmed"),
    ]

    static let citationFormats = [
        ("APA", "apa"),
        ("MLA", "mla"),
        ("IEEE", "ieee"),
        ("GB/T 7714", "gb7714"),
    ]

    static let languages = [
        ("中文", "zh"),
        ("英文", "en"),
        ("中英双语", "bilingual"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("高级参数")
                .font(.caption.bold())
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                pickerGroup("时间范围", options: Self.timeRanges, selection: $timeRange)
                pickerGroup("文献类型", options: Self.documentTypes, selection: $documentType)
                pickerGroup("数据库", options: Self.databases, selection: $database)
            }

            HStack(spacing: 12) {
                pickerGroup("引用格式", options: Self.citationFormats, selection: $citationFormat)
                pickerGroup("输出语言", options: Self.languages, selection: $language)
            }
        }
    }

    private func pickerGroup(
        _ label: String,
        options: [(String, String)],
        selection: Binding<String>
    ) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Picker("", selection: selection) {
                ForEach(options, id: \.1) { name, value in
                    Text(name).tag(value)
                }
            }
            .pickerStyle(.menu)
            .controlSize(.small)
            .frame(minWidth: 100)
        }
    }
}

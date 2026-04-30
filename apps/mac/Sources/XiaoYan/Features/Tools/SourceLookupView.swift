import SwiftUI

struct SourceLookupView: View {
    @State private var query = ""
    @State private var journal: JournalPartition?
    @State private var ccf: CCFCatalogEntry?
    @State private var hasSearched = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                TextField("期刊名称或 ISSN...", text: $query)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { lookup() }
                Button("查询", action: lookup)
                    .keyboardShortcut(.defaultAction)
                    .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()

            if !hasSearched {
                VStack(spacing: 12) {
                    Image(systemName: "book.closed")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("查询期刊分区和 CCF 评级")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if let j = journal {
                            journalCard(j)
                        }
                        if let c = ccf {
                            ccfCard(c)
                        }
                        if journal == nil && ccf == nil {
                            Text("未找到匹配结果")
                                .foregroundStyle(.secondary)
                                .padding()
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func lookup() {
        let result = SourceService.lookup(query: query)
        journal = result.journal
        ccf = result.ccf
        hasSearched = true
    }

    @ViewBuilder
    private func journalCard(_ j: JournalPartition) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("JCR/CAS 分区", systemImage: "chart.bar")
                .font(.headline)

            Text(j.title)
                .font(.subheadline.bold())

            Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 4) {
                if let issn = j.issn {
                    GridRow { Text("ISSN").foregroundStyle(.secondary); Text(issn) }
                }
                if let publisher = j.publisher {
                    GridRow { Text("出版商").foregroundStyle(.secondary); Text(publisher) }
                }
                if let jif = j.jif {
                    GridRow { Text("影响因子").foregroundStyle(.secondary); Text(String(format: "%.3f", jif)) }
                }
                if let quartile = j.jcrQuartile {
                    GridRow { Text("JCR 分区").foregroundStyle(.secondary); Text(quartile) }
                }
                if let casQ = j.casQuartile {
                    GridRow { Text("CAS 分区").foregroundStyle(.secondary); Text(casQ) }
                }
                if j.casTop == true {
                    GridRow { Text("CAS Top").foregroundStyle(.secondary); Text("是").foregroundStyle(.green) }
                }
            }
            .font(.caption)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
    }

    @ViewBuilder
    private func ccfCard(_ c: CCFCatalogEntry) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("CCF 目录", systemImage: "star")
                .font(.headline)

            Text(c.label)
                .font(.subheadline.bold())

            Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 4) {
                if let fullName = c.fullName {
                    GridRow { Text("全称").foregroundStyle(.secondary); Text(fullName).font(.caption) }
                }
                if let rating = c.rating {
                    GridRow { Text("CCF 等级").foregroundStyle(.secondary); Text(rating).foregroundStyle(ratingColor(rating)) }
                }
                if let area = c.area {
                    GridRow { Text("领域").foregroundStyle(.secondary); Text(area) }
                }
                if let kind = Optional(c.kind) {
                    GridRow { Text("类型").foregroundStyle(.secondary); Text(kind) }
                }
            }
            .font(.caption)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
    }

    private func ratingColor(_ rating: String) -> Color {
        switch rating.uppercased() {
        case "A": return .red
        case "B": return .orange
        case "C": return .blue
        default: return .secondary
        }
    }
}

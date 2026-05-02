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

            HStack(spacing: 6) {
                if let indexes = j.indexes {
                    ForEach(indexes, id: \.self) { idx in
                        Text(idx)
                            .font(.caption2.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.12))
                            .foregroundColor(.blue)
                            .cornerRadius(4)
                    }
                }
                if let q = j.jcrQuartile {
                    Text(q)
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.orange.opacity(0.12))
                        .foregroundColor(.orange)
                        .cornerRadius(4)
                }
                if let q = j.casQuartile {
                    Text(q)
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.purple.opacity(0.12))
                        .foregroundColor(.purple)
                        .cornerRadius(4)
                }
                if j.casTop == true {
                    Text("Top")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.12))
                        .foregroundColor(.green)
                        .cornerRadius(4)
                }
                if j.openAccess == true {
                    Text("OA")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.12))
                        .foregroundColor(.green)
                        .cornerRadius(4)
                }
            }

            Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 4) {
                if let issn = j.issn {
                    GridRow { Text("ISSN").foregroundStyle(.secondary); Text(issn) }
                }
                if let eissn = j.eissn {
                    GridRow { Text("eISSN").foregroundStyle(.secondary); Text(eissn) }
                }
                if let publisher = j.publisher {
                    GridRow { Text("出版商").foregroundStyle(.secondary); Text(publisher) }
                }
                if let jif = j.jif {
                    GridRow { Text("影响因子").foregroundStyle(.secondary); Text(String(format: "%.3f", jif)) }
                }
                if let jifRank = j.jifRank {
                    GridRow { Text("JIF 排名").foregroundStyle(.secondary); Text(jifRank) }
                }
                if let jcrCategory = j.jcrCategory {
                    GridRow { Text("JCR 分类").foregroundStyle(.secondary); Text(jcrCategory) }
                }
                if let quartile = j.jcrQuartile {
                    GridRow { Text("JCR 分区").foregroundStyle(.secondary); Text(quartile) }
                }
                if let casQ = j.casQuartile {
                    GridRow { Text("CAS 分区").foregroundStyle(.secondary); Text(casQ) }
                }
            }
            .font(.caption)

            if let wosCategories = j.wosCategories, !wosCategories.isEmpty {
                HStack(spacing: 6) {
                    ForEach(wosCategories.prefix(6), id: \.self) { cat in
                        Text(cat)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    @ViewBuilder
    private func ccfCard(_ c: CCFCatalogEntry) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("CCF 目录", systemImage: "star")
                .font(.headline)

            HStack(spacing: 6) {
                if let url = c.url, let link = URL(string: url) {
                    Link(c.label, destination: link)
                        .font(.subheadline.bold())
                } else {
                    Text(c.label)
                        .font(.subheadline.bold())
                }
                if let rating = c.rating {
                    Text(rating)
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(ratingColor(rating).opacity(0.12))
                        .foregroundColor(ratingColor(rating))
                        .cornerRadius(4)
                }
            }

            Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 4) {
                if let fullName = c.fullName {
                    GridRow { Text("全称").foregroundStyle(.secondary); Text(fullName).font(.caption) }
                }
                if let area = c.area {
                    GridRow { Text("领域").foregroundStyle(.secondary); Text(area) }
                }
                if let publisher = c.publisher {
                    GridRow { Text("出版商").foregroundStyle(.secondary); Text(publisher) }
                }
                if let kind = Optional(c.kind) {
                    GridRow { Text("类型").foregroundStyle(.secondary); Text(kind) }
                }
            }
            .font(.caption)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
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

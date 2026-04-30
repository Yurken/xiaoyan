import SwiftUI

struct PaperMetadataEditor: View {
    let paper: Paper
    let paperService: PaperService
    let onSave: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title: String = ""
    @State private var authorsText: String = ""
    @State private var yearText: String = ""
    @State private var venue: String = ""
    @State private var doi: String = ""
    @State private var tagsText: String = ""
    @State private var notes: String = ""
    @State private var importanceColor: String = ""

    private let colorOptions = ["", "red", "orange", "yellow", "green", "blue", "purple"]

    var body: some View {
        NavigationStack {
            Form {
                Section("基本信息") {
                    TextField("标题", text: $title)
                    TextField("作者（逗号分隔）", text: $authorsText)
                    TextField("年份", text: $yearText)
                        .textFieldStyle(.roundedBorder)
                    TextField("期刊/会议", text: $venue)
                    TextField("DOI", text: $doi)
                }

                Section("标签") {
                    TextField("标签（逗号分隔）", text: $tagsText)
                }

                Section("重要性标记") {
                    Picker("颜色", selection: $importanceColor) {
                        Text("无").tag("")
                        ForEach(colorOptions.dropFirst(), id: \.self) { color in
                            HStack {
                                Circle()
                                    .fill(colorFromString(color))
                                    .frame(width: 12, height: 12)
                                Text(colorDisplayName(color))
                            }
                            .tag(color)
                        }
                    }
                }

                Section("备注") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .formStyle(.grouped)
            .navigationTitle("编辑元数据")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                }
            }
            .onAppear {
                title = paper.title
                authorsText = paper.authors.joined(separator: ", ")
                yearText = paper.year.map(String.init) ?? ""
                venue = paper.venue ?? ""
                doi = paper.doi ?? ""
                tagsText = paper.tags.joined(separator: ", ")
                notes = paper.notes ?? ""
                importanceColor = paper.importanceColor ?? ""
            }
        }
    }

    private func save() {
        let authors = authorsText
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        let tags = tagsText
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        let year = Int(yearText)

        let updated = Paper(
            id: paper.id,
            title: title,
            authors: authors,
            abstractText: paper.abstractText,
            year: year,
            venue: venue.isEmpty ? nil : venue,
            doi: doi.isEmpty ? nil : doi,
            filePath: paper.filePath,
            fullText: paper.fullText,
            researchInterestId: paper.researchInterestId,
            tags: tags,
            importanceColor: importanceColor.isEmpty ? nil : importanceColor,
            notes: notes.isEmpty ? nil : notes,
            status: paper.status,
            createdAt: paper.createdAt
        )
        try? paperService.update(paper: updated)
        onSave()
        dismiss()
    }

    private func colorFromString(_ color: String) -> Color {
        switch color {
        case "red": return .red
        case "orange": return .orange
        case "yellow": return .yellow
        case "green": return .green
        case "blue": return .blue
        case "purple": return .purple
        default: return .clear
        }
    }

    private func colorDisplayName(_ color: String) -> String {
        switch color {
        case "red": return "红色"
        case "orange": return "橙色"
        case "yellow": return "黄色"
        case "green": return "绿色"
        case "blue": return "蓝色"
        case "purple": return "紫色"
        default: return "无"
        }
    }
}

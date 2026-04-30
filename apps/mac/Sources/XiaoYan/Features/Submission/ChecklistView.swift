import SwiftUI
import GRDB

struct ChecklistView: View {
    let service: SubmissionService
    @State private var submissions: [Submission] = []
    @State private var selectedSubmission: Submission?
    @State private var items: [SubmissionChecklistItem] = []
    @State private var newItemLabel = ""
    @State private var selectedCategory: String = "全部"

    private let defaultTemplates: [(label: String, category: String)] = [
        ("标题符合会议主题方向", "内容"),
        ("摘要不超过字数限制", "内容"),
        ("关键词已选择（3–5 个）", "内容"),
        ("页面数量符合要求", "格式"),
        ("字体与字号符合模板", "格式"),
        ("页边距符合规定", "格式"),
        ("图表清晰可读（≥ 300 DPI）", "格式"),
        ("参考文献格式统一", "格式"),
        ("作者顺序已确认", "提交"),
        ("作者单位信息正确", "提交"),
        ("利益冲突声明已填写（如需）", "提交"),
        ("补充材料准备完毕（如需）", "提交"),
        ("匿名化处理完成（双盲投稿）", "合规"),
        ("自查重复率 < 15%", "合规"),
        ("AI 使用声明（如需）", "合规"),
    ]

    var categories: [String] {
        var cats = Set(items.compactMap { $0.category })
        cats.insert("全部")
        return Array(cats).sorted()
    }

    var filteredItems: [SubmissionChecklistItem] {
        if selectedCategory == "全部" { return items }
        return items.filter { $0.category == selectedCategory }
    }

    var checkedCount: Int {
        items.filter { $0.checked == true }.count
    }

    var progress: Double {
        items.isEmpty ? 0 : Double(checkedCount) / Double(items.count) * 100
    }

    var body: some View {
        HStack(spacing: 0) {
            List(submissions, selection: $selectedSubmission) { sub in
                Text(sub.title)
                    .font(.subheadline)
                    .lineLimit(1)
                    .tag(sub)
            }
            .listStyle(.sidebar)
            .frame(width: 200)

            Divider()

            VStack(spacing: 0) {
                if let sub = selectedSubmission {
                    VStack(spacing: 12) {
                        HStack {
                            Text(sub.title)
                                .font(.headline)
                            Spacer()
                            if progress == 100 {
                                Label("可以投稿了", systemImage: "checkmark.circle.fill")
                                    .font(.caption.bold())
                                    .foregroundStyle(.green)
                            }
                            Button("重置") { resetItems() }
                                .font(.caption)
                            Button("加载模板") { loadTemplates() }
                                .font(.caption)
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                        }

                        HStack {
                            Text("\(checkedCount) / \(items.count)")
                                .font(.caption.bold())
                                .foregroundStyle(progress == 100 ? .green : .blue)
                            Spacer()
                        }

                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color.secondary.opacity(0.15))
                                    .frame(height: 6)
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(progress == 100 ? Color.green : Color.blue)
                                    .frame(width: geo.size.width * CGFloat(progress) / 100, height: 6)
                            }
                        }
                        .frame(height: 6)
                    }
                    .padding()

                    Divider()

                    if categories.count > 1 {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(categories, id: \.self) { cat in
                                    Button(action: { selectedCategory = cat }) {
                                        HStack(spacing: 4) {
                                            Text(cat)
                                                .font(.caption)
                                            if cat != "全部" {
                                                let catItems = items.filter { $0.category == cat }
                                                let catChecked = catItems.filter { $0.checked == true }.count
                                                Text("\(catChecked)/\(catItems.count)")
                                                    .font(.caption2)
                                                    .opacity(0.7)
                                            }
                                        }
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 4)
                                        .background(selectedCategory == cat ? Color.blue : Color(nsColor: .controlBackgroundColor))
                                        .foregroundStyle(selectedCategory == cat ? .white : .primary)
                                        .cornerRadius(6)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                            .padding(.vertical, 8)
                        }
                    }

                    List {
                        ForEach(filteredItems) { item in
                            HStack {
                                Button(action: { toggleItem(item) }) {
                                    Image(systemName: (item.checked ?? false) ? "checkmark.square.fill" : "square")
                                        .foregroundStyle((item.checked ?? false) ? .green : .secondary)
                                }
                                .buttonStyle(.plain)
                                Text(item.label)
                                    .strikethrough(item.checked ?? false)
                                    .foregroundStyle((item.checked ?? false) ? .secondary : .primary)
                                Spacer()
                                if let cat = item.category {
                                    Text(cat)
                                        .font(.caption2)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.secondary.opacity(0.1))
                                        .cornerRadius(4)
                                }
                                Button(action: { deleteItem(item) }) {
                                    Image(systemName: "trash")
                                        .foregroundStyle(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        HStack {
                            TextField("添加检查项...", text: $newItemLabel)
                                .textFieldStyle(.roundedBorder)
                                .onSubmit(addItem)
                            Button("添加", action: addItem)
                                .disabled(newItemLabel.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                    }
                    .listStyle(.plain)
                } else {
                    ContentUnavailableView("选择投稿", systemImage: "checklist")
                }
            }
        }
        .onAppear(perform: reload)
        .onChange(of: selectedSubmission?.id) { _, _ in
            selectedCategory = "全部"
            loadItems()
        }
    }

    private func reload() {
        submissions = service.listSubmissions()
    }

    private func loadItems() {
        guard let subId = selectedSubmission?.id else { items = []; return }
        items = (try? DatabaseManager.shared.dbQueue.read { db in
            try SubmissionChecklistItem.fetchAll(db, sql: "SELECT * FROM submission_checklist WHERE submission_id = ? ORDER BY sort_order", arguments: [subId])
        }) ?? []
    }

    private func loadTemplates() {
        guard let subId = selectedSubmission?.id else { return }
        let existingLabels = Set(items.map { $0.label })
        var newItems: [SubmissionChecklistItem] = []
        for (index, template) in defaultTemplates.enumerated() {
            guard !existingLabels.contains(template.label) else { continue }
            newItems.append(SubmissionChecklistItem(
                id: UUID().uuidString,
                submissionId: subId,
                label: template.label,
                checked: false,
                category: template.category,
                sortOrder: items.count + index
            ))
        }
        for item in newItems {
            service.upsertChecklistItem(item)
        }
        loadItems()
    }

    private func resetItems() {
        guard selectedSubmission?.id != nil else { return }
        for var item in items {
            item.checked = false
            service.upsertChecklistItem(item)
        }
        loadItems()
    }

    private func toggleItem(_ item: SubmissionChecklistItem) {
        var updated = item
        updated.checked = !(item.checked ?? false)
        service.upsertChecklistItem(updated)
        loadItems()
    }

    private func deleteItem(_ item: SubmissionChecklistItem) {
        try? SubmissionRepository().deleteChecklistItem(id: item.id)
        loadItems()
    }

    private func addItem() {
        guard let subId = selectedSubmission?.id,
              !newItemLabel.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let item = SubmissionChecklistItem(
            id: UUID().uuidString,
            submissionId: subId,
            label: newItemLabel,
            checked: false,
            category: nil,
            sortOrder: items.count
        )
        service.upsertChecklistItem(item)
        newItemLabel = ""
        loadItems()
    }
}

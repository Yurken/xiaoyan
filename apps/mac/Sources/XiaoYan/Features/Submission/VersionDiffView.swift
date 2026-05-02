import SwiftUI

// MARK: - Diff Model

enum DiffLineType {
    case same, add, remove
}

struct DiffLine: Identifiable {
    let id = UUID()
    let type: DiffLineType
    let text: String
}

/// 行级 LCS Diff。1:1 desktop `shared.ts:134-180`
func lcsDiff(oldLines: [String], newLines: [String]) -> [DiffLine] {
    let m = oldLines.count
    let n = newLines.count
    guard m > 0 && n > 0 else {
        var result: [DiffLine] = []
        oldLines.forEach { result.append(DiffLine(type: .remove, text: $0)) }
        newLines.forEach { result.append(DiffLine(type: .add, text: $0)) }
        return result
    }

    var dp = Array(repeating: Array(repeating: 0, count: n + 1), count: m + 1)
    for i in 1...m {
        for j in 1...n {
            if oldLines[i - 1] == newLines[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1
            } else {
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
            }
        }
    }

    var result: [DiffLine] = []
    var i = m, j = n
    while i > 0 || j > 0 {
        if i > 0 && j > 0 && oldLines[i - 1] == newLines[j - 1] {
            result.append(DiffLine(type: .same, text: oldLines[i - 1]))
            i -= 1; j -= 1
        } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
            result.append(DiffLine(type: .add, text: newLines[j - 1]))
            j -= 1
        } else {
            result.append(DiffLine(type: .remove, text: oldLines[i - 1]))
            i -= 1
        }
    }
    return result.reversed()
}

// MARK: - View

struct VersionDiffView: View {
    let oldVersion: PaperVersion
    let newVersion: PaperVersion

    private var contentDiff: [DiffLine]? {
        guard let old = oldVersion.content, let new = newVersion.content else { return nil }
        return lcsDiff(oldLines: old.components(separatedBy: .newlines),
                       newLines: new.components(separatedBy: .newlines))
    }

    private var diffStats: (add: Int, remove: Int)? {
        guard let diff = contentDiff else { return nil }
        let add = diff.filter { $0.type == .add }.count
        let remove = diff.filter { $0.type == .remove }.count
        return (add, remove)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    diffSection(title: "标签", old: oldVersion.tag, new: newVersion.tag)
                    diffSection(title: "阶段", old: oldVersion.stage, new: newVersion.stage)
                    diffSection(title: "说明", old: oldVersion.label, new: newVersion.label)
                    diffSection(title: "备注", old: oldVersion.notes, new: newVersion.notes)

                    if let diff = contentDiff {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("内容对比")
                                    .font(.headline)
                                Spacer()
                                if let stats = diffStats {
                                    HStack(spacing: 8) {
                                        Label("+\(stats.add)", systemImage: "plus")
                                            .font(.caption.bold())
                                            .foregroundStyle(.green)
                                        Label("-\(stats.remove)", systemImage: "minus")
                                            .font(.caption.bold())
                                            .foregroundStyle(.red)
                                    }
                                }
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                ForEach(diff) { line in
                                    HStack(spacing: 6) {
                                        Image(systemName: lineIcon(line.type))
                                            .font(.caption2)
                                            .foregroundStyle(lineColor(line.type))
                                            .frame(width: 16)
                                        Text(line.text)
                                            .font(.system(.caption, design: .monospaced))
                                            .foregroundStyle(line.type == .remove ? .secondary : .primary)
                                            .strikethrough(line.type == .remove)
                                        Spacer()
                                    }
                                    .padding(.vertical, 2)
                                    .padding(.horizontal, 6)
                                    .background(lineBg(line.type))
                                    .cornerRadius(4)
                                }
                            }
                            .padding(8)
                            .background(Theme.Colors.surface)
                            .cornerRadius(Theme.Radii.medium)
                            .nmShadow(level: Theme.Shadows.soft)
                        }
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(minWidth: 500, minHeight: 300)
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("旧版本: \(oldVersion.tag ?? "未命名")")
                    .font(.subheadline.bold())
                if let date = oldVersion.createdAt {
                    Text(date, style: .date)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Image(systemName: "arrow.right")
                .foregroundStyle(.secondary)

            VStack(alignment: .trailing, spacing: 2) {
                Text("新版本: \(newVersion.tag ?? "未命名")")
                    .font(.subheadline.bold())
                if let date = newVersion.createdAt {
                    Text(date, style: .date)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding()
    }

    // MARK: - Helpers

    private func diffSection(title: String, old: String?, new: String?) -> some View {
        guard old != new else { return AnyView(EmptyView()) }
        return AnyView(
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.subheadline.bold())
                HStack(alignment: .top, spacing: 12) {
                    if let old = old, !old.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "minus.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.red)
                            Text(old)
                                .font(.body)
                                .strikethrough()
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let new = new, !new.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "plus.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.green)
                            Text(new)
                                .font(.body)
                        }
                    }
                }
            }
            .padding()
            .background(Theme.Colors.surface)
            .cornerRadius(Theme.Radii.medium)
            .nmShadow(level: Theme.Shadows.soft)
        )
    }

    private func lineIcon(_ type: DiffLineType) -> String {
        switch type {
        case .same: return "equal"
        case .add: return "plus"
        case .remove: return "minus"
        }
    }

    private func lineColor(_ type: DiffLineType) -> Color {
        switch type {
        case .same: return .secondary
        case .add: return .green
        case .remove: return .red
        }
    }

    private func lineBg(_ type: DiffLineType) -> Color {
        switch type {
        case .same: return Color.clear
        case .add: return Color.green.opacity(0.06)
        case .remove: return Color.red.opacity(0.06)
        }
    }
}

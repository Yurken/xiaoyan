import SwiftUI

struct VersionDiffView: View {
    let oldVersion: PaperVersion
    let newVersion: PaperVersion

    var body: some View {
        VStack(spacing: 0) {
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

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    diffSection(title: "标签", old: oldVersion.tag, new: newVersion.tag)
                    diffSection(title: "阶段", old: oldVersion.stage, new: newVersion.stage)
                    diffSection(title: "说明", old: oldVersion.label, new: newVersion.label)
                    diffSection(title: "备注", old: oldVersion.notes, new: newVersion.notes)

                    if let oldContent = oldVersion.content, let newContent = newVersion.content {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("内容对比")
                                .font(.headline)
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("旧版本")
                                        .font(.caption.bold())
                                        .foregroundStyle(.secondary)
                                    Text(oldContent)
                                        .font(.body)
                                        .textSelection(.enabled)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .padding()
                                .background(Color.red.opacity(0.04))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.red.opacity(0.15), lineWidth: 1)
                                )
                                .cornerRadius(8)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("新版本")
                                        .font(.caption.bold())
                                        .foregroundStyle(.secondary)
                                    Text(newContent)
                                        .font(.body)
                                        .textSelection(.enabled)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .padding()
                                .background(Color.green.opacity(0.04))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.green.opacity(0.15), lineWidth: 1)
                                )
                                .cornerRadius(8)
                            }
                        }
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(minWidth: 500, minHeight: 300)
    }

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
}

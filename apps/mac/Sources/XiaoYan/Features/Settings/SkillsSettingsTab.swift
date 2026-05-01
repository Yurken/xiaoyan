import SwiftUI

struct SkillsSettingsTab: View {
    @State private var skills: [Skill] = []
    @State private var isLoading = true
    @State private var searchText = ""
    @State private var showResetConfirm = false
    @State private var resetError: String?

    private let repo = SkillRepository()

    var filteredSkills: [Skill] {
        if searchText.isEmpty { return skills }
        let q = searchText.lowercased()
        return skills.filter {
            $0.title.lowercased().contains(q) ||
            $0.name.lowercased().contains(q) ||
            ($0.descriptionText?.lowercased().contains(q) ?? false) ||
            ($0.tags?.contains(where: { $0.lowercased().contains(q) }) ?? false)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "技能库", icon: "bolt") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("内置研究技能，也可新建自定义技能。在「小妍」对话中通过 /技能名 触发。")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(.secondary)
                            .font(.caption)
                        TextField("搜索技能...", text: $searchText)
                            .textFieldStyle(.plain)
                            .font(.caption)
                    }
                    .padding(6)
                    .background(Theme.Colors.surface)
                    .cornerRadius(Theme.Radii.medium)
                    .nmShadow(level: Theme.Shadows.soft)

                    HStack {
                        Spacer()
                        Button("重置内置技能") {
                            showResetConfirm = true
                        }
                        .buttonStyle(.borderless)
                        .controlSize(.small)
                        .foregroundStyle(.secondary)
                    }
                }

                if let error = resetError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .frame(maxWidth: .infinity, alignment: .center)
                } else if filteredSkills.isEmpty {
                    Text("没有找到匹配的技能")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                } else {
                    let builtin = filteredSkills.filter { $0.isBuiltin == true }
                    let custom = filteredSkills.filter { $0.isBuiltin != true }

                    if !custom.isEmpty {
                        Text("自定义")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 220))], spacing: 8) {
                            ForEach(custom) { skill in
                                SkillCard(skill: skill, onToggle: { toggleSkill(skill) })
                            }
                        }
                    }

                    if !builtin.isEmpty {
                        Text("内置技能（共 \(builtin.count) 条）")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 220))], spacing: 8) {
                            ForEach(builtin) { skill in
                                SkillCard(skill: skill, onToggle: { toggleSkill(skill) })
                            }
                        }
                    }
                }
            }
        }
        .onAppear(perform: load)
        .alert("重置内置技能", isPresented: $showResetConfirm) {
            Button("取消", role: .cancel) { }
            Button("重置", role: .destructive) {
                resetBuiltins()
            }
        } message: {
            Text("这将恢复所有内置技能为默认状态，不会删除自定义技能。")
        }
    }

    private func load() {
        isLoading = true
        try? repo.seedBuiltinsIfNeeded()
        skills = (try? repo.list()) ?? []
        isLoading = false
    }

    private func toggleSkill(_ skill: Skill) {
        try? repo.toggleEnabled(id: skill.id)
        load()
    }

    private func resetBuiltins() {
        do {
            try repo.resetBuiltins()
            resetError = nil
            load()
        } catch {
            resetError = "重置失败: \(error.localizedDescription)"
        }
    }
}

struct SkillCard: View {
    let skill: Skill
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(skill.title)
                    .font(.subheadline.bold())
                if skill.isBuiltin == true {
                    Text("内置")
                        .font(.caption2)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.blue.opacity(0.1))
                        .foregroundColor(.blue)
                        .cornerRadius(4)
                }
                Spacer()
                Toggle("", isOn: Binding(
                    get: { skill.isEnabled ?? true },
                    set: { _ in onToggle() }
                ))
                .toggleStyle(.switch)
                .controlSize(.small)
            }

            if let desc = skill.descriptionText, !desc.isEmpty {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack(spacing: 4) {
                Text("/\(skill.name)")
                    .font(.caption2)
                    .fontDesign(.monospaced)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(4)

                if let tags = skill.tags {
                    ForEach(tags, id: \.self) { tag in
                        Text(tag)
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(tagColor(tag).opacity(0.12))
                            .foregroundColor(tagColor(tag))
                            .cornerRadius(4)
                    }
                }
            }
        }
        .padding(10)
        .background((skill.isEnabled ?? true) ? Color(nsColor: .controlBackgroundColor) : Color.gray.opacity(0.06))
        .cornerRadius(10)
        .opacity((skill.isEnabled ?? true) ? 1.0 : 0.7)
    }

    private func tagColor(_ tag: String) -> Color {
        switch tag {
        case "paper": return .blue
        case "writing": return .purple
        case "survey": return .orange
        case "review": return .red
        case "code": return .green
        case "reproduce": return .teal
        case "planning": return .indigo
        case "translation": return .pink
        default: return .gray
        }
    }
}

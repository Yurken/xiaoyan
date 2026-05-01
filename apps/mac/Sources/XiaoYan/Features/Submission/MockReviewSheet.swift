import SwiftUI

struct MockReviewSheet: View {
    let service: SubmissionService
    let submissionId: String
    let prefilledContent: String
    var onImported: (Int) -> Void

    @EnvironmentObject var settings: AppSettings
    @Environment(\.dismiss) private var dismiss

    @State private var content: String = ""
    @State private var reviewerCount: Int = 3
    @State private var strictness: MockStrictness = .balanced
    @State private var results: [MockReviewerResult] = []
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil

    private var hasResults: Bool { !results.isEmpty }
    private var dominant: MockReviewVerdict? { dominantVerdict(results) }
    private var verdictCounts: [MockReviewVerdict: Int] { countVerdicts(results) }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            if hasResults {
                resultsBody
            } else {
                inputBody
            }
            Divider()
            footer
        }
        .frame(width: 640, height: 600)
        .onAppear {
            if content.isEmpty { content = prefilledContent }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "wand.and.stars")
                .font(.title3)
                .foregroundStyle(.purple)
            VStack(alignment: .leading, spacing: 2) {
                Text("AI 模拟审稿")
                    .font(.headline)
                Text("基于论文内容生成模拟审稿意见，辅助投稿前自查")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button(action: { dismiss() }) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.borderless)
        }
        .padding()
    }

    // MARK: - Input

    private var inputBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("论文内容")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    TextEditor(text: $content)
                        .font(.body)
                        .frame(minHeight: 220)
                        .padding(6)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                }

                HStack(alignment: .top, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("审稿人数量")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        Picker("", selection: $reviewerCount) {
                            Text("2 人").tag(2)
                            Text("3 人").tag(3)
                            Text("3+AC").tag(4)
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("严格程度")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        Picker("", selection: $strictness) {
                            ForEach(MockStrictness.allCases, id: \.self) { s in
                                Text(s.displayName).tag(s)
                            }
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                    }
                }

                if isLoading {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text(progressText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding()
        }
    }

    private var progressText: String {
        if results.isEmpty {
            return "正在生成第 1 / \(reviewerCount) 位审稿人意见…"
        }
        return "已完成 \(results.count) / \(reviewerCount) 位审稿人，继续生成中…"
    }

    // MARK: - Results

    private var resultsBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let dominant {
                    dominantBar(dominant: dominant)
                }
                ForEach(results) { result in
                    reviewerCard(result)
                }
                if isLoading {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text(progressText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 4)
                }
                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding()
        }
    }

    private func dominantBar(dominant: MockReviewVerdict) -> some View {
        let summary = MockReviewVerdict.allCases
            .compactMap { v -> String? in
                guard let count = verdictCounts[v], count > 0 else { return nil }
                return "\(v.displayName) ×\(count)"
            }
            .joined(separator: " · ")

        return HStack(spacing: 10) {
            Text("综合倾向：\(dominant.displayName)")
                .font(.subheadline.bold())
                .foregroundStyle(dominant.color)
            Text("\(results.count) 位审稿人 · \(summary)")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(dominant.color.opacity(0.12))
        .cornerRadius(Theme.Radii.medium)
    }

    private func reviewerCard(_ r: MockReviewerResult) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(r.reviewer)
                    .font(.subheadline.bold())
                ForEach(r.tags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.10))
                        .foregroundStyle(.blue)
                        .cornerRadius(4)
                }
                if let score = r.score {
                    Text("\(score)/10")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(r.verdict.displayName)
                    .font(.caption.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(r.verdict.color.opacity(0.15))
                    .foregroundStyle(r.verdict.color)
                    .cornerRadius(4)
            }

            Text(r.renderedMarkdown.isEmpty ? "（无内容）" : r.renderedMarkdown)
                .font(.body)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    // MARK: - Footer

    private var footer: some View {
        HStack {
            if hasResults {
                Button("重新生成", action: resetResults)
                    .disabled(isLoading)
                Spacer()
                Text("共 \(results.count) / \(reviewerCount) 位审稿人")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Button(action: importResults) {
                    Label("导入审稿归档", systemImage: "square.and.arrow.down")
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading || results.count < reviewerCount)
            } else {
                Text("生成结果仅供参考，不代表真实审稿意见")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button(action: startReview) {
                    if isLoading {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.mini)
                            Text("生成中…")
                        }
                    } else {
                        Label("生成模拟审稿", systemImage: "sparkles")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
            }
        }
        .padding()
    }

    // MARK: - Actions

    private func resetResults() {
        results = []
        errorMessage = nil
    }

    private func startReview() {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        results = []
        errorMessage = nil
        isLoading = true

        let stream = service.runMockReview(
            content: trimmed,
            reviewerCount: reviewerCount,
            strictness: strictness,
            settings: settings
        )

        Task {
            do {
                for try await r in stream {
                    results.append(r)
                }
            } catch let err as LLMError {
                errorMessage = err.errorDescription ?? "审稿失败"
            } catch {
                errorMessage = "审稿失败：\(error.localizedDescription)"
            }
            isLoading = false
        }
    }

    private func importResults() {
        guard !results.isEmpty else { return }
        let round = service.importMockReviewAsRound(
            submissionId: submissionId,
            results: results
        )
        onImported(round)
        dismiss()
    }
}

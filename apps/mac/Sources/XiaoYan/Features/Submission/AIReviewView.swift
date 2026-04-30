import SwiftUI

struct AIReviewView: View {
    let service: SubmissionService
    @EnvironmentObject var settings: AppSettings
    @State private var content = ""
    @State private var reviewResult = ""
    @State private var isReviewing = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("论文内容")
                        .font(.headline)
                    TextEditor(text: $content)
                        .font(.body)
                        .padding(4)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                }

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("AI 审稿意见")
                            .font(.headline)
                        Spacer()
                        if !reviewResult.isEmpty {
                            Button("复制") {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(reviewResult, forType: .string)
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }
                    }

                    ScrollView {
                        Text(reviewResult.isEmpty ? "粘贴论文内容后点击「开始审稿」" : reviewResult)
                            .font(.body)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                    }
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(8)
                }
            }
            .padding()

            HStack {
                Spacer()
                Button(action: startReview) {
                    if isReviewing {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.mini)
                            Text("审稿中...")
                        }
                    } else {
                        Text("开始审稿")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(content.trimmingCharacters(in: .whitespaces).isEmpty || isReviewing)
            }
            .padding(.horizontal)
            .padding(.bottom)
        }
    }

    private func startReview() {
        guard !content.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isReviewing = true
        reviewResult = ""

        Task {
            let stream = service.runAIReview(submissionId: "", content: content, settings: settings)
            do {
                for try await chunk in stream {
                    reviewResult += chunk
                }
            } catch {
                if reviewResult.isEmpty {
                    reviewResult = "审稿失败: \(error.localizedDescription)"
                }
            }
            isReviewing = false
        }
    }
}

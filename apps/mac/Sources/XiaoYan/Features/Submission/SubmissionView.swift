import SwiftUI

struct SubmissionView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "paperplane.fill")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("投稿管理")
                .font(.title)
            Text("跟踪投稿进度、AI 审稿与版本管理")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle("投稿")
    }
}

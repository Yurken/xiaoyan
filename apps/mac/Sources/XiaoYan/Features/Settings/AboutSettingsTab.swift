import SwiftUI

struct AboutSettingsTab: View {
    @State private var updateState: UpdateCheckState = .idle
    @State private var latestVersion: String?
    @State private var downloadURL: String?
    @State private var releaseNotes: String?
    @State private var updateError: String?

    enum UpdateCheckState {
        case idle
        case checking
        case noUpdate
        case hasUpdate
        case failed
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "应用信息", icon: "info.circle") {
                HStack(spacing: 16) {
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 48))
                        .foregroundStyle(.blue)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("小妍")
                            .font(.title2.bold())
                        Text("科研智能助手")
                            .foregroundStyle(.secondary)
                        Text("版本 \(UpdatesService.currentVersion)")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            settingsCard(title: "更新", icon: "arrow.up.circle") {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("当前版本")
                        Spacer()
                        Text(UpdatesService.currentVersion)
                            .foregroundStyle(.secondary)
                    }

                    updateStatusRow

                    if updateState == .hasUpdate {
                        if let notes = releaseNotes, !notes.isEmpty {
                            Text(notes)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(4)
                        }

                        if let url = downloadURL, !url.isEmpty {
                            Button("下载更新") {
                                UpdatesService.openDownloadURL(url)
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)
                        } else {
                            Text("未找到适用于当前平台的下载链接")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }

                    if updateState == .failed {
                        Text(updateError ?? "检查失败，请检查网络或稍后重试。")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
            }

            settingsCard(title: "致谢", icon: "heart") {
                Text("感谢所有贡献者与开源社区的支持。")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var updateStatusRow: some View {
        HStack(spacing: 8) {
            updateStatusIcon
            Text(updateStatusText)
                .font(.caption)
                .foregroundStyle(updateStatusColor)
            Spacer()
            Button(action: checkForUpdates) {
                if updateState == .checking {
                    HStack(spacing: 4) {
                        ProgressView().controlSize(.small)
                        Text("检查中...")
                    }
                } else {
                    Text("检查更新")
                }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(updateState == .checking)
        }
    }

    @ViewBuilder
    private var updateStatusIcon: some View {
        switch updateState {
        case .idle, .noUpdate:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
        case .checking:
            Image(systemName: "arrow.clockwise.circle.fill")
                .foregroundStyle(.secondary)
        case .hasUpdate:
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(.orange)
        case .failed:
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(.red)
        }
    }

    private var updateStatusText: String {
        switch updateState {
        case .idle: return "尚未检查"
        case .checking: return "正在检查..."
        case .noUpdate: return "已是最新版本"
        case .hasUpdate:
            if let v = latestVersion {
                return "发现新版本 \(v)"
            }
            return "发现新版本"
        case .failed: return "检查失败"
        }
    }

    private var updateStatusColor: Color {
        switch updateState {
        case .idle, .noUpdate: return .green
        case .checking: return .secondary
        case .hasUpdate: return .orange
        case .failed: return .red
        }
    }

    private func checkForUpdates() {
        updateState = .checking
        updateError = nil
        Task {
            let result = await UpdatesService.checkForUpdates()
            await MainActor.run {
                switch result {
                case .success(.noUpdate):
                    updateState = .noUpdate
                case .success(.hasUpdate(let info)):
                    latestVersion = info.version
                    downloadURL = info.url
                    releaseNotes = info.releaseNotes
                    updateState = .hasUpdate
                case .failure(let error):
                    updateState = .failed
                    updateError = error.localizedDescription
                }
            }
        }
    }
}

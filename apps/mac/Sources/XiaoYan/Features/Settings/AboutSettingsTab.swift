import SwiftUI

struct AboutSettingsTab: View {
    @State private var updateState: UpdateCheckState = .idle
    @State private var downloadState: DownloadState = .idle
    @State private var latestVersion: String?
    @State private var downloadURL: String?
    @State private var releaseNotes: String?
    @State private var pubDate: String?
    @State private var updateError: String?

    enum UpdateCheckState {
        case idle
        case checking
        case noUpdate
        case hasUpdate
        case failed
    }

    enum DownloadState: Equatable {
        case idle
        case downloading
        case downloaded
        case failed(String)
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

            settingsCard(title: "桌面端升级", icon: "arrow.up.circle") {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 12) {
                        versionInfoBox(title: "当前版本", value: UpdatesService.currentVersion)
                        if let latest = latestVersion {
                            versionInfoBox(title: "最新版本", value: latest)
                        }
                        if let date = pubDate {
                            versionInfoBox(title: "发布日期", value: formatDate(date))
                        }
                    }

                    updateStatusRow

                    if updateState == .hasUpdate {
                        if let notes = releaseNotes, !notes.isEmpty {
                            Text(notes)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(4)
                        }

                        HStack(spacing: 8) {
                            if let url = downloadURL, !url.isEmpty {
                                if case .downloading = downloadState {
                                    HStack(spacing: 4) {
                                        ProgressView().controlSize(.small)
                                        Text("下载中…")
                                            .font(.caption)
                                    }
                                } else {
                                    Button("下载并安装") {
                                        startDownload(url: url)
                                    }
                                    .buttonStyle(.borderedProminent)
                                    .controlSize(.small)
                                    .disabled(downloadState != .idle)
                                }

                                Button("打开下载链接") {
                                    UpdatesService.openDownloadURL(url)
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            } else {
                                Text("未找到适用于当前平台的下载链接")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }
                        }

                        if case .failed(let error) = downloadState {
                            Text(error)
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

            settingsCard(title: "说明", icon: "doc.text") {
                VStack(alignment: .leading, spacing: 10) {
                    ruleItem(text: "设置项会自动保存到本地数据库，无需手动点击「保存」。")
                    ruleItem(text: "加密导出使用 AES-256-GCM，密码遗失后无法恢复。")
                    ruleItem(text: "配置快照仅保存在本机，换设备后需重新导入。")
                    ruleItem(text: "更新检查连接的是项目官方发布服务器。")
                }
            }
        }
    }

    private func versionInfoBox(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption.bold())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
    }

    private func ruleItem(text: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "checkmark.circle.fill")
                .font(.caption2)
                .foregroundStyle(.green)
            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
        }
    }

    private func formatDate(_ isoDate: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: isoDate) {
            let out = DateFormatter()
            out.locale = Locale(identifier: "zh_CN")
            out.dateStyle = .medium
            return out.string(from: date)
        }
        return isoDate
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
                        Text("检查中…")
                    }
                } else {
                    Text("检查更新")
                }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(updateState == .checking || downloadState == .downloading)
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
        case .checking: return "正在检查…"
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
                    pubDate = info.pubDate
                    updateState = .hasUpdate
                case .failure(let error):
                    updateState = .failed
                    updateError = error.localizedDescription
                }
            }
        }
    }

    private func startDownload(url: String) {
        downloadState = .downloading
        Task {
            let result = await UpdatesService.downloadAndInstall(url: url)
            await MainActor.run {
                switch result {
                case .success:
                    downloadState = .downloaded
                case .failure(let error):
                    downloadState = .failed(error.localizedDescription)
                }
            }
        }
    }
}

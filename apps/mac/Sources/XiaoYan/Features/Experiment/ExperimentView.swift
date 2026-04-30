import SwiftUI

struct ExperimentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "flask.fill")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("实验记录")
                .font(.title)
            Text("跟踪和管理实验配置与结果")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle("实验")
    }
}

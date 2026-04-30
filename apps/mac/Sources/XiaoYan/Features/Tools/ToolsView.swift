import SwiftUI

struct ToolsView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "wrench.and.screwdriver.fill")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("工具箱")
                .font(.title)
            Text("arXiv 搜索、期刊查询、学术翻译等")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle("工具")
    }
}

import SwiftUI

struct PlannerView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "map.fill")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("研究规划")
                .font(.title)
            Text("规划研究方向和学习路径")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle("规划")
    }
}

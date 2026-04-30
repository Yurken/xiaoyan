import SwiftUI

struct SurveyView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "books.vertical.fill")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("文献综述")
                .font(.title)
            Text("AI 驱动的结构化文献综述")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle("综述")
    }
}

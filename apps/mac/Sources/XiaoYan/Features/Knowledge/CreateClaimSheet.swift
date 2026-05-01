import SwiftUI

struct CreateClaimSheet: View {
    var defaultInterestId: String? = nil
    var onCreated: (KnowledgeClaim) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var statement = ""
    @State private var status: KnowledgeClaimStatus = .hypothesis
    @State private var selectedInterestId: String?
    @State private var interests: [ResearchInterest] = []

    private let repo = KnowledgeRepository()

    var body: some View {
        VStack(spacing: 16) {
            Text("新建研究论断")
                .font(.headline)

            Form {
                TextField("标题", text: $title)
                TextField("论断陈述", text: $statement, axis: .vertical)
                    .lineLimit(3...8)
                Picker("状态", selection: $status) {
                    ForEach(KnowledgeClaimStatus.allCases, id: \.self) { value in
                        Text(value.displayName).tag(value)
                    }
                }
                Picker("研究方向", selection: $selectedInterestId) {
                    Text("无").tag(String?.none)
                    ForEach(interests) { interest in
                        Text(interest.topic).tag(Optional(interest.id))
                    }
                }
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("创建") {
                    submit()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(canSubmit == false)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 480, height: 420)
        .onAppear {
            interests = (try? repo.listInterests()) ?? []
            if selectedInterestId == nil, let preset = defaultInterestId {
                selectedInterestId = preset
            }
        }
    }

    private var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !statement.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func submit() {
        let claim = KnowledgeClaim(
            id: UUID().uuidString,
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            statement: statement.trimmingCharacters(in: .whitespacesAndNewlines),
            researchInterestId: selectedInterestId,
            status: status.rawValue,
            createdAt: Date()
        )
        try? repo.insertClaim(claim)
        onCreated(claim)
        dismiss()
    }
}

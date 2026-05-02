import SwiftUI

struct ScopedNotesView: View {
    let interestId: String
    let interest: ResearchInterest?
    let notes: [KnowledgeNote]
    let knowledgeService: KnowledgeService
    let settings: AppSettings
    let onUpdate: () -> Void

    @State private var searchText = ""
    @State private var showingCreate = false
    @State private var selectedNote: KnowledgeNote?

    var filteredNotes: [KnowledgeNote] {
        let scoped = notes.filter { $0.researchInterestId == interestId }
        if searchText.isEmpty { return scoped }
        let q = searchText.lowercased()
        return scoped.filter {
            $0.title.lowercased().contains(q) ||
            $0.content.lowercased().contains(q) ||
            ($0.tags?.contains(where: { $0.lowercased().contains(q) }) ?? false)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("搜索笔记...", text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(8)
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
                .nmShadow(level: Theme.Shadows.soft)

                Spacer()

                Button(action: { showingCreate = true }) {
                    Label("新建", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
            .padding()

            if filteredNotes.isEmpty {
                emptyState
            } else {
                List(filteredNotes) { note in
                    Button(action: { selectedNote = note }) {
                        NoteRow(note: note)
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.plain)
            }
        }
        .sheet(isPresented: $showingCreate) {
            CreateNoteSheet(
                knowledgeService: knowledgeService,
                settings: settings,
                interests: interest.map { [$0] } ?? [],
                preselectedInterestId: interestId,
                onCreated: onUpdate
            )
        }
        .sheet(item: $selectedNote) { note in
            NoteDetailView(
                note: note,
                interests: interest.map { [$0] } ?? [],
                knowledgeService: knowledgeService,
                onUpdate: onUpdate
            )
            .frame(minWidth: 500, minHeight: 400)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "note.text")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text("还没有笔记")
                .font(.subheadline.bold())
            Text("创建笔记来记录与该研究方向相关的心得。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }
}

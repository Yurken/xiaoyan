import SwiftUI

struct VenuesListView: View {
    let service: SubmissionService
    @State private var venues: [Venue] = []
    @State private var searchText = ""
    @State private var showingCreate = false

    var filteredVenues: [Venue] {
        if searchText.isEmpty { return venues }
        let q = searchText.lowercased()
        return venues.filter { $0.name.lowercased().contains(q) || ($0.fullName?.lowercased().contains(q) ?? false) }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("搜索期刊/会议...", text: $searchText)
                    .textFieldStyle(.roundedBorder)
                Spacer()
                Button("新建") { showingCreate = true }
                    .controlSize(.small)
            }
            .padding(.horizontal)

            List(filteredVenues) { venue in
                VenueRow(venue: venue, service: service, onReload: reload)
            }
            .listStyle(.plain)
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingCreate) {
            CreateVenueSheet(service: service, onCreated: reload)
        }
    }

    private func reload() {
        venues = service.listVenues()
    }
}

private struct VenueRow: View {
    let venue: Venue
    let service: SubmissionService
    let onReload: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(venue.name)
                        .font(.subheadline.bold())
                    if venue.starred == true {
                        Image(systemName: "star.fill")
                            .foregroundStyle(.yellow)
                            .font(.caption2)
                    }
                }
                if let fullName = venue.fullName {
                    Text(fullName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            HStack(spacing: 6) {
                if let ccf = venue.ccfRating {
                    Text("CCF \(ccf)")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(ccfColor(ccf).opacity(0.15))
                        .foregroundColor(ccfColor(ccf))
                        .cornerRadius(4)
                }
                if let quartile = venue.sciQuartile {
                    Text(quartile)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(4)
                }
                if !venue.type.isEmpty {
                    Text(venue.type)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Menu {
                Button(venue.starred == true ? "取消收藏" : "收藏") {
                    service.toggleVenueStar(id: venue.id)
                    onReload()
                }
                Button("删除", role: .destructive) {
                    service.deleteVenue(id: venue.id)
                    onReload()
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundStyle(.secondary)
            }
            .menuStyle(.borderlessButton)
        }
        .padding(.vertical, 2)
    }

    private func ccfColor(_ rating: String) -> Color {
        switch rating.uppercased() {
        case "A": return .red
        case "B": return .orange
        case "C": return .blue
        default: return .gray
        }
    }
}

private struct CreateVenueSheet: View {
    let service: SubmissionService
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var fullName = ""
    @State private var type = "conference"
    @State private var ccfRating = ""
    @State private var area = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("新建期刊/会议")
                .font(.headline)

            Form {
                TextField("名称（缩写）", text: $name)
                TextField("全称", text: $fullName)
                Picker("类型", selection: $type) {
                    Text("会议").tag("conference")
                    Text("期刊").tag("journal")
                }
                TextField("CCF 等级 (A/B/C)", text: $ccfRating)
                TextField("领域", text: $area)
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("创建") {
                    let venue = Venue(
                        id: UUID().uuidString,
                        type: type,
                        name: name,
                        fullName: fullName.isEmpty ? nil : fullName,
                        website: nil,
                        ccfRating: ccfRating.isEmpty ? nil : ccfRating.uppercased(),
                        area: area.isEmpty ? nil : area,
                        starred: false,
                        ei: nil, sci: nil, sciQuartile: nil,
                        deadline: nil, notificationDate: nil,
                        specialIssueTitle: nil, specialIssueDeadline: nil, specialIssueDescription: nil,
                        createdAt: Date()
                    )
                    service.createVenue(venue)
                    onCreated()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 420, height: 360)
    }
}

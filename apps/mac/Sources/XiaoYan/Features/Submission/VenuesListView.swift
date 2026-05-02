import SwiftUI

struct VenuesListView: View {
    let service: SubmissionService
    @State private var venues: [Venue] = []
    @State private var searchText = ""
    @State private var showingCreate = false
    @State private var sortByDeadline = false

    var filteredVenues: [Venue] {
        var list = venues
        if !searchText.isEmpty {
            let q = searchText.lowercased()
            list = list.filter { $0.name.lowercased().contains(q) || ($0.fullName?.lowercased().contains(q) ?? false) }
        }
        if sortByDeadline {
            list.sort {
                let d0 = $0.deadline ?? Date.distantFuture
                let d1 = $1.deadline ?? Date.distantFuture
                return d0 < d1
            }
        }
        return list
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("搜索期刊/会议...", text: $searchText)
                    .textFieldStyle(.roundedBorder)
                Button {
                    sortByDeadline.toggle()
                } label: {
                    Image(systemName: sortByDeadline ? "calendar.badge.clock" : "textformat.abc")
                        .foregroundStyle(sortByDeadline ? Color.accentColor : .secondary)
                }
                .buttonStyle(.plain)
                .help(sortByDeadline ? "按截止日排序" : "按名称排序")
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

    private var countdownText: String? {
        guard let deadline = venue.deadline else { return nil }
        let days = Calendar.current.dateComponents([.day], from: Date(), to: deadline).day ?? 0
        if days < 0 { return "已截止" }
        if days == 0 { return "今天截止" }
        return "剩余 \(days) 天"
    }

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
                    if let countdown = countdownText {
                        Text(countdown)
                            .font(.caption2.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(countdownColor.opacity(0.15))
                            .foregroundColor(countdownColor)
                            .cornerRadius(4)
                    }
                }
                if let fullName = venue.fullName {
                    Text(fullName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                HStack(spacing: 6) {
                    if let deadline = venue.deadline {
                        Label(deadline.formatted(date: .abbreviated, time: .omitted), systemImage: "calendar.badge.clock")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    if let notif = venue.notificationDate {
                        Label(notif.formatted(date: .abbreviated, time: .omitted), systemImage: "bell")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    if let special = venue.specialIssueTitle, !special.isEmpty {
                        Label(special, systemImage: "tag")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }
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

    private var countdownColor: Color {
        guard let deadline = venue.deadline else { return .gray }
        let days = Calendar.current.dateComponents([.day], from: Date(), to: deadline).day ?? 0
        if days < 0 { return .gray }
        if days <= 7 { return .red }
        if days <= 30 { return .orange }
        return .green
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
    @State private var deadline: Date?
    @State private var notificationDate: Date?
    @State private var specialIssueTitle = ""
    @State private var specialIssueDeadline: Date?

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

                DatePicker("投稿截止", selection: Binding(
                    get: { deadline ?? Date() },
                    set: { deadline = $0 }
                ), displayedComponents: .date)
                .onAppear {
                    if deadline == nil { deadline = nil }
                }

                DatePicker("通知日期", selection: Binding(
                    get: { notificationDate ?? Date() },
                    set: { notificationDate = $0 }
                ), displayedComponents: .date)

                TextField("特刊标题", text: $specialIssueTitle)
                DatePicker("特刊截止", selection: Binding(
                    get: { specialIssueDeadline ?? Date() },
                    set: { specialIssueDeadline = $0 }
                ), displayedComponents: .date)
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
                        deadline: deadline,
                        notificationDate: notificationDate,
                        specialIssueTitle: specialIssueTitle.isEmpty ? nil : specialIssueTitle,
                        specialIssueDeadline: specialIssueDeadline,
                        specialIssueDescription: nil,
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
        .frame(width: 420, height: 520)
    }
}

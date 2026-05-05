import SwiftUI

struct VenuesListView: View {
    let service: SubmissionService
    @State private var venues: [Venue] = []
    @State private var searchText = ""
    @State private var showingCreate = false
    @State private var showingTemplateBrowser = false
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
                Button("从模板添加") { showingTemplateBrowser = true }
                    .controlSize(.small)
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
        .sheet(isPresented: $showingTemplateBrowser) {
            AddVenueTemplateSheet(service: service, onCreated: reload)
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

private struct AddVenueTemplateSheet: View {
    let service: SubmissionService
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @State private var areaFilter = "全部"
    @State private var typeFilter: VenueTypeFilter = .all
    @State private var templates: [VenueTemplate] = []
    @State private var trackedNames: Set<String> = []

    enum VenueTypeFilter: String, CaseIterable {
        case all = "全部"
        case conference = "会议"
        case journal = "期刊"
    }

    private var areas: [String] {
        var list = ["全部"]
        list.append(contentsOf: VenueTemplateLoader.allAreas(from: templates))
        return list
    }

    private var filteredTemplates: [VenueTemplate] {
        var list = templates
        if !searchText.isEmpty {
            let q = searchText.lowercased()
            list = list.filter { $0.name.lowercased().contains(q) || $0.fullName.lowercased().contains(q) }
        }
        if areaFilter != "全部" {
            list = list.filter { $0.area == areaFilter }
        }
        if typeFilter != .all {
            list = list.filter { $0.type == (typeFilter == .conference ? "conference" : "journal") }
        }
        return list
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("添加会议/期刊")
                        .font(.headline)
                    Text("从 CCF 推荐目录中选择要追踪的会议或期刊")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()

            HStack(spacing: 8) {
                HStack(spacing: 4) {
                    Image(systemName: "magnifyingglass")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("搜索会议或期刊…", text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(8)
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
                .nmShadow(level: Theme.Shadows.soft)

                Picker("领域", selection: $areaFilter) {
                    ForEach(areas, id: \.self) { area in
                        Text(area).tag(area)
                    }
                }
                .pickerStyle(.menu)
                .controlSize(.small)
                .frame(width: 140)

                HStack(spacing: 0) {
                    ForEach(VenueTypeFilter.allCases, id: \.self) { filter in
                        Button(filter.rawValue) {
                            typeFilter = filter
                        }
                        .buttonStyle(.plain)
                        .font(.caption.weight(typeFilter == filter ? .semibold : .regular))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(typeFilter == filter ? Color.accentColor : Color.clear)
                        .foregroundStyle(typeFilter == filter ? Color.white : Color.primary)
                        .cornerRadius(6)
                    }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                )
                .cornerRadius(6)
            }
            .padding(.horizontal)

            if filteredTemplates.isEmpty {
                ContentUnavailableView("未找到匹配的会议或期刊", systemImage: "magnifyingglass")
                    .frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 12)], spacing: 12) {
                        ForEach(filteredTemplates) { venue in
                            VenueTemplateCard(venue: venue, isAdded: trackedNames.contains(venue.name)) {
                                addVenue(venue)
                            }
                        }
                    }
                    .padding()
                }
            }

            Divider()
            HStack {
                Text("共 \(filteredTemplates.count) 个结果，已追踪 \(trackedNames.count) 个")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("完成") { dismiss() }
                    .controlSize(.small)
            }
            .padding()
        }
        .frame(minWidth: 640, minHeight: 480)
        .onAppear {
            templates = VenueTemplateLoader.load()
            trackedNames = Set(service.listVenues().map(\.name))
        }
    }

    private func addVenue(_ template: VenueTemplate) {
        let venue = Venue(
            id: UUID().uuidString,
            type: template.type,
            name: template.name,
            fullName: template.fullName.isEmpty ? nil : template.fullName,
            website: template.website,
            ccfRating: template.ccf.isEmpty ? nil : template.ccf,
            area: template.area.isEmpty ? nil : template.area,
            starred: false,
            ei: template.ei,
            sci: template.sci,
            sciQuartile: template.sciQuartile,
            deadline: nil,
            notificationDate: nil,
            specialIssueTitle: nil,
            specialIssueDeadline: nil,
            specialIssueDescription: nil,
            createdAt: Date()
        )
        service.createVenue(venue)
        trackedNames.insert(template.name)
        onCreated()
    }
}

private struct VenueTemplateCard: View {
    let venue: VenueTemplate
    let isAdded: Bool
    let onAdd: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    if let website = venue.website, let url = URL(string: website) {
                        Link(venue.name, destination: url)
                            .font(.subheadline.bold())
                            .lineLimit(1)
                    } else {
                        Text(venue.name)
                            .font(.subheadline.bold())
                            .lineLimit(1)
                    }
                    Text(venue.fullName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Button {
                    if !isAdded { onAdd() }
                } label: {
                    Image(systemName: isAdded ? "checkmark" : "plus")
                        .font(.caption.bold())
                        .foregroundStyle(isAdded ? .green : .white)
                        .frame(width: 28, height: 28)
                        .background(isAdded ? Color.green.opacity(0.15) : Color.accentColor)
                        .cornerRadius(8)
                }
                .buttonStyle(.plain)
                .disabled(isAdded)
            }

            HStack(spacing: 4) {
                Text("CCF \(venue.ccf)")
                    .font(.caption2.bold())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(ccfColor(venue.ccf).opacity(0.15))
                    .foregroundColor(ccfColor(venue.ccf))
                    .cornerRadius(4)

                Text(venue.type == "conference" ? "会议" : "期刊")
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(venue.type == "conference" ? Color.blue.opacity(0.1) : Color.purple.opacity(0.1))
                    .foregroundStyle(venue.type == "conference" ? Color.blue : Color.purple)
                    .cornerRadius(4)

                if let q = venue.sciQuartile {
                    Text(q)
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.12))
                        .foregroundColor(.green)
                        .cornerRadius(4)
                }
                if venue.ei == true {
                    Text("EI")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.indigo.opacity(0.12))
                        .foregroundColor(.indigo)
                        .cornerRadius(4)
                }
                Spacer()
                Text(venue.area)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(isAdded ? Color.green.opacity(0.05) : Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
        .opacity(isAdded ? 0.7 : 1)
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

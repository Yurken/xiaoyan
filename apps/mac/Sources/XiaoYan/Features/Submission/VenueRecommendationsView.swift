import SwiftUI

struct VenueRecommendationsView: View {
    let service: SubmissionService
    @EnvironmentObject var settings: AppSettings
    @State private var direction = ""
    @State private var keywords = ""
    @State private var extra = ""
    @State private var isGenerating = false
    @State private var recommendations: [VenueRecommendation] = []
    @State private var errorMessage: String?
    @State private var expanded = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerSection
                inputSection
                if let error = errorMessage {
                    errorView(error)
                }
                if !recommendations.isEmpty {
                    recommendationsSection
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var headerSection: some View {
        HStack(spacing: 12) {
            Image(systemName: "sparkles")
                .font(.title2)
                .foregroundStyle(.purple)
            VStack(alignment: .leading, spacing: 2) {
                Text("智能推荐刊会")
                    .font(.title2.bold())
                Text("根据研究方向与投稿历史自动匹配适合的期刊和会议")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var inputSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("研究方向 / 论文主题", text: $direction, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...4)

            HStack(spacing: 8) {
                TextField("关键词", text: $keywords)
                    .textFieldStyle(.roundedBorder)
                TextField("补充说明（如：偏理论 / 工程落地 / 希望 CCF A 类）", text: $extra)
                    .textFieldStyle(.roundedBorder)
            }

            HStack {
                Spacer()
                Button(action: generate) {
                    if isGenerating {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.small)
                            Text("分析中...")
                        }
                    } else {
                        HStack(spacing: 6) {
                            Image(systemName: "sparkles")
                            Text("生成推荐")
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)
                .disabled(direction.trimmingCharacters(in: .whitespaces).isEmpty || isGenerating)
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
    }

    private var recommendationsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("推荐结果")
                .font(.headline)

            ForEach(recommendations) { rec in
                RecommendationCard(rec: rec, service: service)
            }
        }
    }

    private func errorView(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(.red)
            Text(message)
                .font(.caption)
            Spacer()
        }
        .padding(10)
        .background(Color.red.opacity(0.08))
        .cornerRadius(8)
    }

    private func generate() {
        guard !direction.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isGenerating = true
        errorMessage = nil
        recommendations = []

        Task {
            let client = LLMClient.fromSettings(
                settings,
                modelKeys: ["copilot_simple_model"],
                temperatureKeys: ["copilot_simple_temperature"]
            )

            guard let client else {
                errorMessage = "请先在设置中配置 LLM 提供商。"
                isGenerating = false
                return
            }

            let prompt = """
            你是一位学术投稿顾问。请根据用户的研究方向，推荐 3-6 个最适合投稿的期刊或会议。
            返回严格的 JSON 数组格式：
            [
                {
                    "name": "刊会缩写",
                    "full_name": "全称",
                    "type": "conference 或 journal",
                    "ccf": "A/B/C/none",
                    "sci": true/false,
                    "sci_quartile": "Q1/Q2/Q3/Q4 或空",
                    "ei": true/false,
                    "match_score": 85,
                    "reason": "推荐理由",
                    "match_tags": ["标签1", "标签2"]
                }
            ]

            研究方向：\(direction)
            关键词：\(keywords)
            补充说明：\(extra)
            """

            do {
                let response = try await client.chat(
                    messages: [LLMClient.Message(role: "user", content: direction)],
                    systemPrompt: prompt
                )
                let parsed = parseRecommendations(response)
                recommendations = parsed
            } catch {
                errorMessage = "生成失败: \(error.localizedDescription)"
            }
            isGenerating = false
        }
    }

    private func parseRecommendations(_ text: String) -> [VenueRecommendation] {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = clean.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        return array.compactMap { dict in
            guard let name = dict["name"] as? String else { return nil }
            return VenueRecommendation(
                id: UUID().uuidString,
                name: name,
                fullName: dict["full_name"] as? String,
                type: dict["type"] as? String ?? "conference",
                ccf: dict["ccf"] as? String ?? "none",
                sci: dict["sci"] as? Bool ?? false,
                sciQuartile: dict["sci_quartile"] as? String,
                ei: dict["ei"] as? Bool ?? false,
                matchScore: dict["match_score"] as? Int ?? 50,
                reason: dict["reason"] as? String ?? "",
                matchTags: dict["match_tags"] as? [String] ?? []
            )
        }
    }
}

// MARK: - Recommendation Card

private struct RecommendationCard: View {
    let rec: VenueRecommendation
    let service: SubmissionService
    @State private var isAdded = false

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Score
            VStack(spacing: 2) {
                Text("\(rec.matchScore)")
                    .font(.title3.bold())
                    .foregroundStyle(scoreColor)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.secondary.opacity(0.2))
                            .frame(height: 3)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(scoreColor)
                            .frame(width: geo.size.width * CGFloat(rec.matchScore) / 100, height: 3)
                    }
                }
                .frame(width: 36, height: 3)
                Text("匹配度")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(width: 44)

            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(rec.name)
                        .font(.subheadline.bold())
                    if rec.ccf != "none" {
                        BadgeView(text: "CCF \(rec.ccf)", color: ccfColor(rec.ccf))
                    }
                    if rec.sci {
                        BadgeView(text: "SCI", color: .green)
                    }
                    if let q = rec.sciQuartile {
                        BadgeView(text: q, color: .indigo)
                    }
                    if rec.ei {
                        BadgeView(text: "EI", color: .blue)
                    }
                    BadgeView(text: rec.type == "conference" ? "会议" : "期刊", color: .secondary)
                }

                if let full = rec.fullName {
                    Text(full)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Text(rec.reason)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if !rec.matchTags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(rec.matchTags.prefix(4), id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.purple.opacity(0.1))
                                .foregroundStyle(.purple)
                                .cornerRadius(4)
                        }
                    }
                }
            }

            Spacer()

            Button(isAdded ? "已追踪" : "+ 追踪") {
                addVenue()
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(isAdded)
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
    }

    private var scoreColor: Color {
        if rec.matchScore >= 80 { return .green }
        if rec.matchScore >= 55 { return .blue }
        return .orange
    }

    private func ccfColor(_ rating: String) -> Color {
        switch rating.uppercased() {
        case "A": return .red
        case "B": return .orange
        case "C": return .blue
        default: return .gray
        }
    }

    private func addVenue() {
        let venue = Venue(
            id: UUID().uuidString,
            type: rec.type,
            name: rec.name,
            fullName: rec.fullName,
            website: nil,
            ccfRating: rec.ccf == "none" ? nil : rec.ccf.uppercased(),
            area: nil,
            starred: false,
            ei: rec.ei,
            sci: rec.sci,
            sciQuartile: rec.sciQuartile,
            deadline: nil,
            notificationDate: nil,
            specialIssueTitle: nil,
            specialIssueDeadline: nil,
            specialIssueDescription: nil,
            createdAt: Date()
        )
        service.createVenue(venue)
        isAdded = true
    }
}

// MARK: - Models

struct VenueRecommendation: Identifiable {
    let id: String
    var name: String
    var fullName: String?
    var type: String
    var ccf: String
    var sci: Bool
    var sciQuartile: String?
    var ei: Bool
    var matchScore: Int
    var reason: String
    var matchTags: [String]
}

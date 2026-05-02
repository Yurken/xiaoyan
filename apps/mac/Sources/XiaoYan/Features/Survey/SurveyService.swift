import Foundation

// MARK: - Data Models (14-item schema)

struct StructuredSurveyReport: Codable {
    var background: String?
    var developmentTimeline: [SurveyTimelineStage]?
    var earliestPeriod: String?
    var currentFrontier: String?
    var majorMethods: [SurveyMethodEx]?
    var schoolsOfThought: [SurveySchool]?
    var methodologySummary: SurveyMethodologySummary?
    var researchTrends: [SurveyTrendEx]?
    var controversies: [SurveyControversy]?
    var challenges: [String]?
    var researchGaps: [String]?
    var futureDirections: [String]?
    var recommendedTopics: [SurveyRecommendedTopic]?
    var overallSummary: String?

    enum CodingKeys: String, CodingKey {
        case background
        case developmentTimeline = "development_timeline"
        case earliestPeriod = "earliest_period"
        case currentFrontier = "current_frontier"
        case majorMethods = "major_methods"
        case schoolsOfThought = "schools_of_thought"
        case methodologySummary = "methodology_summary"
        case researchTrends = "research_trends"
        case controversies
        case challenges
        case researchGaps = "research_gaps"
        case futureDirections = "future_directions"
        case recommendedTopics = "recommended_topics"
        case overallSummary = "overall_summary"
    }
}

struct SurveyTimelineStage: Codable {
    var period: String?
    var milestone: String?
    var keyWorks: [String]?
    var significance: String?

    enum CodingKeys: String, CodingKey {
        case period, milestone
        case keyWorks = "key_works"
        case significance
    }
}

struct SurveyMethodEx: Codable {
    var name: String?
    var description: String?
    var representativePapers: [String]?
    var pros: String?
    var cons: String?

    enum CodingKeys: String, CodingKey {
        case name, description
        case representativePapers = "representative_papers"
        case pros, cons
    }
}

struct SurveySchool: Codable {
    var name: String?
    var description: String?
    var representatives: [String]?
}

struct SurveyMethodologySummary: Codable {
    var mainstream: String?
    var emerging: String?
    var comparison: String?
}

struct SurveyTrendEx: Codable {
    var trend: String?
    var signal: String?
}

struct SurveyControversy: Codable {
    var topic: String?
    var positions: [String]?
}

struct SurveyRecommendedTopic: Codable {
    var topic: String?
    var why: String?
    var firstStep: String?

    enum CodingKeys: String, CodingKey {
        case topic, why
        case firstStep = "first_step"
    }
}

struct SurveyPaperEx: Codable, Identifiable {
    let id: String
    var title: String
    var authors: String?
    var abstract: String?
    var year: Int?
    var venue: String?
    var doi: String?
    var paperUrl: String?
}

struct SurveyMeta: Codable {
    var timeRange: String?
    var litTypes: String?
    var databases: String?
    var language: String?
}

struct StructuredSurveyResult: Codable {
    let query: String
    var report: StructuredSurveyReport
    var papers: [SurveyPaperEx]
    var formattedCitations: [String]?
    var citationFormat: String?
    var meta: SurveyMeta?
}

// MARK: - Agent State

enum SurveyAgentStatus: String, Codable {
    case pending, running, done, failed
}

struct SurveyAgentState: Codable, Identifiable {
    let id: String
    let name: String
    let role: String
    var status: SurveyAgentStatus
    var summary: String?
    var error: String?
}

// MARK: - Delegate

protocol SurveyServiceDelegate {
    func surveyService(_ service: SurveyService, agentDidStart agent: SurveyAgentState)
    func surveyService(_ service: SurveyService, agentDidComplete agent: SurveyAgentState)
    func surveyService(_ service: SurveyService, agentDidFail agent: SurveyAgentState)
    func surveyService(_ service: SurveyService, didReceiveDelta delta: String)
    func surveyService(_ service: SurveyService, didProduceStructured result: StructuredSurveyResult)
    func surveyServiceDidFinish(_ service: SurveyService)
    func surveyService(_ service: SurveyService, didFailWithError error: String)
}

// MARK: - Service

final class SurveyService {
    var delegate: SurveyServiceDelegate?

    private let paperRepo = PaperRepository()
    private let knowledgeRepo = KnowledgeRepository()

    // MARK: - Prompt Templates

    private let plannerTpl = """
    请针对研究问题「{query}」输出检索规划。时间范围：{time_range}。文献类型：{lit_types}。检索数据库偏好：{databases}。仅返回合法 JSON：
    {
        "scope": "一句话定义本次综述范围",
        "search_queries": ["用于检索的短语，3-6条"],
        "must_cover": ["必须覆盖的核心子主题"],
        "expected_methods": ["候选方法类别"],
        "discipline_scope": "学科范围描述"
    }
    """

    private let timelineTpl = """
    请根据以下候选文献，梳理「{query}」领域的发展脉络。仅返回合法 JSON：
    {
        "timeline": [
            {
                "period": "时间段（如 2015-2018）",
                "milestone": "这一阶段的标志性进展（1-2句）",
                "key_works": ["该阶段代表性论文标题"],
                "significance": "为何重要、对后续研究的影响"
            }
        ],
        "earliest_period": "领域起源期简介（1句）",
        "current_frontier": "当前前沿方向概括（1句）"
    }

    研究问题：{query}

    候选文献（按年份排序）：
    {papers_by_year}
    """

    private let writerTpl = """
    请基于研究问题、文献及发展脉络，输出全面的结构化文献综述。仅返回合法 JSON：
    {
        "background": "研究背景（2-4句，含领域定义、重要性与应用价值）",
        "major_methods": [
            {
                "name": "方法类别",
                "description": "方法核心思想",
                "representative_papers": ["代表论文标题"],
                "pros": "主要优势",
                "cons": "主要局限"
            }
        ],
        "schools_of_thought": [
            {
                "name": "学派/流派名称",
                "description": "核心主张与视角",
                "representatives": ["代表学者或代表性工作"]
            }
        ],
        "methodology_summary": {
            "mainstream": "当前主流方法简述",
            "emerging": "新兴方法简述",
            "comparison": "方法优劣对比小结"
        },
        "research_trends": [
            {
                "trend": "趋势名称",
                "signal": "为何出现该趋势、证据"
            }
        ],
        "controversies": [
            {
                "topic": "学界争议点",
                "positions": ["各方观点简述"]
            }
        ],
        "challenges": ["当前关键挑战"],
        "research_gaps": ["现有研究缺口，每条对应一个可切入的空白点"],
        "future_directions": ["未来研究方向与预测"],
        "recommended_topics": [
            {
                "topic": "适合新手切入的研究主题",
                "why": "推荐原因",
                "first_step": "第一步行动建议"
            }
        ],
        "overall_summary": "总结与方向建议（3-5句）"
    }

    研究问题：{query}
    任务范围：{scope}
    时间范围：{time_range}
    文献类型：{lit_types}
    必须覆盖：{must_cover}
    候选方法：{expected_methods}

    发展脉络：
    {timeline}

    候选文献：
    {papers}

    补充语义证据：
    {evidence}
    """

    // MARK: - Main Entry

    func generate(
        query: String,
        settings: [String: String],
        timeRange: String = "all",
        documentType: String = "all",
        database: String = "all",
        citationFormat: String = "apa",
        language: String = "zh",
        maxPapers: Int = 20,
        yearFrom: Int? = nil,
        yearTo: Int? = nil
    ) {
        Task {
            await runPipeline(
                query: query,
                settings: settings,
                timeRange: timeRange,
                documentType: documentType,
                database: database,
                citationFormat: citationFormat,
                language: language,
                maxPapers: maxPapers,
                yearFrom: yearFrom,
                yearTo: yearTo
            )
        }
    }

    // MARK: - Pipeline

    private func runPipeline(
        query: String,
        settings: [String: String],
        timeRange: String,
        documentType: String,
        database: String,
        citationFormat: String,
        language: String,
        maxPapers: Int,
        yearFrom: Int?,
        yearTo: Int?
    ) async {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["survey_writer_model", "multi_agent_survey_model", "multi_agent_worker_model"],
            temperatureKeys: ["survey_writer_temperature", "multi_agent_survey_temperature"]
        ) else {
            await notifyError("请先在设置中配置 LLM 提供商。")
            return
        }

        let timeRangeStr = Self.buildTimeRangeLabel(from: yearFrom, to: yearTo)
        let litTypesStr = documentType != "all" ? documentType : "不限"
        let databasesStr = database != "all" ? database : "不限"

        // ── Agent 1: Planner ──
        let planAgent = SurveyAgentState(
            id: UUID().uuidString,
            name: "检索规划 Agent",
            role: "规划研究范围与检索策略",
            status: .running
        )
        await notifyAgentStart(planAgent)

        let planPrompt = plannerTpl
            .replacingOccurrences(of: "{query}", with: query)
            .replacingOccurrences(of: "{time_range}", with: timeRangeStr)
            .replacingOccurrences(of: "{lit_types}", with: litTypesStr)
            .replacingOccurrences(of: "{databases}", with: databasesStr)

        let planJson: [String: Any]
        do {
            let resp = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: planPrompt)],
                systemPrompt: "你是研究任务规划 Agent。把用户研究问题拆解成可检索的子问题，并充分利用用户给定的约束条件。输出必须聚焦、可检索、可执行。"
            )
            let parsed = Self.extractJSON(resp)
            planJson = (try? JSONSerialization.jsonObject(with: Data(parsed.utf8)) as? [String: Any]) ?? [:]
            var doneAgent = planAgent
            doneAgent.status = .done
            doneAgent.summary = planJson["scope"] as? String ?? "已生成检索规划"
            await notifyAgentComplete(doneAgent)
        } catch {
            var failedAgent = planAgent
            failedAgent.status = .failed
            failedAgent.error = error.localizedDescription
            await notifyAgentFail(failedAgent)
            planJson = [
                "scope": "围绕\(query)进行文献综述",
                "search_queries": [query],
                "must_cover": ["研究背景", "主要方法", "研究趋势"],
                "expected_methods": []
            ]
        }

        let searchQueries = (planJson["search_queries"] as? [String]) ?? [query]

        // ── Agent 2: Literature Retriever ──
        let retrievalAgent = SurveyAgentState(
            id: UUID().uuidString,
            name: "文献检索 Agent",
            role: "检索候选文献",
            status: .running
        )
        await notifyAgentStart(retrievalAgent)

        let paperLimit = max(maxPapers, 1)
        var papers: [SurveyPaperEx] = []
        var retrievalSummary = ""

        do {
            let localPapers = try paperRepo.searchByTerms(
                query: query,
                searchQueries: searchQueries,
                limit: paperLimit,
                yearFrom: yearFrom,
                yearTo: yearTo
            )
            papers = localPapers.map { Self.toSurveyPaperEx($0) }
            let filterDesc = (yearFrom != nil || yearTo != nil) ? "（时间范围：\(timeRangeStr)）" : ""
            retrievalSummary = "已从论文库检索到 \(papers.count) 篇候选文献\(filterDesc)"
        } catch {
            retrievalSummary = "论文库检索失败，已切换外部学术源补充：\(error.localizedDescription)"
        }

        if papers.count < paperLimit {
            let externalLimit = max(paperLimit - papers.count, 6)
            do {
                let entries = try await ArxivClient.search(
                    query: query,
                    maxResults: externalLimit
                )
                let externalPapers = entries.map { entry -> SurveyPaperEx in
                    let year = entry.published.map { String($0.prefix(4)) }.flatMap { Int($0) }
                    return SurveyPaperEx(
                        id: entry.id,
                        title: entry.title,
                        authors: entry.authors.joined(separator: ", "),
                        abstract: entry.summary,
                        year: year,
                        venue: entry.categories.first ?? "arXiv",
                        doi: nil,
                        paperUrl: entry.pdfURL
                    )
                }
                let added = Self.mergeSurveyPapers(into: &papers, from: externalPapers, limit: paperLimit)
                if added > 0 {
                    retrievalSummary = papers.count == added
                        ? "已从外部学术源检索到 \(added) 篇候选文献"
                        : "\(retrievalSummary)，并从外部学术源补充 \(added) 篇候选文献"
                }
            } catch {
                if papers.isEmpty {
                    retrievalSummary = "论文库与外部学术源均未完成检索：\(error.localizedDescription)"
                }
            }
        }

        if papers.isEmpty {
            let message = "未检索到候选文献，请调整研究问题、放宽时间范围，或先在论文库中导入几篇相关论文后重试。"
            var failedAgent = retrievalAgent
            failedAgent.status = .failed
            failedAgent.error = message
            await notifyAgentFail(failedAgent)
            await notifyError(message)
            return
        }

        var doneRetrieval = retrievalAgent
        doneRetrieval.status = .done
        doneRetrieval.summary = retrievalSummary
        await notifyAgentComplete(doneRetrieval)

        // RAG evidence
        var ragContext = ""
        if let embedClient = EmbeddingClient.fromSettings(settings) {
            do {
                let embeddings = try await embedClient.embed(texts: [query])
                if let emb = embeddings.first {
                    let ragResults = RAGService.combinedSearch(
                        queryEmbedding: emb,
                        paperRepo: paperRepo,
                        knowledgeRepo: knowledgeRepo,
                        topK: min(maxPapers, 10)
                    )
                    ragContext = ragResults.map { "【\($0.source == .paper ? "论文" : "笔记")】\n\($0.content)" }.joined(separator: "\n\n")
                }
            } catch {
                // RAG optional; continue without evidence
            }
        }

        // ── Agent 3: Timeline Analyst ──
        let timelineAgent = SurveyAgentState(
            id: UUID().uuidString,
            name: "时序分析 Agent",
            role: "梳理领域发展脉络与演进阶段",
            status: .running
        )
        await notifyAgentStart(timelineAgent)

        let papersByYearText = Self.buildPapersByYearText(papers)
        let timelinePrompt = timelineTpl
            .replacingOccurrences(of: "{query}", with: query)
            .replacingOccurrences(of: "{papers_by_year}", with: papersByYearText)

        let timelineJson: [String: Any]
        let timelineText: String
        do {
            let resp = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: timelinePrompt)],
                systemPrompt: "你是文献时序分析 Agent。梳理学术领域的发展脉络、关键阶段和演进逻辑。输出必须基于候选文献，不得编造。"
            )
            let parsed = Self.extractJSON(resp)
            let json = (try? JSONSerialization.jsonObject(with: Data(parsed.utf8)) as? [String: Any]) ?? [:]
            let stages = (json["timeline"] as? [[String: Any]])?.count ?? 0
            var doneAgent = timelineAgent
            doneAgent.status = .done
            doneAgent.summary = "已识别 \(stages) 个发展阶段"
            await notifyAgentComplete(doneAgent)
            timelineJson = json
            timelineText = Self.buildTimelineText(json)
        } catch {
            var failedAgent = timelineAgent
            failedAgent.status = .failed
            failedAgent.error = error.localizedDescription
            await notifyAgentFail(failedAgent)
            timelineJson = [:]
            timelineText = ""
        }

        // ── Agent 4: Survey Writer ──
        let writerAgent = SurveyAgentState(
            id: UUID().uuidString,
            name: "综述写作 Agent",
            role: "生成全面结构化文献综述",
            status: .running
        )
        await notifyAgentStart(writerAgent)

        let papersText = Self.buildPapersText(papers)
        let writerPrompt = writerTpl
            .replacingOccurrences(of: "{query}", with: query)
            .replacingOccurrences(of: "{scope}", with: planJson["scope"] as? String ?? "围绕用户研究问题给出入门综述")
            .replacingOccurrences(of: "{time_range}", with: timeRangeStr)
            .replacingOccurrences(of: "{lit_types}", with: litTypesStr)
            .replacingOccurrences(of: "{must_cover}", with: (planJson["must_cover"] as? [String])?.joined(separator: "、") ?? "研究背景、主要方法、研究趋势")
            .replacingOccurrences(of: "{expected_methods}", with: (planJson["expected_methods"] as? [String])?.joined(separator: "、") ?? "")
            .replacingOccurrences(of: "{timeline}", with: timelineText)
            .replacingOccurrences(of: "{papers}", with: papersText)
            .replacingOccurrences(of: "{evidence}", with: ragContext)

        do {
            let resp = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: writerPrompt)],
                systemPrompt: "你是文献综述写作 Agent。生成结构化、全面、可信且可执行的学术文献综述。输出必须基于输入材料，不得夸大或编造。"
            )
            let clean = Self.extractJSON(resp)
            var report = (try? JSONSerialization.jsonObject(with: Data(clean.utf8)) as? [String: Any]) ?? [:]
            if report.isEmpty {
                report = ["overall_summary": resp]
            }

            // Inject timeline fields
            if timelineJson["timeline"] != nil {
                report["development_timeline"] = timelineJson["timeline"]
            }
            if let v = timelineJson["current_frontier"] {
                report["current_frontier"] = v
            }
            if let v = timelineJson["earliest_period"] {
                report["earliest_period"] = v
            }

            // ── Agent 5: Citation Formatter ──
            let citeFormat = citationFormat
            let formattedCitations = papers.enumerated().map { idx, p in
                "[\(idx + 1)] \(Self.formatCitation(paper: p, format: citeFormat))"
            }

            let markdown = Self.buildSurveyMarkdown(query: query, report: report, papers: papers, formattedCitations: formattedCitations, citeFormat: citeFormat)
            await notifyDelta(markdown)

            // Decode structured report
            let reportData = try JSONSerialization.data(withJSONObject: report)
            let structuredReport = try JSONDecoder().decode(StructuredSurveyReport.self, from: reportData)

            let result = StructuredSurveyResult(
                query: query,
                report: structuredReport,
                papers: papers,
                formattedCitations: formattedCitations,
                citationFormat: citeFormat,
                meta: SurveyMeta(
                    timeRange: timeRangeStr,
                    litTypes: litTypesStr,
                    databases: databasesStr,
                    language: language
                )
            )
            await notifyStructured(result)

            var doneWriter = writerAgent
            doneWriter.status = .done
            doneWriter.summary = "已完成综述（背景、发展脉络、方法、趋势、挑战、研究缺口与建议方向）"
            await notifyAgentComplete(doneWriter)
            await notifyFinish()
        } catch {
            var failedAgent = writerAgent
            failedAgent.status = .failed
            failedAgent.error = error.localizedDescription
            await notifyAgentFail(failedAgent)
            await notifyError(error.localizedDescription)
        }
    }

    // MARK: - Helpers

    private static func buildTimeRangeLabel(from: Int?, to: Int?) -> String {
        switch (from, to) {
        case (let f?, let t?): return "\(f) - \(t)"
        case (let f?, nil): return "\(f) 至今"
        case (nil, let t?): return "\(t) 年以前"
        case (nil, nil): return "不限"
        }
    }

    private static func toSurveyPaperEx(_ paper: Paper) -> SurveyPaperEx {
        var url: String?
        if let doi = paper.doi, !doi.isEmpty {
            url = "https://doi.org/\(doi)"
        } else if let filePath = paper.filePath, !filePath.isEmpty {
            url = URL(fileURLWithPath: filePath).absoluteString
        }
        return SurveyPaperEx(
            id: paper.id,
            title: paper.title,
            authors: paper.authors.joined(separator: ", "),
            abstract: paper.abstractText,
            year: paper.year,
            venue: paper.venue,
            doi: paper.doi,
            paperUrl: url
        )
    }

    private static func mergeSurveyPapers(into target: inout [SurveyPaperEx], from incoming: [SurveyPaperEx], limit: Int) -> Int {
        if target.count >= limit { return 0 }
        var seen = Set(target.map { $0.doi?.trimmingCharacters(in: .whitespaces).lowercased() ?? $0.title.trimmingCharacters(in: .whitespaces).lowercased() })
        let before = target.count
        for paper in incoming {
            if target.count >= limit { break }
            let key = paper.doi?.trimmingCharacters(in: .whitespaces).lowercased() ?? paper.title.trimmingCharacters(in: .whitespaces).lowercased()
            guard !key.isEmpty, seen.insert(key).inserted else { continue }
            target.append(paper)
        }
        return target.count - before
    }

    private static func buildPapersText(_ papers: [SurveyPaperEx]) -> String {
        if papers.isEmpty { return "无匹配论文。" }
        return papers.enumerated().map { idx, p in
            let yearStr = p.year.map { String($0) } ?? ""
            return "[\(idx + 1)] \(p.title) | \(p.authors ?? "") | \(yearStr) | \(p.venue ?? "")\n摘要: \(p.abstract ?? "")"
        }.joined(separator: "\n\n")
    }

    private static func buildPapersByYearText(_ papers: [SurveyPaperEx]) -> String {
        if papers.isEmpty { return "无匹配论文。" }
        let sorted = papers.sorted { ($0.year ?? 0) < ($1.year ?? 0) }
        return sorted.map { p in
            let yearStr = p.year.map { String($0) } ?? "年份未知"
            return "[\(yearStr)] \(p.title) (\(p.venue ?? ""))"
        }.joined(separator: "\n")
    }

    private static func buildTimelineText(_ timelineJson: [String: Any]) -> String {
        var out = ""
        if let ep = timelineJson["earliest_period"] as? String {
            out += "起源：\(ep)\n\n"
        }
        if let stages = timelineJson["timeline"] as? [[String: Any]] {
            for stage in stages {
                let period = stage["period"] as? String ?? ""
                let milestone = stage["milestone"] as? String ?? ""
                out += "• \(period)：\(milestone)\n"
            }
        }
        if let frontier = timelineJson["current_frontier"] as? String {
            out += "\n当前前沿：\(frontier)"
        }
        return out
    }

    private static func extractJSON(_ s: String) -> String {
        var s = s.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("```") {
            let lines = s.components(separatedBy: "\n")
            if lines.count > 2 {
                s = lines[1..<(lines.count - 1)].joined(separator: "\n")
            } else {
                s = lines.joined(separator: "\n").replacingOccurrences(of: "```json", with: "").replacingOccurrences(of: "```", with: "")
            }
        }
        guard let start = s.firstIndex(of: "{"), let end = s.lastIndex(of: "}") else { return s }
        return String(s[start...end])
    }

    private static func formatCitation(paper: SurveyPaperEx, format: String) -> String {
        let title = paper.title
        let authors = paper.authors ?? ""
        let year = paper.year.map { String($0) } ?? ""
        let venue = paper.venue ?? ""
        let doi = paper.doi?.trimmingCharacters(in: .whitespaces)
        let hasDoi = !(doi?.isEmpty ?? true)
        let isJournal = venue.lowercased().contains("journal") || venue.lowercased().contains("transactions") || venue.lowercased().contains("letters")

        switch format {
        case "apa":
            var s = ""
            if !authors.isEmpty { s += "\(authors). " }
            if !year.isEmpty { s += "(\(year)). " }
            s += "\(title)."
            if !venue.isEmpty { s += " \(venue)" }
            if hasDoi, let d = doi { s += ". https://doi.org/\(d)" }
            return s
        case "mla":
            var s = ""
            if !authors.isEmpty { s += "\(authors). " }
            s += "\"\(title)\""
            if !venue.isEmpty { s += ", \(venue)" }
            if !year.isEmpty { s += ", \(year)" }
            s += "."
            if hasDoi, let d = doi { s += " doi:\(d)" }
            return s
        case "ieee":
            var s = ""
            if !authors.isEmpty { s += "\(authors), " }
            s += "\"\(title)\""
            if !venue.isEmpty { s += ", \(venue)" }
            if !year.isEmpty { s += ", \(year)" }
            s += "."
            if hasDoi, let d = doi { s += " doi: \(d)" }
            return s
        default:
            let litMark = isJournal ? "J" : "C"
            var s = ""
            if !authors.isEmpty { s += "\(authors). " }
            s += "\(title)[\(litMark)]"
            if !venue.isEmpty { s += ". \(venue)" }
            if !year.isEmpty { s += ", \(year)" }
            if hasDoi, let d = doi { s += ". DOI:\(d)" } else { s += "." }
            return s
        }
    }

    private static func buildSurveyMarkdown(
        query: String,
        report: [String: Any],
        papers: [SurveyPaperEx],
        formattedCitations: [String],
        citeFormat: String
    ) -> String {
        var out = "# 文献综述\n\n**研究问题**：\(query)\n\n"
        if let bg = report["background"] as? String {
            out += "## 研究背景\n\n\(bg)\n\n"
        }
        if let timeline = report["development_timeline"] as? [[String: Any]], !timeline.isEmpty {
            out += "## 发展脉络\n\n"
            if let ep = report["earliest_period"] as? String {
                out += "\(ep)\n\n"
            }
            for stage in timeline {
                let period = stage["period"] as? String ?? ""
                let milestone = stage["milestone"] as? String ?? ""
                out += "### \(period)\n\n\(milestone)\n\n"
            }
            if let cf = report["current_frontier"] as? String {
                out += "**当前前沿**：\(cf)\n\n"
            }
        }
        if let methods = report["major_methods"] as? [[String: Any]], !methods.isEmpty {
            out += "## 主要方法\n\n"
            for m in methods {
                let name = m["name"] as? String ?? ""
                let desc = m["description"] as? String ?? ""
                out += "### \(name)\n\n\(desc)\n\n"
            }
        }
        if let trends = report["research_trends"] as? [[String: Any]], !trends.isEmpty {
            out += "## 研究趋势\n\n"
            for t in trends {
                let name = t["trend"] as? String ?? ""
                let signal = t["signal"] as? String ?? ""
                out += "- **\(name)**：\(signal)\n"
            }
            out += "\n"
        }
        if let gaps = report["research_gaps"] as? [String], !gaps.isEmpty {
            out += "## 研究缺口\n\n"
            for gap in gaps {
                out += "- \(gap)\n"
            }
            out += "\n"
        }
        if let dirs = report["future_directions"] as? [String], !dirs.isEmpty {
            out += "## 未来研究方向\n\n"
            for dir in dirs {
                out += "- \(dir)\n"
            }
            out += "\n"
        }
        if let summary = report["overall_summary"] as? String {
            out += "## 总结建议\n\n\(summary)\n\n"
        }
        if !formattedCitations.isEmpty {
            out += "## 参考文献\n\n"
            for cite in formattedCitations {
                out += "\(cite)\n\n"
            }
        }
        return out
    }

    // MARK: - Delegate Notifications

    @MainActor
    private func notifyAgentStart(_ agent: SurveyAgentState) {
        delegate?.surveyService(self, agentDidStart: agent)
    }

    @MainActor
    private func notifyAgentComplete(_ agent: SurveyAgentState) {
        delegate?.surveyService(self, agentDidComplete: agent)
    }

    @MainActor
    private func notifyAgentFail(_ agent: SurveyAgentState) {
        delegate?.surveyService(self, agentDidFail: agent)
    }

    @MainActor
    private func notifyDelta(_ delta: String) {
        delegate?.surveyService(self, didReceiveDelta: delta)
    }

    @MainActor
    private func notifyStructured(_ result: StructuredSurveyResult) {
        delegate?.surveyService(self, didProduceStructured: result)
    }

    @MainActor
    private func notifyFinish() {
        delegate?.surveyServiceDidFinish(self)
    }

    @MainActor
    private func notifyError(_ error: String) {
        delegate?.surveyService(self, didFailWithError: error)
    }
}

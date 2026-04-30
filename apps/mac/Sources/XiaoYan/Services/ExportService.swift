import Foundation

struct ExportService {
    /// Export a paper as Obsidian-compatible markdown with YAML frontmatter
    static func exportPaper(paper: Paper) -> String {
        var md = "---\n"
        md += "title: \"\(paper.title)\"\n"
        if !paper.authors.isEmpty {
            md += "authors:\n"
            for author in paper.authors {
                md += "  - \"\(author)\"\n"
            }
        }
        if let year = paper.year { md += "year: \(year)\n" }
        if let venue = paper.venue { md += "venue: \"\(venue)\"\n" }
        if let doi = paper.doi { md += "doi: \"\(doi)\"\n" }
        if !paper.tags.isEmpty {
            md += "tags:\n"
            for tag in paper.tags {
                md += "  - \(tag)\n"
            }
        }
        md += "status: \(paper.status.rawValue)\n"
        md += "---\n\n"

        md += "# \(paper.title)\n\n"

        if let abstract = paper.abstractText {
            md += "## 摘要\n\n\(abstract)\n\n"
        }

        if let analysis = paper.analysis {
            md += "## 分析\n\n"
            if let rq = analysis.researchQuestion { md += "### 研究问题\n\n\(rq)\n\n" }
            if let cm = analysis.coreMethod { md += "### 核心方法\n\n\(cm)\n\n" }
            if let ed = analysis.experimentDesign { md += "### 实验设计\n\n\(ed)\n\n" }
            if let er = analysis.experimentResults { md += "### 实验结果\n\n\(er)\n\n" }
            if let inn = analysis.innovations { md += "### 创新点\n\n\(inn)\n\n" }
            if let lim = analysis.limitations { md += "### 局限性\n\n\(lim)\n\n" }
            if let kc = analysis.keyConclusions { md += "### 关键结论\n\n\(kc)\n\n" }
        }

        if let guide = paper.reproductionGuide {
            md += "## 复现指南\n\n"
            if let repo = guide.codeRepository { md += "### 代码仓库\n\n\(repo)\n\n" }
            if let env = guide.environmentSetup { md += "### 环境配置\n\n\(env)\n\n" }
            if let dep = guide.dependencies { md += "### 依赖\n\n\(dep)\n\n" }
            if let steps = guide.reproductionSteps { md += "### 复现步骤\n\n\(steps)\n\n" }
            if let expected = guide.expectedResults { md += "### 预期结果\n\n\(expected)\n\n" }
        }

        if let fullText = paper.fullText {
            md += "## 全文\n\n\(fullText)\n"
        }

        return md
    }

    /// Export to file
    static func exportToFile(paper: Paper, directory: URL) throws -> URL {
        let filename = paper.title
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
            .prefix(100)
        let fileURL = directory.appendingPathComponent("\(filename).md")
        let content = exportPaper(paper: paper)
        try content.write(to: fileURL, atomically: true, encoding: .utf8)
        return fileURL
    }
}

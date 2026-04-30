import Foundation

enum PptMode: String, CaseIterable {
    case topic, document, outline
}

enum PptStatus: String {
    case idle, drafting, repairing, ready, error
}

enum PptLayout: String, Codable {
    case title, section, content, two_column, highlight, timeline
}

struct PptSlide: Codable, Identifiable {
    let id = UUID()
    let layout: PptLayout
    let title: String
    let subtitle: String?
    let bullets: [String]?
    let left: [String]?
    let right: [String]?
    let highlight: String?
    let steps: [String]?
    let note: String?
}

struct PptData: Codable {
    let title: String
    let slides: [PptSlide]
}

struct PptOption {
    let value: String
    let label: String
}

extension PptLayout {
    var displayName: String {
        switch self {
        case .title: return "标题页"
        case .section: return "章节页"
        case .content: return "内容页"
        case .two_column: return "双列页"
        case .highlight: return "结论页"
        case .timeline: return "流程页"
        }
    }
}

let PPT_STYLE_OPTIONS: [PptOption] = [
    PptOption(value: "auto", label: "小妍推荐"),
    PptOption(value: "文献综述", label: "文献综述"),
    PptOption(value: "实验汇报", label: "实验汇报"),
    PptOption(value: "开题答辩", label: "开题答辩"),
    PptOption(value: "技术路线", label: "技术路线"),
    PptOption(value: "custom", label: "自定义"),
]

let PPT_LANGUAGE_OPTIONS: [PptOption] = [
    PptOption(value: "auto", label: "小妍推荐"),
    PptOption(value: "zh", label: "中文"),
    PptOption(value: "en", label: "English"),
]

let PPT_PAGE_OPTIONS: [PptOption] = [
    PptOption(value: "auto", label: "小妍推荐"),
    PptOption(value: "8", label: "8 页"),
    PptOption(value: "12", label: "12 页"),
    PptOption(value: "16", label: "16 页"),
    PptOption(value: "20", label: "20 页"),
    PptOption(value: "custom", label: "自定义"),
]

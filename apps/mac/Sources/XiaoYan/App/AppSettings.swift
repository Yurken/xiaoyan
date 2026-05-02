import SwiftUI
import Combine

struct ChatContext: Equatable {
    let type: String
    let id: String
    let title: String
}

@MainActor
final class AppSettings: ObservableObject {
    @Published var theme: AppTheme = .dark
    @Published var style: AppStyle = .neumorphic
    @Published var settings: [String: String] = [:]
    @Published var pendingChatContext: ChatContext?

    init() {
        loadPreferences()
        settings = DefaultSettings.all
    }

    func loadPreferences() {
        if let raw = UserDefaults.standard.string(forKey: "rc_theme"),
           let t = AppTheme(rawValue: raw) {
            theme = t
        }
        if let raw = UserDefaults.standard.string(forKey: "rc_style"),
           let s = AppStyle(rawValue: raw) {
            style = s
        }
    }

    func savePreferences() {
        UserDefaults.standard.set(theme.rawValue, forKey: "rc_theme")
        UserDefaults.standard.set(style.rawValue, forKey: "rc_style")
    }

    func get(_ key: String) -> String? {
        settings[key]
    }

    func set(_ key: String, _ value: String) {
        settings[key] = value
        objectWillChange.send()
        if DatabaseManager.shared.isReady {
            SettingsService().save(key: key, value: value)
        }
    }

    func loadFromStore() {
        guard DatabaseManager.shared.isReady else { return }
        settings = SettingsService().loadAll()
    }

    func apply(_ entries: [String: String], persist: Bool = true) {
        for (key, value) in entries {
            settings[key] = value
        }
        objectWillChange.send()
        guard persist, DatabaseManager.shared.isReady else { return }
        SettingsService().saveBatch(entries.map { (key: $0.key, value: $0.value) })
    }

    func resolveModel(_ keys: [String]) -> String {
        for key in keys {
            if let value = settings[key], !value.isEmpty {
                return value
            }
        }
        return ""
    }

    func resolveTemperature(_ keys: [String]) -> Double {
        for key in keys {
            if let value = settings[key], let temp = Double(value) {
                return min(max(temp, 0.0), 2.0)
            }
        }
        return 0.7
    }

    func resolveMaxTokens(_ key: String, defaultValue: Int = 4096) -> Int {
        if let value = settings[key], let tokens = Int(value) {
            return min(max(tokens, 256), 32768)
        }
        return defaultValue
    }

    var sensitiveKeys: Set<String> {
        [
            "openai_api_key", "anthropic_api_key", "openai_compatible_api_key",
            "vision_api_key", "embedding_api_key", "semantic_scholar_api_key",
            "translation_api_key",
            "planner_hint_api_key", "planner_analysis_api_key", "planner_generation_api_key",
            "multi_agent_supervisor_api_key", "multi_agent_synthesis_api_key",
            "multi_agent_worker_api_key", "multi_agent_planner_api_key",
            "multi_agent_literature_scout_api_key", "multi_agent_survey_api_key",
            "multi_agent_paper_analyst_api_key", "multi_agent_reproduction_api_key",
            "copilot_simple_api_key", "survey_planner_api_key",
            "survey_writer_api_key", "paper_analysis_api_key",
            "paper_reproduction_api_key",
        ]
    }
}

enum AppTheme: String, CaseIterable {
    case dark, light, system

    var displayName: String {
        switch self {
        case .dark: return "深色"
        case .light: return "浅色"
        case .system: return "跟随系统"
        }
    }
}

enum AppStyle: String, CaseIterable {
    case neumorphic, modernMinimal

    var displayName: String {
        switch self {
        case .neumorphic: return "新拟物"
        case .modernMinimal: return "极简"
        }
    }
}

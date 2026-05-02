import Foundation

enum ProviderPresetID: String, CaseIterable, Hashable {
    case openai
    case anthropic
    case deepseek
    case qwen
    case siliconflow
    case moonshot
    case gemini
    case ollama
    case custom
}

struct ProviderPreset: Identifiable, Hashable {
    let id: ProviderPresetID
    let label: String
    /// "openai" / "anthropic" / "openai_compatible"
    let providerType: String
    let baseUrl: String
    let defaultChatModel: String
    let apiKeyPlaceholder: String
    let description: String
}

/// 9 条预设，与 desktop `apps/desktop/src/features/settings/providerPresets.ts:5-96` 1:1 对齐。
/// 注意 mac 端 anthropic baseUrl 不带 `/v1/messages` 后缀（由 LLMClient.streamAnthropic 自行拼接）。
let PROVIDER_PRESETS: [ProviderPreset] = [
    .init(
        id: .openai,
        label: "OpenAI",
        providerType: "openai",
        baseUrl: "https://api.openai.com/v1",
        defaultChatModel: "gpt-4o-mini",
        apiKeyPlaceholder: "sk-...",
        description: "官方 OpenAI 接口，自动填入标准 /v1 地址。"
    ),
    .init(
        id: .anthropic,
        label: "Anthropic",
        providerType: "anthropic",
        baseUrl: "https://api.anthropic.com",
        defaultChatModel: "claude-3-5-haiku-20241022",
        apiKeyPlaceholder: "sk-ant-...",
        description: "原生 Messages API，base URL 由 mac 端自动拼接 /v1/messages。"
    ),
    .init(
        id: .deepseek,
        label: "DeepSeek",
        providerType: "openai_compatible",
        baseUrl: "https://api.deepseek.com/v1",
        defaultChatModel: "deepseek-chat",
        apiKeyPlaceholder: "sk-...",
        description: "自动填入官方兼容 OpenAI 的接口地址。"
    ),
    .init(
        id: .qwen,
        label: "通义千问",
        providerType: "openai_compatible",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        defaultChatModel: "qwen-plus",
        apiKeyPlaceholder: "sk-...",
        description: "自动填入 DashScope 兼容模式地址。"
    ),
    .init(
        id: .siliconflow,
        label: "硅基流动",
        providerType: "openai_compatible",
        baseUrl: "https://api.siliconflow.cn/v1",
        defaultChatModel: "Qwen/Qwen2.5-72B-Instruct",
        apiKeyPlaceholder: "sk-...",
        description: "适合统一接入开源模型与 embedding。"
    ),
    .init(
        id: .moonshot,
        label: "Moonshot",
        providerType: "openai_compatible",
        baseUrl: "https://api.moonshot.cn/v1",
        defaultChatModel: "moonshot-v1-8k",
        apiKeyPlaceholder: "sk-...",
        description: "自动填入 Moonshot 官方兼容地址。"
    ),
    .init(
        id: .gemini,
        label: "Gemini",
        providerType: "openai_compatible",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        defaultChatModel: "gemini-2.0-flash",
        apiKeyPlaceholder: "AIza...",
        description: "使用 Google 提供的 OpenAI 兼容入口。"
    ),
    .init(
        id: .ollama,
        label: "Ollama",
        providerType: "openai_compatible",
        baseUrl: "http://localhost:11434/v1",
        defaultChatModel: "qwen2.5:7b",
        apiKeyPlaceholder: "ollama",
        description: "本地部署，自动填入 localhost:11434/v1。"
    ),
    .init(
        id: .custom,
        label: "自定义",
        providerType: "openai_compatible",
        baseUrl: "",
        defaultChatModel: "",
        apiKeyPlaceholder: "sk-...",
        description: "适用于代理转发、OpenRouter、One API 或其他兼容接口。"
    ),
]

/// 根据当前 settings 反查激活的预设；与 desktop `detectPreset:100-111` 同语义。
func detectPreset(_ settings: [String: String]) -> ProviderPresetID {
    let provider = settings["llm_provider"] ?? "openai"
    if provider == "openai" { return .openai }
    if provider == "anthropic" { return .anthropic }

    let url = (settings["openai_compatible_base_url"] ?? "")
        .trimmingCharacters(in: .whitespaces)
    if url.contains("deepseek.com") { return .deepseek }
    if url.contains("dashscope.aliyuncs.com") { return .qwen }
    if url.contains("siliconflow.cn") { return .siliconflow }
    if url.contains("moonshot.cn") { return .moonshot }
    if url.contains("generativelanguage.googleapis.com") { return .gemini }
    if url.contains("localhost:11434") || url.contains("127.0.0.1:11434") { return .ollama }
    return .custom
}

/// 返回需要批量写入的字段；调用方使用 `AppSettings.apply(_:)` 一次性持久化。
/// 与 desktop `applyProviderPreset:113-135` 同语义：仅写本路字段，保留 api_key 与其他路。
func applyPresetEntries(_ id: ProviderPresetID) -> [String: String] {
    guard let preset = PROVIDER_PRESETS.first(where: { $0.id == id }) else { return [:] }
    var entries: [String: String] = ["llm_provider": preset.providerType]
    switch preset.providerType {
    case "openai":
        entries["openai_base_url"] = preset.baseUrl
        entries["openai_model"] = preset.defaultChatModel
    case "anthropic":
        entries["anthropic_model"] = preset.defaultChatModel
    default:
        entries["openai_compatible_base_url"] = preset.baseUrl
        entries["openai_compatible_model"] = preset.defaultChatModel
    }
    return entries
}

import Foundation

/// Unified LLM client supporting OpenAI and Anthropic protocols
enum LLMClient {
    case openai(config: OpenAIConfig)
    case anthropic(config: AnthropicConfig)

    struct OpenAIConfig {
        let baseURL: String
        let apiKey: String
        let model: String
        let temperature: Double
        let maxTokens: Int
    }

    struct AnthropicConfig {
        let baseURL: String
        let apiKey: String
        let model: String
        let temperature: Double
        let maxTokens: Int
    }

    struct Message: Codable {
        let role: String
        let content: String
    }

    // MARK: - Factory

    static func fromSettings(_ settings: [String: String], modelKeys: [String] = [], temperatureKeys: [String] = []) -> LLMClient? {
        let provider = settings["llm_provider"] ?? "openai"
        let resolveModel = { (keys: [String], fallbackKeys: [String]) -> String in
            let allKeys = keys + fallbackKeys.filter { !keys.contains($0) }
            for key in keys {
                if let v = settings[key], !v.isEmpty { return v }
            }
            for key in allKeys {
                if let v = settings[key], !v.isEmpty { return v }
            }
            return ""
        }
        let resolveTemp = { (keys: [String]) -> Double in
            for key in keys {
                if let v = settings[key], let d = Double(v) { return min(max(d, 0), 2) }
            }
            return 0.7
        }
        let resolveTokens = { (key: String) -> Int in
            if let v = settings[key], let i = Int(v) { return min(max(i, 256), 32768) }
            return 4096
        }

        switch provider {
        case "anthropic":
            let config = AnthropicConfig(
                baseURL: settings["anthropic_base_url"] ?? "https://api.anthropic.com",
                apiKey: settings["anthropic_api_key"] ?? "",
                model: resolveModel(modelKeys, ["anthropic_model", "anthropic_chat_model"]),
                temperature: resolveTemp(temperatureKeys.isEmpty ? ["anthropic_temperature"] : temperatureKeys),
                maxTokens: resolveTokens("anthropic_max_tokens")
            )
            return .anthropic(config: config)

        case "openai_compatible":
            let config = OpenAIConfig(
                baseURL: settings["openai_compatible_base_url"] ?? "",
                apiKey: settings["openai_compatible_api_key"] ?? "",
                model: resolveModel(modelKeys, ["openai_compatible_model", "openai_compatible_chat_model"]),
                temperature: resolveTemp(temperatureKeys.isEmpty ? ["openai_compatible_temperature"] : temperatureKeys),
                maxTokens: resolveTokens("openai_compatible_max_tokens")
            )
            return .openai(config: config)

        default:
            let config = OpenAIConfig(
                baseURL: settings["openai_base_url"] ?? "https://api.openai.com/v1",
                apiKey: settings["openai_api_key"] ?? "",
                model: resolveModel(modelKeys, ["openai_model", "openai_chat_model"]),
                temperature: resolveTemp(temperatureKeys.isEmpty ? ["openai_temperature"] : temperatureKeys),
                maxTokens: resolveTokens("openai_max_tokens")
            )
            return .openai(config: config)
        }
    }

    @MainActor
    static func fromSettings(_ settings: AppSettings, modelKeys: [String] = [], temperatureKeys: [String] = []) -> LLMClient? {
        fromSettings(settings.settings, modelKeys: modelKeys, temperatureKeys: temperatureKeys)
    }

    // MARK: - Streaming Chat

    func streamChat(messages: [Message], systemPrompt: String? = nil) -> AsyncThrowingStream<String, Error> {
        switch self {
        case .openai(let config):
            return streamOpenAI(config: config, messages: messages, systemPrompt: systemPrompt)
        case .anthropic(let config):
            return streamAnthropic(config: config, messages: messages, systemPrompt: systemPrompt)
        }
    }

    // MARK: - Non-streaming Chat

    func chat(messages: [Message], systemPrompt: String? = nil) async throws -> String {
        switch self {
        case .openai(let config):
            return try await chatOpenAI(config: config, messages: messages, systemPrompt: systemPrompt)
        case .anthropic(let config):
            return try await chatAnthropic(config: config, messages: messages, systemPrompt: systemPrompt)
        }
    }

    // MARK: - OpenAI

    private func streamOpenAI(config: OpenAIConfig, messages: [Message], systemPrompt: String?) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    var allMessages: [[String: Any]] = []
                    if let systemPrompt {
                        allMessages.append(["role": "system", "content": systemPrompt])
                    }
                    for msg in messages {
                        allMessages.append(["role": msg.role, "content": msg.content])
                    }

                    let body: [String: Any] = [
                        "model": config.model,
                        "messages": allMessages,
                        "temperature": config.temperature,
                        "max_tokens": config.maxTokens,
                        "stream": true
                    ]

                    let url = URL(string: "\(config.baseURL)/chat/completions")!
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue("Bearer \(config.apiKey)", forHTTPHeaderField: "Authorization")
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.httpBody = try JSONSerialization.data(withJSONObject: body)

                    for try await payload in SSESession.stream(urlRequest: request) {
                        guard let data = payload.data(using: .utf8),
                              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                              let choices = json["choices"] as? [[String: Any]],
                              let delta = choices.first?["delta"] as? [String: Any],
                              let content = delta["content"] as? String else {
                            continue
                        }
                        continuation.yield(content)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func chatOpenAI(config: OpenAIConfig, messages: [Message], systemPrompt: String?) async throws -> String {
        var allMessages: [[String: Any]] = []
        if let systemPrompt {
            allMessages.append(["role": "system", "content": systemPrompt])
        }
        for msg in messages {
            allMessages.append(["role": msg.role, "content": msg.content])
        }

        let body: [String: Any] = [
            "model": config.model,
            "messages": allMessages,
            "temperature": config.temperature,
            "max_tokens": config.maxTokens
        ]

        let url = URL(string: "\(config.baseURL)/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(config.apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let choices = json?["choices"] as? [[String: Any]],
              let message = choices.first?["message"] as? [String: Any],
              let content = message["content"] as? String else {
            throw LLMError.invalidResponse
        }
        return content
    }

    // MARK: - Anthropic

    private func streamAnthropic(config: AnthropicConfig, messages: [Message], systemPrompt: String?) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    var body: [String: Any] = [
                        "model": config.model,
                        "max_tokens": config.maxTokens,
                        "temperature": config.temperature,
                        "messages": messages.map { ["role": $0.role, "content": $0.content] }
                    ]
                    if let systemPrompt {
                        body["system"] = systemPrompt
                    }

                    let url = URL(string: "\(config.baseURL)/v1/messages")!
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue(config.apiKey, forHTTPHeaderField: "x-api-key")
                    request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.httpBody = try JSONSerialization.data(withJSONObject: body)

                    for try await payload in SSESession.stream(urlRequest: request) {
                        guard let data = payload.data(using: .utf8),
                              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                            continue
                        }

                        let eventType = json["type"] as? String
                        if eventType == "content_block_delta",
                           let delta = json["delta"] as? [String: Any],
                           let text = delta["text"] as? String {
                            continuation.yield(text)
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func chatAnthropic(config: AnthropicConfig, messages: [Message], systemPrompt: String?) async throws -> String {
        var body: [String: Any] = [
            "model": config.model,
            "max_tokens": config.maxTokens,
            "temperature": config.temperature,
            "messages": messages.map { ["role": $0.role, "content": $0.content] }
        ]
        if let systemPrompt {
            body["system"] = systemPrompt
        }

        let url = URL(string: "\(config.baseURL)/v1/messages")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(config.apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let content = json?["content"] as? [[String: Any]] else {
            throw LLMError.invalidResponse
        }
        return content.compactMap { $0["text"] as? String }.joined()
    }
}

enum LLMError: LocalizedError {
    case invalidResponse
    case apiKeyMissing

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "无效的 LLM API 响应"
        case .apiKeyMissing: return "缺少 API Key"
        }
    }
}

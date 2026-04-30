import Foundation
import CryptoKit

struct SettingsService {
    private let settingsRepo = SettingsRepository()

    func loadAll() -> [String: String] {
        var merged = DefaultSettings.all
        if let loaded = try? settingsRepo.loadAll() {
            for (key, value) in loaded {
                merged[key] = value
            }
        }
        return merged
    }

    func save(key: String, value: String) {
        try? settingsRepo.upsert(key: key, value: value)
    }

    func saveBatch(_ entries: [(key: String, value: String)]) {
        try? settingsRepo.upsertBatch(entries)
    }

    // MARK: - Test Connection

    @MainActor
    func testConnection(settings: AppSettings) async -> Bool {
        guard let client = LLMClient.fromSettings(settings) else { return false }
        do {
            let response = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: "Reply with the single word: ok")],
                systemPrompt: nil
            )
            return response.lowercased().contains("ok")
        } catch {
            return false
        }
    }

    // MARK: - Encrypted Export/Import (AES-256-GCM)

    func exportSettings(settings: [String: String], password: String) throws -> String {
        // Filter out sensitive keys with *** values
        var filtered = settings
        for key in filtered.keys where filtered[key] == "***" {
            filtered.removeValue(forKey: key)
        }

        let jsonData = try JSONEncoder().encode(filtered)

        // Derive key using PBKDF2
        let salt = Data((0..<16).map { _ in UInt8.random(in: 0...255) })
        let key = deriveKey(password: password, salt: salt)

        // Encrypt with AES-256-GCM
        let nonce = AES.GCM.Nonce()
        let sealedBox = try AES.GCM.seal(jsonData, using: key, nonce: nonce)

        // Pack: magic header + salt + nonce + ciphertext + tag
        var packed = Data("RCCFG1".utf8)
        packed.append(salt)
        packed.append(Data(nonce))
        packed.append(sealedBox.ciphertext)
        packed.append(sealedBox.tag)

        return packed.base64EncodedString()
    }

    func importSettings(base64: String, password: String) throws -> [String: String] {
        guard let packed = Data(base64Encoded: base64) else {
            throw SettingsError.invalidFormat
        }

        let magic = Data("RCCFG1".utf8)
        guard packed.starts(with: magic) else {
            throw SettingsError.invalidFormat
        }

        let offset = magic.count
        let salt = packed[offset..<offset + 16]
        let nonceData = packed[offset + 16..<offset + 16 + 12]
        let ciphertextAndTag = packed[(offset + 16 + 12)...]

        let key = deriveKey(password: password, salt: salt)
        let nonce = try AES.GCM.Nonce(data: nonceData)

        // Last 16 bytes are the tag
        let ciphertext = ciphertextAndTag.dropLast(16)
        let tag = ciphertextAndTag.suffix(16)

        let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
        let decrypted = try AES.GCM.open(sealedBox, using: key)

        return try JSONDecoder().decode([String: String].self, from: decrypted)
    }

    private func deriveKey(password: String, salt: Data) -> SymmetricKey {
        let passwordData = Data(password.utf8)
        var keyData = Data(repeating: 0, count: 32)

        // PBKDF2-HMAC-SHA256, 600k rounds
        _ = keyData.withUnsafeMutableBytes { keyBytes in
            _ = salt.withUnsafeBytes { saltBytes in
                _ = passwordData.withUnsafeBytes { passwordBytes in
                    CCKeyDerivationPBKDFAccelerated(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passwordBytes.baseAddress, passwordData.count,
                        saltBytes.baseAddress, salt.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        600_000,
                        keyBytes.baseAddress, 32
                    )
                }
            }
        }

        return SymmetricKey(data: keyData)
    }

    // MARK: - Settings History

    func saveSnapshot(name: String, settings: [String: String]) throws {
        let jsonData = try JSONEncoder().encode(settings)
        try settingsRepo.saveHistory(
            id: UUID().uuidString,
            name: name,
            settingsJson: String(data: jsonData, encoding: .utf8) ?? "{}"
        )
    }

    func listSnapshots() -> [SettingsHistory] {
        (try? settingsRepo.listHistory()) ?? []
    }

    // MARK: - Ollama

    static func listOllamaModels(baseURL: String) async -> [String] {
        let models = try? await OllamaClient.listModels(baseURL: baseURL)
        return models?.map { $0.name } ?? []
    }
}

enum SettingsError: LocalizedError {
    case invalidFormat
    case wrongPassword

    var errorDescription: String? {
        switch self {
        case .invalidFormat: return "无效的设置文件格式"
        case .wrongPassword: return "密码错误"
        }
    }
}

// Fallback for PBKDF2 - using CommonCrypto
import CommonCrypto

private func CCKeyDerivationPBKDFAccelerated(
    _ algorithm: CCPBKDFAlgorithm,
    _ password: UnsafeRawPointer?, _ passwordLen: Int,
    _ salt: UnsafeRawPointer?, _ saltLen: Int,
    _ prf: CCPseudoRandomAlgorithm,
    _ rounds: UInt32,
    _ derivedKey: UnsafeMutableRawPointer?, _ derivedKeyLen: Int
) -> Int32 {
    CCKeyDerivationPBKDF(
        algorithm,
        password, passwordLen,
        salt, saltLen,
        prf,
        rounds,
        derivedKey, derivedKeyLen
    )
}

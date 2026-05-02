import Foundation

/// 与 desktop `Record<string, unknown>` 互通的任意 JSON 值。
/// 用于 `ExperimentRecord.config` 等需保留嵌套对象 / 数字 / 布尔的字段。
enum JSONValue: Codable, Hashable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let v = try? c.decode(Bool.self) { self = .bool(v); return }
        if let v = try? c.decode(Double.self) { self = .number(v); return }
        if let v = try? c.decode(String.self) { self = .string(v); return }
        if let v = try? c.decode([JSONValue].self) { self = .array(v); return }
        if let v = try? c.decode([String: JSONValue].self) { self = .object(v); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unsupported JSON value")
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null:
            try c.encodeNil()
        case .bool(let v):
            try c.encode(v)
        case .number(let v):
            if v.truncatingRemainder(dividingBy: 1) == 0, abs(v) < 1e15 {
                try c.encode(Int64(v))
            } else {
                try c.encode(v)
            }
        case .string(let v):
            try c.encode(v)
        case .array(let v):
            try c.encode(v)
        case .object(let v):
            try c.encode(v)
        }
    }
}

extension JSONValue: CustomStringConvertible {
    /// 单行展示形式：标量 → 原值；array/object → 紧凑 JSON。
    var description: String {
        switch self {
        case .null:
            return "null"
        case .bool(let v):
            return v ? "true" : "false"
        case .number(let v):
            if v.truncatingRemainder(dividingBy: 1) == 0, abs(v) < 1e15 {
                return String(Int64(v))
            }
            return String(v)
        case .string(let v):
            return v
        case .array, .object:
            guard let data = try? JSONEncoder().encode(self),
                  let s = String(data: data, encoding: .utf8) else { return "" }
            return s
        }
    }
}

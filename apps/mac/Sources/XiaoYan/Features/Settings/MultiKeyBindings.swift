import Foundation

/// 多 key 联动语义辅助方法。镜像 desktop `useSettingsController.ts:29-53`。
/// - sharedValue：trim 后非空集合 size==1 → 共同值，否则 ""（"组内不一致"或全空）
/// - hasMixed：trim 后非空去重集合 size > 1 → 显示琥珀色冲突提示
/// - setMany：遍历 keys 同步把所有 key 写为同一值（完全覆盖，无差异保留）
@MainActor
func sharedValue(_ keys: [String], in settings: AppSettings) -> String {
    let values = keys.compactMap { settings.get($0)?.trimmingCharacters(in: .whitespaces) }
        .filter { !$0.isEmpty }
    let unique = Set(values)
    return unique.count == 1 ? (unique.first ?? "") : ""
}

@MainActor
func hasMixed(_ keys: [String], in settings: AppSettings) -> Bool {
    let values = keys.compactMap { settings.get($0)?.trimmingCharacters(in: .whitespaces) }
        .filter { !$0.isEmpty }
    return Set(values).count > 1
}

@MainActor
func setMany(_ keys: [String], value: String, in settings: AppSettings) {
    var entries: [String: String] = [:]
    for key in keys { entries[key] = value }
    settings.apply(entries)
}

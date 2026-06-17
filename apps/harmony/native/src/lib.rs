//! 小妍 HarmonyOS 原生后端桥接（NAPI）。
//!
//! 设计原则：**零重复**。直接经 `#[path]` 复用桌面端 `apps/desktop/src-tauri/src`
//! 里的纯模块（仅依赖 serde/std + 内嵌 JSON 数据，无 Tauri/State/DB 耦合），
//! 经 NAPI 暴露给 ArkTS。这样桌面端与鸿蒙端共用同一份索引逻辑与数据文件。
//!
//! 已桥接：刊会查询（CCF + 期刊分区）。
//! 未桥接：依赖 SQLite / LLM 流式 / Tauri 状态的命令，统一走 `invoke` 占位，
//!         待后端从 Tauri 解耦出 `xiaoyan-core` 后逐个接通（见 README 解耦路线）。

use napi_derive_ohos::napi;
use napi_ohos::{Error, Result, Status};
use std::collections::HashSet;

// ── 零重复复用桌面端纯模块 ─────────────────────────────────────────────
// include_str! 路径相对各 .rs 文件本身，故内嵌的 ccf_catalog.json /
// journal_partitions.json 仍从 apps/desktop/src-tauri/src/data 解析。
// 相对 native/src/lib.rs 上溯三级到 apps/，再进 desktop/src-tauri/src。
#[path = "../../../desktop/src-tauri/src/ccf.rs"]
mod ccf;
#[path = "../../../desktop/src-tauri/src/journal_partitions.rs"]
mod journal_partitions;
// source_service 内部 `use crate::{ccf, journal_partitions}`，依赖上面两个 crate 根模块。
#[path = "../../../desktop/src-tauri/src/services/source_service.rs"]
mod source_service;

/// 刊会综合查询（期刊分区 + CCF），返回 JSON 字符串（ArkTS 侧 JSON.parse）。
#[napi]
pub fn source_lookup(query: String, limit: u32) -> String {
    source_service::lookup_sources(&query, Some(limit as usize)).to_string()
}

/// CCF 评级查询。
#[napi]
pub fn ccf_lookup(query: String, limit: u32) -> String {
    let trimmed = query.trim();
    let matches = ccf::lookup(trimmed, limit as usize);
    serde_json::json!({ "query": trimmed, "matches": matches }).to_string()
}

/// 列出全部 CCF 收录刊会。
#[napi]
pub fn ccf_list() -> String {
    serde_json::json!({ "venues": ccf::list_all() }).to_string()
}

/// 期刊分区查询。
#[napi]
pub fn journal_lookup(query: String, limit: u32) -> String {
    let trimmed = query.trim();
    let matches = journal_partitions::lookup(trimmed, limit as usize);
    serde_json::json!({ "query": trimmed, "matches": matches }).to_string()
}

/// 按 WoS 分类关键词 + 等级过滤期刊标题，去重，对齐桌面端 journal_rank_filter。
#[napi]
pub fn journal_rank_filter(wos_cat_keywords: Vec<String>, ranks: Vec<String>) -> Vec<String> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut results: Vec<String> = Vec::new();
    for rank in &ranks {
        for title in journal_partitions::filter_by_rank(&wos_cat_keywords, rank, 150) {
            if seen.insert(title.to_lowercase()) {
                results.push(title);
            }
        }
    }
    results
}

/// 未桥接命令的统一占位。
///
/// 保持与桌面端 client.ts `invoke(command, args)` 一致的调用形态，
/// 当前一律返回错误。后端解耦后，将各命令拆为独立 `#[napi]` 函数或在此分发。
#[napi]
pub fn invoke(command: String, _args_json: String) -> Result<String> {
    Err(Error::new(
        Status::GenericFailure,
        format!("命令 `{command}` 尚未桥接到 HarmonyOS 原生后端"),
    ))
}

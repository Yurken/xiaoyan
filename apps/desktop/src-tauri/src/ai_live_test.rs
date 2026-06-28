//! 本地手动 AI 联通测试（**不进流水线**）。
//!
//! 这些用例都标了 `#[ignore]`，所以 CI 里的 `cargo test` 会自动跳过它们——
//! 流水线只跑机械功能（纯函数 / 仓储 / 解析等），不触碰真实 AI。
//!
//! 它们「直接复用本地数据库里开发者填好的 API 配置」：以**只读**方式打开真实的
//! `research_copilot.db`，读出 `settings` 表，套用与 App 完全相同的
//! `LlmClient::from_settings` 解析逻辑，再发一次真实的对话请求。
//! 全程只读，不写入任何数据，不会污染数据库。
//!
//! 本地运行：
//! ```bash
//! # macOS / Linux
//! cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --ignored --nocapture ai_live
//! # 或用封装脚本（自动定位数据库）：
//! bash scripts/test-ai-local.sh            # macOS / Linux
//! pwsh scripts/test-ai-local.ps1           # Windows
//! ```
//! 如数据库不在默认位置，用环境变量覆盖：`RC_DB_PATH=/abs/path/research_copilot.db`。

#![cfg(test)]

use std::collections::HashMap;
use std::path::PathBuf;

use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{Row, SqlitePool};

use crate::llm::{LlmClient, LlmMessage};

const APP_IDENTIFIER: &str = "com.researchcopilot.desktop";
const DB_FILE: &str = "research_copilot.db";

/// 解析真实 App 数据库路径，与 Tauri `app_data_dir()` 的跨平台规则一致。
/// 可用 `RC_DB_PATH`（指向 .db 文件）或 `RC_DB_DIR`（指向数据目录）覆盖。
fn resolve_db_path() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("RC_DB_PATH") {
        if !p.trim().is_empty() {
            return Some(PathBuf::from(p));
        }
    }
    if let Ok(dir) = std::env::var("RC_DB_DIR") {
        if !dir.trim().is_empty() {
            return Some(PathBuf::from(dir).join(DB_FILE));
        }
    }

    let data_dir = if cfg!(target_os = "macos") {
        let home = std::env::var("HOME").ok()?;
        PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join(APP_IDENTIFIER)
    } else if cfg!(target_os = "windows") {
        let appdata = std::env::var("APPDATA").ok()?; // Roaming
        PathBuf::from(appdata).join(APP_IDENTIFIER)
    } else {
        // Linux / 其它：遵循 XDG_DATA_HOME，回退到 ~/.local/share
        let base = std::env::var("XDG_DATA_HOME")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".local/share"))
            })?;
        base.join(APP_IDENTIFIER)
    };

    Some(data_dir.join(DB_FILE))
}

/// 只读打开数据库并读出 settings 键值对（不跑迁移、不写任何东西）。
async fn load_settings_readonly(db_path: &PathBuf) -> Result<HashMap<String, String>, String> {
    if !db_path.exists() {
        return Err(format!(
            "未找到本地数据库：{}\n请先正常启动一次桌面 App 并在设置里填好 API，或用 RC_DB_PATH 指定数据库路径。",
            db_path.display()
        ));
    }

    let opts = SqliteConnectOptions::new()
        .filename(db_path)
        .read_only(true)
        .create_if_missing(false);

    let pool: SqlitePool = SqlitePool::connect_with(opts)
        .await
        .map_err(|e| format!("打开数据库失败：{e}"))?;

    let rows = sqlx::query("SELECT key, value FROM settings")
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("读取 settings 失败：{e}"))?;

    let mut map = HashMap::new();
    for row in rows {
        let key: String = row.get("key");
        let value: String = row.get("value");
        map.insert(key, value);
    }
    pool.close().await;
    Ok(map)
}

/// 真实对话联通测试：复用本地 DB 的 API 配置发一次最小请求。
/// `#[ignore]` → 默认（含 CI）跳过；本地用 `-- --ignored` 显式触发。
#[tokio::test]
#[ignore = "本地手动运行：会真实调用 AI 接口，复用本地数据库里的 API 配置"]
async fn ai_live_chat_smoke() {
    let db_path =
        resolve_db_path().expect("无法解析数据库路径（请设置 HOME / APPDATA 或 RC_DB_PATH）");
    eprintln!("[ai_live] 使用数据库：{}", db_path.display());

    let settings = load_settings_readonly(&db_path)
        .await
        .expect("读取本地设置失败");

    let provider = settings
        .get("llm_provider")
        .cloned()
        .unwrap_or_else(|| "openai".into());
    eprintln!("[ai_live] llm_provider = {provider}");

    let client = LlmClient::from_settings(&settings)
        .expect("根据本地设置构造 LlmClient 失败（多半是对应 provider 的 API key 未配置）");

    let messages = vec![
        LlmMessage::system("你是连通性自检助手，请只回复一个词。"),
        LlmMessage::user("请只回复两个字：在线"),
    ];

    let reply = client
        .chat(&messages, None, 0.0)
        .await
        .expect("真实 AI 请求失败（检查网络 / base_url / api_key / 余额）");

    eprintln!("[ai_live] 模型回复：{reply}");
    assert!(!reply.trim().is_empty(), "AI 返回为空");
}

/// 校验本地 DB 中是否配置了可用的 AI provider（只读，不发网络请求）。
/// 同样 `#[ignore]`，给本地快速排查用。
#[tokio::test]
#[ignore = "本地手动运行：只读校验本地数据库里的 AI 配置是否完整"]
async fn ai_live_settings_present() {
    let db_path = resolve_db_path().expect("无法解析数据库路径");
    let settings = load_settings_readonly(&db_path)
        .await
        .expect("读取本地设置失败");

    // 构造成功即说明对应 provider 的关键字段（api_key / base_url）齐全。
    match LlmClient::from_settings(&settings) {
        Ok(_) => eprintln!("[ai_live] 本地 AI 配置完整，可进行真实对话测试。"),
        Err(e) => panic!("本地 AI 配置不完整：{e}"),
    }
}

//! 代码会话的本地持久化。
//!
//! 所有记录写入 SQLite 表 `code_sessions`，**仅落盘本地**：该表不在
//! `BACKUP_TABLES` / `SYNC_MUTABLE_TABLES` 白名单内，故不参与 WebDAV 多平台同步。

use sqlx::{Row, SqlitePool};
use uuid::Uuid;

use super::{CodeMessage, CodeSession};

pub fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

fn parse_messages(raw: &str) -> Vec<CodeMessage> {
    serde_json::from_str(raw).unwrap_or_default()
}

fn row_to_session(row: &sqlx::sqlite::SqliteRow) -> CodeSession {
    let messages_raw: String = row.get("messages_json");
    CodeSession {
        id: row.get("id"),
        title: row.get("title"),
        working_dir: row.get("working_dir"),
        tool_id: row.get("tool_id"),
        model: row.get("model"),
        messages: parse_messages(&messages_raw),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub async fn create_session(
    db: &SqlitePool,
    title: &str,
    working_dir: Option<&str>,
) -> anyhow::Result<CodeSession> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    sqlx::query(
        "INSERT INTO code_sessions (id, title, working_dir, messages_json, created_at, updated_at)
         VALUES (?, ?, ?, '[]', ?, ?)",
    )
    .bind(&id)
    .bind(title)
    .bind(working_dir)
    .bind(&ts)
    .bind(&ts)
    .execute(db)
    .await?;

    Ok(CodeSession {
        id,
        title: title.to_string(),
        working_dir: working_dir.map(|s| s.to_string()),
        tool_id: None,
        model: None,
        messages: vec![],
        created_at: ts.clone(),
        updated_at: ts,
    })
}

pub async fn list_sessions(db: &SqlitePool) -> anyhow::Result<Vec<CodeSession>> {
    let rows = sqlx::query(
        "SELECT id, title, working_dir, tool_id, model, messages_json, created_at, updated_at
         FROM code_sessions ORDER BY updated_at DESC",
    )
    .fetch_all(db)
    .await?;
    Ok(rows.iter().map(row_to_session).collect())
}

pub async fn get_session(db: &SqlitePool, session_id: &str) -> anyhow::Result<CodeSession> {
    let row = sqlx::query(
        "SELECT id, title, working_dir, tool_id, model, messages_json, created_at, updated_at
         FROM code_sessions WHERE id = ?",
    )
    .bind(session_id)
    .fetch_optional(db)
    .await?;

    match row {
        Some(row) => Ok(row_to_session(&row)),
        None => anyhow::bail!("会话不存在"),
    }
}

pub async fn delete_session(db: &SqlitePool, session_id: &str) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM code_sessions WHERE id = ?")
        .bind(session_id)
        .execute(db)
        .await?;
    Ok(())
}

/// 局部更新会话元数据（任一字段为 None 即跳过）。
pub async fn update_session(
    db: &SqlitePool,
    session_id: &str,
    title: Option<&str>,
    working_dir: Option<&str>,
    tool_id: Option<&str>,
    model: Option<&str>,
) -> anyhow::Result<()> {
    let mut sets: Vec<&str> = Vec::new();
    let mut binds: Vec<String> = Vec::new();

    if let Some(t) = title {
        sets.push("title = ?");
        binds.push(t.to_string());
    }
    if let Some(d) = working_dir {
        sets.push("working_dir = ?");
        binds.push(d.to_string());
    }
    if let Some(t) = tool_id {
        sets.push("tool_id = ?");
        binds.push(t.to_string());
    }
    if let Some(m) = model {
        sets.push("model = ?");
        binds.push(m.to_string());
    }
    if sets.is_empty() {
        return Ok(());
    }

    sets.push("updated_at = ?");
    binds.push(now());

    let sql = format!("UPDATE code_sessions SET {} WHERE id = ?", sets.join(", "));
    let mut query = sqlx::query(&sql);
    for b in &binds {
        query = query.bind(b);
    }
    query.bind(session_id).execute(db).await?;
    Ok(())
}

/// 追加一条消息，并刷新 updated_at；assistant 消息会顺带记录会话最近使用的工具/模型。
pub async fn persist_message(
    db: &SqlitePool,
    session_id: &str,
    msg: &CodeMessage,
) -> anyhow::Result<()> {
    let row = sqlx::query("SELECT messages_json FROM code_sessions WHERE id = ?")
        .bind(session_id)
        .fetch_optional(db)
        .await?;

    let mut messages: Vec<CodeMessage> = match row {
        Some(r) => parse_messages(&r.get::<String, _>("messages_json")),
        None => vec![],
    };
    messages.push(msg.clone());
    let json = serde_json::to_string(&messages)?;
    let ts = now();

    // assistant 消息记录会话最近 tool/model，便于重开会话时恢复选择。
    if msg.role == "assistant" && msg.tool_id.is_some() {
        sqlx::query(
            "UPDATE code_sessions SET messages_json = ?, tool_id = ?, model = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&json)
        .bind(&msg.tool_id)
        .bind(&msg.model)
        .bind(&ts)
        .bind(session_id)
        .execute(db)
        .await?;
    } else {
        sqlx::query("UPDATE code_sessions SET messages_json = ?, updated_at = ? WHERE id = ?")
            .bind(&json)
            .bind(&ts)
            .bind(session_id)
            .execute(db)
            .await?;
    }
    Ok(())
}

/// 若会话仍是默认标题，用首条用户消息生成标题。
pub async fn maybe_autotitle(db: &SqlitePool, session_id: &str, content: &str) {
    if let Ok(session) = get_session(db, session_id).await {
        if session.messages.len() <= 1 && session.title == "新对话" {
            let truncated: String = content.chars().take(50).collect();
            let _ = sqlx::query("UPDATE code_sessions SET title = ?, updated_at = ? WHERE id = ?")
                .bind(&truncated)
                .bind(now())
                .bind(session_id)
                .execute(db)
                .await;
        }
    }
}

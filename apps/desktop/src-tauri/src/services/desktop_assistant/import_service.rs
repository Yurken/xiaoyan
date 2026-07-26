//! Confirmed desktop-assistant imports and persistence.

use anyhow::{anyhow, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use super::action_service::{
    parse_image_data_url, ActionMetadata, ActionResult, AssistantAction,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportTarget {
    Note,
    Image,
    Paper,
    Later,
}

impl std::str::FromStr for ImportTarget {
    type Err = anyhow::Error;

    fn from_str(value: &str) -> Result<Self> {
        match value.to_lowercase().as_str() {
            "note" => Ok(Self::Note),
            "image" => Ok(Self::Image),
            "paper" => Ok(Self::Paper),
            "later" => Ok(Self::Later),
            _ => Err(anyhow!("Unknown import target: {}", value)),
        }
    }
}

pub struct ImportService;

impl ImportService {
    pub async fn import(
        db: &SqlitePool,
        app_data_dir: &std::path::Path,
        session_id: &str,
        content: &str,
        target: &str,
        title: Option<&str>,
        tags: Option<&[String]>,
    ) -> Result<ActionResult> {
        let result = match target.parse::<ImportTarget>()? {
            ImportTarget::Note => Self::import_as_note(db, session_id, content, title, tags).await,
            ImportTarget::Image => Self::import_as_image(app_data_dir, session_id, content),
            ImportTarget::Paper => Self::import_as_paper(db, session_id, content, title).await,
            ImportTarget::Later => Self::import_as_later(db, session_id, content, title).await,
        }?;

        let preview = if content.starts_with("data:image/") {
            "[image]".to_string()
        } else {
            content.chars().take(200).collect()
        };
        sqlx::query(
            "INSERT INTO assistant_imports (id, session_id, target, target_id, content_preview, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(session_id)
        .bind(target)
        .bind(&result.id)
        .bind(preview)
        .execute(db)
        .await?;

        Ok(result)
    }

    async fn import_as_note(
        db: &SqlitePool,
        session_id: &str,
        content: &str,
        title: Option<&str>,
        tags: Option<&[String]>,
    ) -> Result<ActionResult> {
        let note_title = title
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| {
                let preview: String = content.chars().take(50).collect();
                format!("从悬浮助手导入 - {}", preview)
            });
        let note_id = Uuid::new_v4().to_string();
        let tags_json = serde_json::to_string(tags.unwrap_or(&[]))?;

        sqlx::query(
            "INSERT INTO knowledge_notes (id, title, content, tags, source_type, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'assistant', ?, datetime('now'), datetime('now'))",
        )
        .bind(&note_id)
        .bind(&note_title)
        .bind(content)
        .bind(tags_json)
        .bind(session_id)
        .execute(db)
        .await?;

        Ok(import_result(
            &note_id,
            session_id,
            format!("已保存为知识笔记\n\nID: {}\n标题: {}", note_id, note_title),
            format!("note:{}", note_id),
        ))
    }

    fn import_as_image(
        app_data_dir: &std::path::Path,
        session_id: &str,
        content: &str,
    ) -> Result<ActionResult> {
        let asset_id = Uuid::new_v4().to_string();
        let image = parse_image_data_url(content)?;
        let image_data = base64::engine::general_purpose::STANDARD.decode(&image.data)?;
        let image_dir = app_data_dir.join("assistant_images");
        std::fs::create_dir_all(&image_dir)?;
        let image_path = image_dir.join(format!("{}.png", asset_id));
        std::fs::write(&image_path, image_data)?;

        Ok(import_result(
            &asset_id,
            session_id,
            format!(
                "截图已保存\n\nID: {}\n路径: {}",
                asset_id,
                image_path.display()
            ),
            format!("image:{}", asset_id),
        ))
    }

    async fn import_as_paper(
        db: &SqlitePool,
        session_id: &str,
        content: &str,
        title: Option<&str>,
    ) -> Result<ActionResult> {
        let paper_title = title.map(str::to_string).unwrap_or_else(|| {
            let preview: String = content.chars().take(100).collect();
            format!("从悬浮助手导入 - {}", preview)
        });
        let candidate_id = Uuid::new_v4().to_string();
        let content_preview: String = content.chars().take(500).collect();

        sqlx::query(
            "INSERT INTO assistant_paper_candidates (id, session_id, title, content_preview, status, created_at) VALUES (?, ?, ?, ?, 'pending', datetime('now'))",
        )
        .bind(&candidate_id)
        .bind(session_id)
        .bind(&paper_title)
        .bind(content_preview)
        .execute(db)
        .await?;

        Ok(import_result(
            &candidate_id,
            session_id,
            format!(
                "已创建论文导入候选\n\nID: {}\n标题: {}",
                candidate_id, paper_title
            ),
            format!("paper:{}", candidate_id),
        ))
    }

    async fn import_as_later(
        db: &SqlitePool,
        session_id: &str,
        content: &str,
        title: Option<&str>,
    ) -> Result<ActionResult> {
        let later_title = title.map(str::to_string).unwrap_or_else(|| {
            let preview: String = content.chars().take(50).collect();
            format!("稍后处理 - {}", preview)
        });
        let item_id = Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO assistant_later_items (id, title, content, session_id, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
        )
        .bind(&item_id)
        .bind(&later_title)
        .bind(content)
        .bind(session_id)
        .execute(db)
        .await?;

        Ok(import_result(
            &item_id,
            session_id,
            format!("已放入稍后处理\n\nID: {}\n标题: {}", item_id, later_title),
            format!("later:{}", item_id),
        ))
    }
}

fn import_result(id: &str, session_id: &str, content: String, source: String) -> ActionResult {
    ActionResult {
        id: id.to_string(),
        session_id: session_id.to_string(),
        action: AssistantAction::Import,
        content,
        format: "text".to_string(),
        metadata: Some(ActionMetadata {
            model: None,
            token_usage: None,
            duration_ms: None,
            sources: Some(vec![source]),
        }),
        created_at: chrono::Utc::now(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Row;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        for statement in [
            "CREATE TABLE knowledge_notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, tags TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
            "CREATE TABLE assistant_later_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, session_id TEXT, created_at TEXT NOT NULL)",
            "CREATE TABLE assistant_imports (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, target TEXT NOT NULL, target_id TEXT, content_preview TEXT, created_at TEXT NOT NULL)",
        ] {
            sqlx::query(statement).execute(&pool).await.unwrap();
        }
        pool
    }

    #[test]
    fn import_target_parse_rejects_unknown_values() {
        assert!(matches!("note".parse(), Ok(ImportTarget::Note)));
        assert!(matches!("image".parse(), Ok(ImportTarget::Image)));
        assert!("unknown".parse::<ImportTarget>().is_err());
    }

    #[tokio::test]
    async fn note_import_persists_primary_key_and_json_tags() {
        let pool = test_pool().await;
        let result = ImportService::import(
            &pool,
            &std::env::temp_dir(),
            "session-1",
            "A useful research note",
            "note",
            Some("Imported note"),
            Some(&["method".to_string(), "reading".to_string()]),
        )
        .await
        .unwrap();
        let row = sqlx::query("SELECT id, tags, source_type, source_id FROM knowledge_notes")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.get::<String, _>("id"), result.id);
        assert_eq!(row.get::<String, _>("tags"), r#"["method","reading"]"#);
        assert_eq!(row.get::<String, _>("source_type"), "assistant");
        assert_eq!(row.get::<String, _>("source_id"), "session-1");
    }

    #[tokio::test]
    async fn later_import_always_writes_a_nonempty_id() {
        let pool = test_pool().await;
        let result = ImportService::import(
            &pool,
            &std::env::temp_dir(),
            "session-2",
            "Read this later",
            "later",
            None,
            None,
        )
        .await
        .unwrap();
        let id: String = sqlx::query_scalar("SELECT id FROM assistant_later_items")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(!id.is_empty());
        assert_eq!(id, result.id);
    }
}

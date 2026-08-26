//! Privacy-minimized persistence for desktop-assistant capture sessions.

use anyhow::{anyhow, Result};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

use super::capture_service::{CaptureSession, CaptureStatus};
use super::metrics_service::{AssistantMetricsService, MetricEvent};

pub struct CaptureStore;

pub struct AssistantImportRecord<'a> {
    pub target: &'a str,
    pub target_id: &'a str,
    pub content_kind: &'a str,
    pub research_theme_id: Option<&'a str>,
    pub preserve_original: bool,
    pub retention_policy: &'a str,
    pub expires_at: Option<&'a str>,
    pub storage_location: &'a str,
    pub estimated_size_bytes: u64,
}

impl CaptureStore {
    /// Persist source metadata and state only. Raw text and screenshots never enter this table.
    pub async fn persist_metadata(db: &SqlitePool, session: &CaptureSession) -> Result<()> {
        sqlx::query(
            "INSERT INTO assistant_capture_sessions (
                id, source_type, content, screenshot_path, source_app,
                source_app_bundle_id, window_title, capture_region_x, capture_region_y,
                capture_region_width, capture_region_height, created_at, expires_at,
                status, user_confirmed
             ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                source_type = excluded.source_type,
                content = NULL,
                screenshot_path = NULL,
                source_app = excluded.source_app,
                source_app_bundle_id = excluded.source_app_bundle_id,
                window_title = excluded.window_title,
                capture_region_x = excluded.capture_region_x,
                capture_region_y = excluded.capture_region_y,
                capture_region_width = excluded.capture_region_width,
                capture_region_height = excluded.capture_region_height,
                expires_at = excluded.expires_at,
                status = excluded.status,
                user_confirmed = excluded.user_confirmed",
        )
        .bind(&session.id)
        .bind(session.source_type.as_str())
        .bind(limit_optional(session.source_app.as_deref(), 200))
        .bind(limit_optional(session.source_app_bundle_id.as_deref(), 255))
        .bind(limit_optional(session.window_title.as_deref(), 200))
        .bind(session.capture_region.as_ref().and_then(|region| region.x))
        .bind(session.capture_region.as_ref().and_then(|region| region.y))
        .bind(
            session
                .capture_region
                .as_ref()
                .map(|region| i64::from(region.width)),
        )
        .bind(
            session
                .capture_region
                .as_ref()
                .map(|region| i64::from(region.height)),
        )
        .bind(session.created_at.to_rfc3339())
        .bind(session.expires_at.to_rfc3339())
        .bind(session.status.as_str())
        .bind(i64::from(session.user_confirmed))
        .execute(db)
        .await?;

        // 匿名本地指标：只记录采集来源类型与结果状态；未开启统计时自动跳过。
        let metric_status = match session.status {
            CaptureStatus::Ready => Some("success"),
            CaptureStatus::Error => Some("error"),
            CaptureStatus::Blocked => Some("blocked"),
            _ => None,
        };
        if let Some(status) = metric_status {
            if let Ok(event) = MetricEvent::new(
                "capture",
                None,
                Some(session.source_type.as_str()),
                None,
                None,
                status,
            ) {
                AssistantMetricsService::record_quiet(db, event).await;
            }
        }
        Ok(())
    }

    pub async fn confirm(db: &SqlitePool, session_id: &str) -> Result<()> {
        let result = sqlx::query(
            "UPDATE assistant_capture_sessions
             SET status = 'confirmed', user_confirmed = 1, confirmed_at = datetime('now'),
                 content = NULL, screenshot_path = NULL
             WHERE id = ?",
        )
        .bind(session_id)
        .execute(db)
        .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("未找到对应的捕获会话"));
        }
        Ok(())
    }

    pub async fn require_confirmed(db: &SqlitePool, session_id: &str) -> Result<()> {
        let confirmed = sqlx::query_scalar::<_, i64>(
            "SELECT user_confirmed FROM assistant_capture_sessions WHERE id = ?",
        )
        .bind(session_id)
        .fetch_optional(db)
        .await?;
        match confirmed {
            Some(1) => Ok(()),
            Some(_) => Err(anyhow!("请先确认捕获内容")),
            None => Err(anyhow!("未找到对应的捕获会话")),
        }
    }

    /// 读取会话的采集来源类型，仅供匿名本地指标打点使用。
    pub async fn session_source_type(db: &SqlitePool, session_id: &str) -> Result<Option<String>> {
        let source_type = sqlx::query_scalar::<_, String>(
            "SELECT source_type FROM assistant_capture_sessions WHERE id = ?",
        )
        .bind(session_id)
        .fetch_optional(db)
        .await?;
        Ok(source_type)
    }

    pub async fn complete(db: &SqlitePool, session_id: &str) -> Result<()> {
        sqlx::query(
            "UPDATE assistant_capture_sessions
             SET status = 'completed', completed_at = datetime('now'),
                 content = NULL, screenshot_path = NULL
             WHERE id = ?",
        )
        .bind(session_id)
        .execute(db)
        .await?;
        Ok(())
    }

    pub async fn discard(db: &SqlitePool, session_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM assistant_capture_sessions WHERE id = ?")
            .bind(session_id)
            .execute(db)
            .await?;
        Ok(())
    }

    /// Copy durable provenance to the import record before the temporary session expires.
    pub async fn record_import(
        db: &SqlitePool,
        session_id: &str,
        record: AssistantImportRecord<'_>,
    ) -> Result<()> {
        let source = sqlx::query(
            "SELECT source_type, source_app, source_app_bundle_id, window_title, created_at,
                    capture_region_x, capture_region_y, capture_region_width, capture_region_height
             FROM assistant_capture_sessions WHERE id = ?",
        )
        .bind(session_id)
        .fetch_optional(db)
        .await?;

        let source_type = source
            .as_ref()
            .and_then(|row| row.try_get::<String, _>("source_type").ok());
        let source_app = source
            .as_ref()
            .and_then(|row| row.try_get::<String, _>("source_app").ok());
        let source_app_bundle_id = source
            .as_ref()
            .and_then(|row| row.try_get::<String, _>("source_app_bundle_id").ok());
        let window_title = source
            .as_ref()
            .and_then(|row| row.try_get::<String, _>("window_title").ok());
        let captured_at = source
            .as_ref()
            .and_then(|row| row.try_get::<String, _>("created_at").ok());
        let region_x = source
            .as_ref()
            .and_then(|row| row.try_get::<i64, _>("capture_region_x").ok());
        let region_y = source
            .as_ref()
            .and_then(|row| row.try_get::<i64, _>("capture_region_y").ok());
        let region_width = source
            .as_ref()
            .and_then(|row| row.try_get::<i64, _>("capture_region_width").ok());
        let region_height = source
            .as_ref()
            .and_then(|row| row.try_get::<i64, _>("capture_region_height").ok());

        sqlx::query(
            "INSERT INTO assistant_imports (
                id, session_id, target, target_id, content_preview, source_type,
                source_app, source_app_bundle_id, window_title, captured_at,
                capture_region_x, capture_region_y, capture_region_width, capture_region_height,
                research_interest_id, preserve_original, retention_policy, expires_at,
                storage_location, estimated_size_bytes, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(session_id)
        .bind(record.target)
        .bind(record.target_id)
        .bind(record.content_kind)
        .bind(source_type)
        .bind(source_app)
        .bind(source_app_bundle_id)
        .bind(window_title)
        .bind(captured_at)
        .bind(region_x)
        .bind(region_y)
        .bind(region_width)
        .bind(region_height)
        .bind(record.research_theme_id)
        .bind(record.preserve_original)
        .bind(record.retention_policy)
        .bind(record.expires_at)
        .bind(record.storage_location)
        .bind(i64::try_from(record.estimated_size_bytes).unwrap_or(i64::MAX))
        .execute(db)
        .await?;

        Self::complete(db, session_id).await
    }
}

fn limit_optional(value: Option<&str>, max_chars: usize) -> Option<String> {
    value.map(|value| value.chars().take(max_chars).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform::desktop_assistant::trait_platform::ScreenshotRegion;
    use crate::services::desktop_assistant::capture_service::{
        CaptureService, CaptureStatus, ContextSourceType,
    };

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query(
            "CREATE TABLE assistant_capture_sessions (
                id TEXT PRIMARY KEY, source_type TEXT NOT NULL, content TEXT,
                screenshot_path TEXT, source_app TEXT, source_app_bundle_id TEXT,
                window_title TEXT, capture_region_x INTEGER, capture_region_y INTEGER,
                capture_region_width INTEGER, capture_region_height INTEGER,
                created_at TEXT NOT NULL, expires_at TEXT,
                status TEXT NOT NULL, user_confirmed INTEGER NOT NULL,
                confirmed_at TEXT, completed_at TEXT
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TABLE assistant_imports (
                id TEXT PRIMARY KEY, session_id TEXT NOT NULL, target TEXT NOT NULL,
                target_id TEXT, content_preview TEXT, source_type TEXT, source_app TEXT,
                source_app_bundle_id TEXT, window_title TEXT, captured_at TEXT,
                capture_region_x INTEGER, capture_region_y INTEGER,
                capture_region_width INTEGER, capture_region_height INTEGER,
                research_interest_id TEXT, preserve_original INTEGER,
                retention_policy TEXT, expires_at TEXT, storage_location TEXT,
                estimated_size_bytes INTEGER,
                created_at TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn persists_metadata_without_raw_capture_content() {
        let pool = test_pool().await;
        let mut session = CaptureService::create_session(ContextSourceType::Selection, 24);
        session.content = Some("private raw text".to_string());
        session.screenshot_path = Some("/tmp/private.png".to_string());
        session.source_app = Some("Preview".to_string());
        session.capture_region = Some(ScreenshotRegion {
            x: None,
            y: None,
            width: 1440,
            height: 900,
        });
        session.status = CaptureStatus::Ready;

        CaptureStore::persist_metadata(&pool, &session)
            .await
            .unwrap();
        let row = sqlx::query(
            "SELECT content IS NULL AS content_is_null,
                    screenshot_path IS NULL AS screenshot_is_null,
                    source_app, status, capture_region_width, capture_region_height
             FROM assistant_capture_sessions WHERE id = ?",
        )
        .bind(&session.id)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(row.get::<i64, _>("content_is_null"), 1);
        assert_eq!(row.get::<i64, _>("screenshot_is_null"), 1);
        assert_eq!(row.get::<String, _>("source_app"), "Preview");
        assert_eq!(row.get::<String, _>("status"), "ready");
        assert_eq!(row.get::<i64, _>("capture_region_width"), 1440);
        assert_eq!(row.get::<i64, _>("capture_region_height"), 900);
    }

    #[tokio::test]
    async fn confirmed_import_copies_provenance_and_completes_session() {
        let pool = test_pool().await;
        let mut session = CaptureService::create_session(ContextSourceType::Clipboard, 24);
        session.source_app = Some("Safari".to_string());
        session.source_app_bundle_id = Some("com.apple.Safari".to_string());
        session.window_title = Some("Research paper".to_string());
        session.status = CaptureStatus::Ready;
        CaptureStore::persist_metadata(&pool, &session)
            .await
            .unwrap();
        CaptureStore::confirm(&pool, &session.id).await.unwrap();
        CaptureStore::record_import(
            &pool,
            &session.id,
            AssistantImportRecord {
                target: "note",
                target_id: "note-1",
                content_kind: "[text]",
                research_theme_id: None,
                preserve_original: false,
                retention_policy: "permanent",
                expires_at: None,
                storage_location: "local_database:knowledge_notes",
                estimated_size_bytes: 42,
            },
        )
        .await
        .unwrap();

        let source_app: String = sqlx::query_scalar("SELECT source_app FROM assistant_imports")
            .fetch_one(&pool)
            .await
            .unwrap();
        let status: String =
            sqlx::query_scalar("SELECT status FROM assistant_capture_sessions WHERE id = ?")
                .bind(&session.id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(source_app, "Safari");
        assert_eq!(status, "completed");
    }

    #[tokio::test]
    async fn rejects_unconfirmed_or_missing_capture_sessions() {
        let pool = test_pool().await;
        let mut session = CaptureService::create_session(ContextSourceType::Paste, 24);
        session.status = CaptureStatus::Ready;
        CaptureStore::persist_metadata(&pool, &session)
            .await
            .unwrap();

        assert!(CaptureStore::require_confirmed(&pool, &session.id)
            .await
            .is_err());
        assert!(CaptureStore::require_confirmed(&pool, "missing")
            .await
            .is_err());
    }
}

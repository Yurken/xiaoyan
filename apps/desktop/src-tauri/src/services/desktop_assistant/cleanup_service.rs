//! 清理服务
//!
//! 管理临时文件和过期会话的清理
//! 负责创建和维护助手相关的数据库表

use anyhow::Result;
use sqlx::{Row, SqlitePool};

use super::preference_service::AssistantPreferenceService;

/// 清理服务
pub struct CleanupService;

impl CleanupService {
    /// 初始化助手数据库表
    pub async fn init_tables(db: &SqlitePool) -> Result<()> {
        // 稍后处理箱表
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS assistant_later_items (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                session_id TEXT,
                research_interest_id TEXT,
                retention_policy TEXT,
                expires_at TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT
            )",
        )
        .execute(db)
        .await?;

        // 助手采集会话表
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS assistant_capture_sessions (
                id TEXT PRIMARY KEY,
                source_type TEXT NOT NULL,
                content TEXT,
                screenshot_path TEXT,
                source_app TEXT,
                source_app_bundle_id TEXT,
                window_title TEXT,
                capture_region_x INTEGER,
                capture_region_y INTEGER,
                capture_region_width INTEGER,
                capture_region_height INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                expires_at TEXT,
                status TEXT NOT NULL DEFAULT 'idle',
                user_confirmed INTEGER NOT NULL DEFAULT 0,
                confirmed_at TEXT,
                completed_at TEXT
            )",
        )
        .execute(db)
        .await?;

        // 助手导入记录表
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS assistant_imports (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                target TEXT NOT NULL,
                target_id TEXT,
                content_preview TEXT,
                source_type TEXT,
                source_app TEXT,
                source_app_bundle_id TEXT,
                window_title TEXT,
                captured_at TEXT,
                capture_region_x INTEGER,
                capture_region_y INTEGER,
                capture_region_width INTEGER,
                capture_region_height INTEGER,
                source_title TEXT,
                source_url TEXT,
                research_interest_id TEXT,
                preserve_original INTEGER NOT NULL DEFAULT 0,
                retention_policy TEXT,
                expires_at TEXT,
                storage_location TEXT,
                estimated_size_bytes INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
        )
        .execute(db)
        .await?;

        for (table, column, definition) in [
            ("assistant_capture_sessions", "confirmed_at", "TEXT"),
            ("assistant_capture_sessions", "completed_at", "TEXT"),
            ("assistant_capture_sessions", "capture_region_x", "INTEGER"),
            ("assistant_capture_sessions", "capture_region_y", "INTEGER"),
            (
                "assistant_capture_sessions",
                "capture_region_width",
                "INTEGER",
            ),
            (
                "assistant_capture_sessions",
                "capture_region_height",
                "INTEGER",
            ),
            ("assistant_imports", "source_type", "TEXT"),
            ("assistant_imports", "source_app", "TEXT"),
            ("assistant_imports", "source_app_bundle_id", "TEXT"),
            ("assistant_imports", "window_title", "TEXT"),
            ("assistant_imports", "captured_at", "TEXT"),
            ("assistant_imports", "capture_region_x", "INTEGER"),
            ("assistant_imports", "capture_region_y", "INTEGER"),
            ("assistant_imports", "capture_region_width", "INTEGER"),
            ("assistant_imports", "capture_region_height", "INTEGER"),
            ("assistant_imports", "source_title", "TEXT"),
            ("assistant_imports", "source_url", "TEXT"),
            ("assistant_imports", "research_interest_id", "TEXT"),
            (
                "assistant_imports",
                "preserve_original",
                "INTEGER NOT NULL DEFAULT 0",
            ),
            ("assistant_imports", "retention_policy", "TEXT"),
            ("assistant_imports", "expires_at", "TEXT"),
            ("assistant_imports", "storage_location", "TEXT"),
            ("assistant_imports", "estimated_size_bytes", "INTEGER"),
            ("assistant_later_items", "research_interest_id", "TEXT"),
            ("assistant_later_items", "retention_policy", "TEXT"),
            ("assistant_later_items", "expires_at", "TEXT"),
            (
                "assistant_later_items",
                "status",
                "TEXT NOT NULL DEFAULT 'pending'",
            ),
        ] {
            ensure_column(db, table, column, definition).await?;
        }

        // Older development builds could place capture bodies in these columns.
        // The 0.6.0 privacy contract keeps only source metadata and state.
        sqlx::query(
            "UPDATE assistant_capture_sessions
             SET content = NULL, screenshot_path = NULL
             WHERE content IS NOT NULL OR screenshot_path IS NOT NULL",
        )
        .execute(db)
        .await?;

        // 助手偏好设置表
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS assistant_preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
        )
        .execute(db)
        .await?;

        // 论文导入候选表
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS assistant_paper_candidates (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content_preview TEXT,
                file_path TEXT,
                file_size_bytes INTEGER,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                imported_at TEXT,
                imported_paper_id TEXT
            )",
        )
        .execute(db)
        .await?;

        for (column, definition) in [
            ("file_path", "TEXT"),
            ("file_size_bytes", "INTEGER"),
            ("imported_paper_id", "TEXT"),
        ] {
            ensure_column(db, "assistant_paper_candidates", column, definition).await?;
        }

        // 用户显式拖入的文件只保存候选元数据和受限生命周期内的规范化路径。
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS assistant_file_candidates (
                id TEXT PRIMARY KEY,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                kind TEXT NOT NULL,
                media_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                recommended_target TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'preview',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                expires_at TEXT NOT NULL,
                confirmed_at TEXT
            )",
        )
        .execute(db)
        .await?;

        // 文件中转站保存独立副本，避免源文件被移动或删除后中转项失效。
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS assistant_file_shelf_items (
                id TEXT PRIMARY KEY,
                file_name TEXT NOT NULL,
                stored_path TEXT NOT NULL,
                original_path TEXT,
                is_directory INTEGER NOT NULL DEFAULT 0,
                size_bytes INTEGER NOT NULL DEFAULT 0,
                source_type TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_copied_at TEXT
            )",
        )
        .execute(db)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_assistant_file_shelf_created
             ON assistant_file_shelf_items(created_at DESC)",
        )
        .execute(db)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS assistant_note_attachments (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                relative_path TEXT NOT NULL,
                media_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY(note_id) REFERENCES knowledge_notes(id) ON DELETE CASCADE
            )",
        )
        .execute(db)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_assistant_note_attachments_note
             ON assistant_note_attachments(note_id)",
        )
        .execute(db)
        .await?;

        // 匿名本地指标表：独立存储，不混入采集会话。
        super::metrics_service::AssistantMetricsService::init_tables(db).await?;

        Ok(())
    }

    /// 清理过期的采集会话
    pub async fn cleanup_expired_sessions(db: &SqlitePool) -> Result<u32> {
        let result = sqlx::query(
            "DELETE FROM assistant_capture_sessions
             WHERE expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')",
        )
        .execute(db)
        .await?;

        Ok(result.rows_affected() as u32)
    }

    /// 按用户配置清理过期的稍后处理项；`None` 表示仅手动清理。
    pub async fn cleanup_old_later_items(
        db: &SqlitePool,
        retention_days: Option<u16>,
    ) -> Result<u32> {
        let result = if let Some(days) = retention_days {
            let cutoff = format!("-{days} days");
            sqlx::query(
                "DELETE FROM assistant_later_items
                 WHERE (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now'))
                    OR (retention_policy IS NULL AND datetime(created_at) < datetime('now', ?))",
            )
            .bind(cutoff)
            .execute(db)
            .await?
        } else {
            sqlx::query(
                "DELETE FROM assistant_later_items
                 WHERE expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')",
            )
            .execute(db)
            .await?
        };

        Ok(result.rows_affected() as u32)
    }

    /// 用户主动清空稍后处理箱。
    pub async fn clear_later_items(db: &SqlitePool) -> Result<u32> {
        let result = sqlx::query("DELETE FROM assistant_later_items")
            .execute(db)
            .await?;
        Ok(result.rows_affected() as u32)
    }

    pub async fn cleanup_expired_file_candidates(db: &SqlitePool) -> Result<u32> {
        let result = sqlx::query(
            "DELETE FROM assistant_file_candidates
             WHERE datetime(expires_at) < datetime('now')",
        )
        .execute(db)
        .await?;
        Ok(result.rows_affected() as u32)
    }

    /// 清理所有临时数据
    pub async fn cleanup_all(db: &SqlitePool) -> Result<(u32, u32)> {
        let sessions = Self::cleanup_expired_sessions(db).await?;
        let file_candidates = Self::cleanup_expired_file_candidates(db).await?;
        let policy = AssistantPreferenceService::load_data_policy(db).await?;
        let later_items = Self::cleanup_old_later_items(db, policy.inbox_retention_days).await?;
        Ok((sessions.saturating_add(file_candidates), later_items))
    }
}

async fn ensure_column(db: &SqlitePool, table: &str, column: &str, definition: &str) -> Result<()> {
    let columns = sqlx::query(&format!("PRAGMA table_info({table})"))
        .fetch_all(db)
        .await?;
    let exists = columns
        .iter()
        .any(|row| row.get::<String, _>("name") == column);
    if !exists {
        sqlx::query(&format!(
            "ALTER TABLE {table} ADD COLUMN {column} {definition}"
        ))
        .execute(db)
        .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn upgrades_legacy_tables_and_scrubs_capture_bodies() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query(
            "CREATE TABLE assistant_capture_sessions (
                id TEXT PRIMARY KEY, source_type TEXT NOT NULL, content TEXT,
                screenshot_path TEXT, source_app TEXT, source_app_bundle_id TEXT,
                window_title TEXT, created_at TEXT NOT NULL, expires_at TEXT,
                status TEXT NOT NULL, user_confirmed INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TABLE assistant_imports (
                id TEXT PRIMARY KEY, session_id TEXT NOT NULL, target TEXT NOT NULL,
                target_id TEXT, content_preview TEXT, created_at TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO assistant_capture_sessions (
                id, source_type, content, screenshot_path, created_at, status, user_confirmed
             ) VALUES ('legacy', 'selection', 'private text', '/tmp/private.png',
                       datetime('now'), 'ready', 0)",
        )
        .execute(&pool)
        .await
        .unwrap();

        CleanupService::init_tables(&pool).await.unwrap();

        let columns: Vec<String> =
            sqlx::query_scalar("SELECT name FROM pragma_table_info('assistant_imports')")
                .fetch_all(&pool)
                .await
                .unwrap();
        let bodies_are_null: i64 = sqlx::query_scalar(
            "SELECT content IS NULL AND screenshot_path IS NULL
             FROM assistant_capture_sessions WHERE id = 'legacy'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert!(columns.contains(&"source_app_bundle_id".to_string()));
        assert!(columns.contains(&"captured_at".to_string()));
        assert!(columns.contains(&"research_interest_id".to_string()));
        assert!(columns.contains(&"storage_location".to_string()));
        assert!(columns.contains(&"estimated_size_bytes".to_string()));
        assert!(columns.contains(&"capture_region_width".to_string()));
        assert!(columns.contains(&"source_url".to_string()));
        let attachment_table_exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master
             WHERE type = 'table' AND name = 'assistant_note_attachments')",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(attachment_table_exists, 1);
        assert_eq!(bodies_are_null, 1);
    }

    #[tokio::test]
    async fn later_item_cleanup_respects_retention_and_manual_policy() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        CleanupService::init_tables(&pool).await.unwrap();
        for (id, created_at) in [
            ("expired", "datetime('now', '-8 days')"),
            ("recent", "datetime('now', '-2 days')"),
        ] {
            sqlx::query(&format!(
                "INSERT INTO assistant_later_items (id, title, content, created_at)
                 VALUES (?, 'title', 'content', {created_at})"
            ))
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
        }
        sqlx::query(
            "INSERT INTO assistant_later_items (
                id, title, content, retention_policy, expires_at, created_at
             ) VALUES ('per-item-expired', 'title', 'content', '1_day',
                       datetime('now', '-1 hour'), datetime('now')),
                      ('manual', 'title', 'content', 'manual', NULL, datetime('now', '-30 days'))",
        )
        .execute(&pool)
        .await
        .unwrap();

        assert_eq!(
            CleanupService::cleanup_old_later_items(&pool, None)
                .await
                .unwrap(),
            1
        );
        assert_eq!(
            CleanupService::cleanup_old_later_items(&pool, Some(7))
                .await
                .unwrap(),
            1
        );
        let mut remaining: Vec<String> = sqlx::query_scalar("SELECT id FROM assistant_later_items")
            .fetch_all(&pool)
            .await
            .unwrap();
        remaining.sort();
        assert_eq!(remaining, vec!["manual", "recent"]);
    }

    #[tokio::test]
    async fn expired_file_candidates_are_removed_without_touching_current_candidates() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        CleanupService::init_tables(&pool).await.unwrap();
        for (id, expires_at) in [
            ("expired", "datetime('now', '-1 hour')"),
            ("current", "datetime('now', '+1 hour')"),
        ] {
            sqlx::query(&format!(
                "INSERT INTO assistant_file_candidates (
                    id, file_path, file_name, kind, media_type, size_bytes,
                    recommended_target, expires_at
                 ) VALUES (?, '/tmp/file.txt', 'file.txt', 'text', 'text/plain',
                           4, 'note', {expires_at})"
            ))
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
        }

        assert_eq!(
            CleanupService::cleanup_expired_file_candidates(&pool)
                .await
                .unwrap(),
            1
        );
        let remaining: Vec<String> = sqlx::query_scalar("SELECT id FROM assistant_file_candidates")
            .fetch_all(&pool)
            .await
            .unwrap();
        assert_eq!(remaining, vec!["current"]);
    }
}

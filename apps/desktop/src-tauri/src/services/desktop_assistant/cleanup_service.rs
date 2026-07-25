//! 清理服务
//!
//! 管理临时文件和过期会话的清理
//! 负责创建和维护助手相关的数据库表

use anyhow::Result;
use sqlx::SqlitePool;

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
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT
            )"
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
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                expires_at TEXT,
                status TEXT NOT NULL DEFAULT 'idle',
                user_confirmed INTEGER NOT NULL DEFAULT 0
            )"
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
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )"
        )
        .execute(db)
        .await?;

        // 助手偏好设置表
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS assistant_preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )"
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
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                imported_at TEXT
            )"
        )
        .execute(db)
        .await?;

        Ok(())
    }

    /// 清理过期的采集会话
    pub async fn cleanup_expired_sessions(db: &SqlitePool) -> Result<u32> {
        let result = sqlx::query(
            "DELETE FROM assistant_capture_sessions WHERE expires_at < datetime('now')"
        )
        .execute(db)
        .await?;

        Ok(result.rows_affected() as u32)
    }

    /// 清理过期的稍后处理项（超过 30 天）
    pub async fn cleanup_old_later_items(db: &SqlitePool) -> Result<u32> {
        let result = sqlx::query(
            "DELETE FROM assistant_later_items WHERE created_at < datetime('now', '-30 days')"
        )
        .execute(db)
        .await?;

        Ok(result.rows_affected() as u32)
    }

    /// 清理所有临时数据
    pub async fn cleanup_all(db: &SqlitePool) -> Result<(u32, u32)> {
        let sessions = Self::cleanup_expired_sessions(db).await?;
        let later_items = Self::cleanup_old_later_items(db).await?;
        Ok((sessions, later_items))
    }

    /// 获取临时数据统计
    pub async fn get_stats(db: &SqlitePool) -> Result<CleanupStats> {
        let sessions: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM assistant_capture_sessions"
        )
        .fetch_one(db)
        .await?;

        let expired_sessions: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM assistant_capture_sessions WHERE expires_at < datetime('now')"
        )
        .fetch_one(db)
        .await?;

        let later_items: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM assistant_later_items"
        )
        .fetch_one(db)
        .await?;

        Ok(CleanupStats {
            total_sessions: sessions.0 as u32,
            expired_sessions: expired_sessions.0 as u32,
            later_items: later_items.0 as u32,
        })
    }
}

/// 清理统计
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CleanupStats {
    pub total_sessions: u32,
    pub expired_sessions: u32,
    pub later_items: u32,
}

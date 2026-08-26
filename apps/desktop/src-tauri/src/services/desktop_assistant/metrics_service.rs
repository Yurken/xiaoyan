//! 匿名本地指标服务
//!
//! 对应 PRD §4.3：匿名、可关闭的本地事件统计。
//! 只落库动作类别、采集来源类型、耗时、结果状态等结构化字段，
//! 表结构和写入入口都不接受正文、OCR 文本、窗口标题、截图内容或应用标题。
//! 默认关闭，与助手专属诊断日志一致遵循隐私优先惯例。

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

const METRICS_ENABLED_KEY: &str = "metrics_enabled";
const MAX_DURATION_MS: u64 = 24 * 60 * 60 * 1_000;
const MIN_OVERVIEW_DAYS: u16 = 1;
const MAX_OVERVIEW_DAYS: u16 = 90;
pub const DEFAULT_OVERVIEW_DAYS: u16 = 28;

const VALID_EVENT_TYPES: &[&str] = &["capture", "action", "copy", "import"];
const VALID_ACTIONS: &[&str] = &["interpret", "translate", "chat", "extract_text"];
const VALID_SOURCE_TYPES: &[&str] = &["selection", "clipboard", "screenshot", "paste"];
const VALID_IMPORT_TARGETS: &[&str] = &["note", "image", "paper", "later"];
const VALID_STATUSES: &[&str] = &["success", "error", "blocked", "cancelled"];

/// 一条匿名指标事件。字段集合是隐私边界：没有也不允许出现内容载荷字段。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MetricEvent {
    pub event_type: String,
    pub action: Option<String>,
    pub source_type: Option<String>,
    pub target: Option<String>,
    pub duration_ms: Option<u64>,
    pub status: String,
}

impl MetricEvent {
    /// 校验并构造事件；任何白名单外的类别值都会被拒绝，避免自由文本落库。
    pub fn new(
        event_type: &str,
        action: Option<&str>,
        source_type: Option<&str>,
        target: Option<&str>,
        duration_ms: Option<u64>,
        status: &str,
    ) -> Result<Self> {
        if !VALID_EVENT_TYPES.contains(&event_type) {
            return Err(anyhow!("不支持的指标事件类别"));
        }
        if let Some(action) = action {
            if !VALID_ACTIONS.contains(&action) {
                return Err(anyhow!("不支持的指标动作类别"));
            }
        }
        if let Some(source_type) = source_type {
            if !VALID_SOURCE_TYPES.contains(&source_type) {
                return Err(anyhow!("不支持的指标采集来源类型"));
            }
        }
        if let Some(target) = target {
            if !VALID_IMPORT_TARGETS.contains(&target) {
                return Err(anyhow!("不支持的指标导入目标"));
            }
        }
        if !VALID_STATUSES.contains(&status) {
            return Err(anyhow!("不支持的指标结果状态"));
        }
        Ok(Self {
            event_type: event_type.to_string(),
            action: action.map(str::to_string),
            source_type: source_type.map(str::to_string),
            target: target.map(str::to_string),
            duration_ms: duration_ms.map(|value| value.min(MAX_DURATION_MS)),
            status: status.to_string(),
        })
    }

    pub fn action_result(action: &str, source_type: Option<&str>, duration_ms: u64, ok: bool) -> Self {
        Self {
            event_type: "action".to_string(),
            action: Some(action.to_string()),
            source_type: source_type.map(str::to_string),
            target: None,
            duration_ms: Some(duration_ms.min(MAX_DURATION_MS)),
            status: if ok { "success" } else { "error" }.to_string(),
        }
    }
}

/// 按天聚合的指标计数，用于 KR 统计与设置区概览。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MetricsDailyBucket {
    pub day: String,
    pub event_type: String,
    pub status: String,
    pub count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantMetricsPreferences {
    pub enabled: bool,
}

impl Default for AssistantMetricsPreferences {
    fn default() -> Self {
        // 隐私优先：匿名统计默认关闭，由用户显式开启。
        Self { enabled: false }
    }
}

pub struct AssistantMetricsService;

impl AssistantMetricsService {
    /// 独立指标表，不混入 capture_sessions；随助手表初始化一并创建。
    pub async fn init_tables(db: &SqlitePool) -> Result<()> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS assistant_metric_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                action TEXT,
                source_type TEXT,
                target TEXT,
                duration_ms INTEGER,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
        )
        .execute(db)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_assistant_metric_events_created
             ON assistant_metric_events(created_at)",
        )
        .execute(db)
        .await?;
        Ok(())
    }

    pub async fn load_preferences(db: &SqlitePool) -> Result<AssistantMetricsPreferences> {
        let value: Option<String> =
            sqlx::query_scalar("SELECT value FROM assistant_preferences WHERE key = ?")
                .bind(METRICS_ENABLED_KEY)
                .fetch_optional(db)
                .await?;
        Ok(AssistantMetricsPreferences {
            enabled: value
                .as_deref()
                .and_then(|value| value.parse::<bool>().ok())
                .unwrap_or(false),
        })
    }

    pub async fn save_preferences(
        db: &SqlitePool,
        enabled: bool,
    ) -> Result<AssistantMetricsPreferences> {
        sqlx::query(
            "INSERT INTO assistant_preferences (key, value, updated_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at",
        )
        .bind(METRICS_ENABLED_KEY)
        .bind(enabled.to_string())
        .execute(db)
        .await?;
        // 关闭统计时同步清空历史事件，避免留存用户已要求停止的数据。
        if !enabled {
            Self::clear(db).await?;
        }
        Ok(AssistantMetricsPreferences { enabled })
    }

    /// 记录一条事件；未开启统计时不写入。指标失败不应阻断主流程，调用方可忽略错误。
    pub async fn record(db: &SqlitePool, event: MetricEvent) -> Result<()> {
        if !Self::load_preferences(db).await?.enabled {
            return Ok(());
        }
        sqlx::query(
            "INSERT INTO assistant_metric_events (
                event_type, action, source_type, target, duration_ms, status
             ) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&event.event_type)
        .bind(&event.action)
        .bind(&event.source_type)
        .bind(&event.target)
        .bind(event.duration_ms.map(|value| value.min(i64::MAX as u64) as i64))
        .bind(&event.status)
        .execute(db)
        .await?;
        Ok(())
    }

    /// 与 [`Self::record`] 相同，但任何失败（含历史库缺少指标表）都只返回 false，
    /// 供采集/动作主路径以 `let _ =` 方式安全打点。
    pub async fn record_quiet(db: &SqlitePool, event: MetricEvent) -> bool {
        Self::record(db, event).await.is_ok()
    }

    /// 按天聚合并按事件类别与结果状态分组，供 KR 统计与设置区概览使用。
    pub async fn daily_overview(db: &SqlitePool, days: u16) -> Result<Vec<MetricsDailyBucket>> {
        let days = days.clamp(MIN_OVERVIEW_DAYS, MAX_OVERVIEW_DAYS);
        let rows = sqlx::query(
            "SELECT date(created_at) AS day, event_type, status, COUNT(*) AS count
             FROM assistant_metric_events
             WHERE datetime(created_at) >= datetime('now', ?)
             GROUP BY day, event_type, status
             ORDER BY day, event_type, status",
        )
        .bind(format!("-{days} days"))
        .fetch_all(db)
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| MetricsDailyBucket {
                day: row.get("day"),
                event_type: row.get("event_type"),
                status: row.get("status"),
                count: row.get::<i64, _>("count").max(0) as u32,
            })
            .collect())
    }

    /// 清空全部本地指标，供“一键清除助手私有数据”流程复用。
    pub async fn clear(db: &SqlitePool) -> Result<u32> {
        let result = sqlx::query("DELETE FROM assistant_metric_events")
            .execute(db)
            .await?;
        Ok(result.rows_affected().min(u32::MAX as u64) as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn setup() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query(
            "CREATE TABLE assistant_preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        AssistantMetricsService::init_tables(&pool).await.unwrap();
        pool
    }

    #[test]
    fn event_payload_only_contains_structured_fields() {
        let event = MetricEvent::new(
            "action",
            Some("interpret"),
            Some("selection"),
            None,
            Some(1_234),
            "success",
        )
        .unwrap();
        let payload = serde_json::to_value(&event).unwrap();
        let keys: Vec<&str> = payload
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        // 隐私边界：载荷只允许结构化字段，禁止正文、OCR 文本、窗口标题等内容键。
        for key in &keys {
            assert!(
                [
                    "event_type",
                    "action",
                    "source_type",
                    "target",
                    "duration_ms",
                    "status"
                ]
                .contains(key),
                "unexpected payload field: {key}"
            );
        }
        let serialized = payload.to_string();
        for forbidden in ["content", "text", "title", "screenshot", "ocr", "window"] {
            assert!(
                !serialized.contains(forbidden),
                "payload leaks content-like field: {forbidden}"
            );
        }
    }

    #[test]
    fn event_validation_rejects_free_form_values() {
        assert!(MetricEvent::new("note_content", None, None, None, None, "success").is_err());
        assert!(MetricEvent::new("action", Some("正文内容"), None, None, None, "success").is_err());
        assert!(MetricEvent::new("action", Some("chat"), Some("窗口标题"), None, None, "success").is_err());
        assert!(MetricEvent::new("import", None, None, Some("用户输入"), None, "success").is_err());
        assert!(MetricEvent::new("action", Some("chat"), None, None, None, "模型回答").is_err());
    }

    #[test]
    fn duration_is_clamped_to_a_day() {
        let event = MetricEvent::new("action", Some("chat"), None, None, Some(u64::MAX), "success")
            .unwrap();
        assert_eq!(event.duration_ms, Some(MAX_DURATION_MS));
    }

    #[test]
    fn extract_text_action_is_whitelisted() {
        let event = MetricEvent::action_result("extract_text", Some("screenshot"), 120, true);
        assert_eq!(event.action.as_deref(), Some("extract_text"));
        let validated = MetricEvent::new(
            "action",
            Some("extract_text"),
            Some("screenshot"),
            None,
            Some(120),
            "success",
        )
        .unwrap();
        assert_eq!(validated, event);
    }

    #[tokio::test]
    async fn metrics_default_disabled_and_record_is_a_no_op_until_enabled() {
        let pool = setup().await;
        assert!(!AssistantMetricsService::load_preferences(&pool)
            .await
            .unwrap()
            .enabled);

        AssistantMetricsService::record(
            &pool,
            MetricEvent::new("action", Some("chat"), None, None, Some(42), "success").unwrap(),
        )
        .await
        .unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assistant_metric_events")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);

        AssistantMetricsService::save_preferences(&pool, true)
            .await
            .unwrap();
        AssistantMetricsService::record(
            &pool,
            MetricEvent::new("action", Some("chat"), None, None, Some(42), "success").unwrap(),
        )
        .await
        .unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assistant_metric_events")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn disabling_metrics_clears_stored_events() {
        let pool = setup().await;
        AssistantMetricsService::save_preferences(&pool, true)
            .await
            .unwrap();
        AssistantMetricsService::record(
            &pool,
            MetricEvent::new("copy", None, None, None, None, "success").unwrap(),
        )
        .await
        .unwrap();

        AssistantMetricsService::save_preferences(&pool, false)
            .await
            .unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assistant_metric_events")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn daily_overview_groups_by_day_event_type_and_status() {
        let pool = setup().await;
        AssistantMetricsService::save_preferences(&pool, true)
            .await
            .unwrap();
        for (event_type, action, status) in [
            ("capture", None, "success"),
            ("action", Some("interpret"), "success"),
            ("action", Some("interpret"), "error"),
            ("import", None, "success"),
        ] {
            AssistantMetricsService::record(
                &pool,
                MetricEvent::new(event_type, action, None, None, None, status).unwrap(),
            )
            .await
            .unwrap();
        }
        // 超出窗口的旧事件不计入概览。
        sqlx::query(
            "INSERT INTO assistant_metric_events (event_type, status, created_at)
             VALUES ('copy', 'success', datetime('now', '-40 days'))",
        )
        .execute(&pool)
        .await
        .unwrap();

        let overview = AssistantMetricsService::daily_overview(&pool, DEFAULT_OVERVIEW_DAYS)
            .await
            .unwrap();
        assert_eq!(overview.len(), 4);
        assert!(overview
            .iter()
            .all(|bucket| !bucket.day.is_empty() && bucket.count == 1));
        let interpret_error = overview
            .iter()
            .find(|bucket| bucket.event_type == "action" && bucket.status == "error")
            .unwrap();
        assert_eq!(interpret_error.count, 1);

        // 90 天窗口能看到旧事件；天数入参被钳制在有效范围内。
        let wide = AssistantMetricsService::daily_overview(&pool, u16::MAX)
            .await
            .unwrap();
        assert_eq!(wide.len(), 5);
    }

    #[tokio::test]
    async fn clear_removes_all_events() {
        let pool = setup().await;
        AssistantMetricsService::save_preferences(&pool, true)
            .await
            .unwrap();
        for status in ["success", "error"] {
            AssistantMetricsService::record(
                &pool,
                MetricEvent::new("action", Some("translate"), None, None, None, status).unwrap(),
            )
            .await
            .unwrap();
        }
        assert_eq!(AssistantMetricsService::clear(&pool).await.unwrap(), 2);
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assistant_metric_events")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
    }
}

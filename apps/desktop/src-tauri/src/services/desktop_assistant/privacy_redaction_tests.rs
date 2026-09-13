//! 日志与埋点载荷的自动化脱敏抽样测试（PRD §7.2 F5 / 状态文档 F5）。
//!
//! 用包含正文、OCR 文本、窗口标题、截图路径与敏感片段（邮箱/手机号/Key）的
//! 样例数据走一遍采集、落库与指标记录路径，断言写入指标表、导入记录与
//! 确认流程的输出都不含内容载荷。窗口标题按设计属于用户可选择保留的来源
//! 元数据（`window_title_enabled` 默认关闭），只允许出现在采集/导入记录的
//! 来源字段中，绝不进入匿名指标。

use sqlx::{Column, Row, SqlitePool};

use super::capture_service::{CaptureService, CaptureStatus, ContextSourceType};
use super::capture_store::{AssistantImportRecord, CaptureStore};
use super::cleanup_service::CleanupService;
use super::content_policy::retained_window_title;
use super::metrics_service::{AssistantMetricsService, MetricEvent};

/// 敏感样例片段：任何日志、埋点、诊断输出都不允许出现这些子串。
const SENSITIVE_CONTENT: &str = "正文：合同金额 100 万，联系人 researcher@example.com";
const SENSITIVE_OCR: &str = "OCR 识别结果：验证码 8842，手机号 13800138000";
const SENSITIVE_KEY: &str = "sk-live-secret-key-1234567890";
const SENSITIVE_WINDOW_TITLE: &str = "机密文档 - 2026 工资表.xlsx";
const SENSITIVE_SCREENSHOT_PATH: &str = "/private/tmp/xiaoyan-shot-8842.png";

const FORBIDDEN_FRAGMENTS: &[&str] = &[
    SENSITIVE_CONTENT,
    SENSITIVE_OCR,
    SENSITIVE_KEY,
    SENSITIVE_WINDOW_TITLE,
    SENSITIVE_SCREENSHOT_PATH,
    // 关键子串单独断言，避免整句被截断后漏检。
    "researcher@example.com",
    "13800138000",
    "sk-live-secret-key",
];

async fn test_pool() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    CleanupService::init_tables(&pool).await.unwrap();
    pool
}

fn assert_no_forbidden_fragments(channel: &str, output: &str) {
    for fragment in FORBIDDEN_FRAGMENTS {
        assert!(
            !output.contains(fragment),
            "{channel} 泄漏敏感片段: {fragment}"
        );
    }
}

async fn dump_table(pool: &SqlitePool, table: &str) -> String {
    let rows = sqlx::query(&format!("SELECT * FROM {table}"))
        .fetch_all(pool)
        .await
        .unwrap();
    let mut dump = String::new();
    for row in rows {
        for (index, column) in row.columns().iter().enumerate() {
            let value: Option<String> = row.try_get(index).ok();
            dump.push_str(&format!("{}={:?};", column.name(), value));
        }
        dump.push('\n');
    }
    dump
}

fn sensitive_session(status: CaptureStatus) -> super::capture_service::CaptureSession {
    let mut session = CaptureService::create_session(ContextSourceType::Selection, 24);
    session.content = Some(format!("{SENSITIVE_CONTENT} {SENSITIVE_KEY}"));
    session.screenshot_path = Some(SENSITIVE_SCREENSHOT_PATH.to_string());
    session.window_title = retained_window_title(true, Some(SENSITIVE_WINDOW_TITLE));
    session.source_app = Some("Preview".to_string());
    session.source_app_bundle_id = Some("com.apple.Preview".to_string());
    session.status = status;
    session
}

#[tokio::test]
async fn capture_persistence_drops_content_payload_but_keeps_provenance() {
    let pool = test_pool().await;
    let session = sensitive_session(CaptureStatus::Ready);

    CaptureStore::persist_metadata(&pool, &session).await.unwrap();

    let row = sqlx::query(
        "SELECT content, screenshot_path, source_app, window_title
         FROM assistant_capture_sessions WHERE id = ?",
    )
    .bind(&session.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(row.get::<Option<String>, _>("content").is_none());
    assert!(row.get::<Option<String>, _>("screenshot_path").is_none());
    // 来源元数据按设计保留（窗口标题需用户显式开启）。
    assert_eq!(row.get::<Option<String>, _>("source_app").as_deref(), Some("Preview"));
    assert_eq!(
        row.get::<Option<String>, _>("window_title").as_deref(),
        Some(SENSITIVE_WINDOW_TITLE)
    );

    let dump = dump_table(&pool, "assistant_capture_sessions").await;
    assert_no_forbidden_fragments("capture session 落库", &dump.replace(SENSITIVE_WINDOW_TITLE, ""));
    for fragment in [SENSITIVE_CONTENT, SENSITIVE_OCR, SENSITIVE_KEY, SENSITIVE_SCREENSHOT_PATH] {
        assert!(!dump.contains(fragment), "capture 落库泄漏: {fragment}");
    }
}

#[tokio::test]
async fn metrics_pipeline_records_only_structured_fields() {
    let pool = test_pool().await;
    AssistantMetricsService::save_preferences(&pool, true).await.unwrap();

    for status in [CaptureStatus::Ready, CaptureStatus::Error, CaptureStatus::Blocked] {
        let session = sensitive_session(status);
        CaptureStore::persist_metadata(&pool, &session).await.unwrap();
    }
    AssistantMetricsService::record(
        &pool,
        MetricEvent::action_result("interpret", Some("selection"), 123, true),
    )
    .await
    .unwrap();

    let dump = dump_table(&pool, "assistant_metric_events").await;
    assert!(!dump.is_empty());
    assert_no_forbidden_fragments("匿名指标", &dump);

    let overview = AssistantMetricsService::daily_overview(&pool, 28).await.unwrap();
    let serialized = serde_json::to_string(&overview).unwrap();
    assert_no_forbidden_fragments("指标概览", &serialized);
}

#[tokio::test]
async fn import_record_never_carries_content_or_screenshot_payload() {
    let pool = test_pool().await;
    let session = sensitive_session(CaptureStatus::Ready);
    CaptureStore::persist_metadata(&pool, &session).await.unwrap();
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
            estimated_size_bytes: 512,
        },
    )
    .await
    .unwrap();

    let dump = dump_table(&pool, "assistant_imports").await;
    for fragment in [
        SENSITIVE_CONTENT,
        SENSITIVE_OCR,
        SENSITIVE_KEY,
        SENSITIVE_SCREENSHOT_PATH,
    ] {
        assert!(!dump.contains(fragment), "导入记录泄漏: {fragment}");
    }
    // content_preview 只保存内容类别标签，不是正文。
    let preview: Option<String> =
        sqlx::query_scalar("SELECT content_preview FROM assistant_imports")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(preview.as_deref(), Some("[text]"));
}

#[test]
fn metric_event_validation_rejects_sensitive_free_form_values() {
    for fragment in FORBIDDEN_FRAGMENTS {
        assert!(MetricEvent::new(fragment, None, None, None, None, "success").is_err());
        assert!(MetricEvent::new("action", Some(fragment), None, None, None, "success").is_err());
        assert!(MetricEvent::new("action", Some("chat"), Some(fragment), None, None, "success").is_err());
        assert!(MetricEvent::new("import", None, None, Some(fragment), None, "success").is_err());
        assert!(MetricEvent::new("action", Some("chat"), None, None, None, fragment).is_err());
    }
}

#[test]
fn confirmation_flow_redacts_or_blocks_sensitive_fragments() {
    // 邮箱/手机号：默认遮盖，返回内容不含原值。
    let redacted = CaptureService::prepare_confirmation(
        "联系 researcher@example.com 或 13800138000",
    );
    assert!(!redacted.confirmed);
    let content = redacted.content.unwrap();
    assert!(!content.contains("researcher@example.com"));
    assert!(!content.contains("13800138000"));

    // 口令类内容：直接阻断，不返回任何内容。
    let blocked = CaptureService::prepare_confirmation("password: sk-live-secret-key-1234567890");
    assert!(!blocked.confirmed);
    assert!(blocked.content.is_none());
    assert!(blocked.privacy_check.content_sensitive);

    // 阻断原因不携带原始内容。
    if let Some(reason) = blocked.privacy_check.reason {
        assert_no_forbidden_fragments("阻断原因", &reason);
    }
}

#[tokio::test]
async fn window_title_is_never_persisted_when_retention_disabled() {
    let pool = test_pool().await;
    let mut session = sensitive_session(CaptureStatus::Ready);
    session.window_title = retained_window_title(false, Some(SENSITIVE_WINDOW_TITLE));
    CaptureStore::persist_metadata(&pool, &session).await.unwrap();

    let stored: Option<String> = sqlx::query_scalar(
        "SELECT window_title FROM assistant_capture_sessions WHERE id = ?",
    )
    .bind(&session.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(stored.is_none());
    let dump = dump_table(&pool, "assistant_capture_sessions").await;
    assert!(
        !dump.contains(SENSITIVE_WINDOW_TITLE),
        "窗口标题保留关闭时落库泄漏标题"
    );
}

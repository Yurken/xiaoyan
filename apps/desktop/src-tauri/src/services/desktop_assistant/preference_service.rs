//! 桌面助手偏好设置
//!
//! 与通用模型设置隔离，负责应用级隐私规则的校验和持久化。

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

const ALLOWED_APPS_KEY: &str = "allowed_apps";
const BLOCKED_APPS_KEY: &str = "blocked_apps";
const WINDOW_TITLE_ENABLED_KEY: &str = "window_title_enabled";
const PREVIEW_REQUIRED_KEY: &str = "preview_required";
const INBOX_RETENTION_DAYS_KEY: &str = "inbox_retention_days";
const PERMISSION_GUIDE_COMPLETED_KEY: &str = "permission_guide_completed";
const SHORTCUT_DIAGNOSTIC_KEY: &str = "shortcut_diagnostic";
const ASSISTANT_ENABLED_KEY: &str = "assistant_enabled";
const DIAGNOSTIC_LOGGING_ENABLED_KEY: &str = "diagnostic_logging_enabled";
const TRANSLATION_TARGET_LANGUAGE_KEY: &str = "translation_target_language";
const TRANSLATION_TERMINOLOGY_STYLE_KEY: &str = "translation_terminology_style";
const MAX_APP_RULES: usize = 100;
const MAX_BUNDLE_ID_LEN: usize = 200;
const DEFAULT_INBOX_RETENTION_DAYS: u16 = 7;
const VALID_INBOX_RETENTION_DAYS: &[u16] = &[1, 7, 30];
const VALID_TRANSLATION_TARGET_LANGUAGES: &[&str] = &["zh", "en", "ja", "de", "fr"];
const VALID_TRANSLATION_TERMINOLOGY_STYLES: &[&str] = &["bilingual", "translated", "original"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantPrivacyPreferences {
    pub allowed_apps: Vec<String>,
    pub blocked_apps: Vec<String>,
    pub window_title_enabled: bool,
}

impl Default for AssistantPrivacyPreferences {
    fn default() -> Self {
        Self {
            allowed_apps: Vec::new(),
            blocked_apps: Vec::new(),
            window_title_enabled: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantDataPolicy {
    pub preview_required: bool,
    /// `None` 表示不自动清理，由用户手动清理稍后处理箱。
    pub inbox_retention_days: Option<u16>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantOnboardingState {
    pub permission_guide_completed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantShortcutDiagnostic {
    pub status: String,
    pub requested_shortcut: String,
    pub active_shortcut: Option<String>,
    pub message: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantRuntimePreferences {
    pub enabled: bool,
    pub diagnostic_logging_enabled: bool,
}

impl Default for AssistantRuntimePreferences {
    fn default() -> Self {
        Self {
            enabled: true,
            diagnostic_logging_enabled: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantTranslationPreferences {
    pub target_language: String,
    pub terminology_style: String,
}

impl Default for AssistantTranslationPreferences {
    fn default() -> Self {
        Self {
            target_language: "zh".to_string(),
            terminology_style: "bilingual".to_string(),
        }
    }
}

impl Default for AssistantDataPolicy {
    fn default() -> Self {
        Self {
            preview_required: true,
            inbox_retention_days: Some(DEFAULT_INBOX_RETENTION_DAYS),
        }
    }
}

pub struct AssistantPreferenceService;

impl AssistantPreferenceService {
    pub async fn load_privacy(db: &SqlitePool) -> Result<AssistantPrivacyPreferences> {
        let rows = sqlx::query(
            "SELECT key, value
             FROM assistant_preferences
             WHERE key IN (?, ?, ?)",
        )
        .bind(ALLOWED_APPS_KEY)
        .bind(BLOCKED_APPS_KEY)
        .bind(WINDOW_TITLE_ENABLED_KEY)
        .fetch_all(db)
        .await?;

        let mut preferences = AssistantPrivacyPreferences::default();
        for row in rows {
            let key: String = row.get("key");
            let value: String = row.get("value");
            let items = serde_json::from_str::<Vec<String>>(&value).unwrap_or_default();
            match key.as_str() {
                ALLOWED_APPS_KEY => preferences.allowed_apps = items,
                BLOCKED_APPS_KEY => preferences.blocked_apps = items,
                WINDOW_TITLE_ENABLED_KEY => {
                    preferences.window_title_enabled = value.parse::<bool>().unwrap_or(false);
                }
                _ => {}
            }
        }
        Ok(preferences)
    }

    pub async fn save_privacy(
        db: &SqlitePool,
        allowed_apps: Vec<String>,
        blocked_apps: Vec<String>,
        window_title_enabled: bool,
    ) -> Result<AssistantPrivacyPreferences> {
        let preferences = AssistantPrivacyPreferences {
            allowed_apps: normalize_app_rules(allowed_apps)?,
            blocked_apps: normalize_app_rules(blocked_apps)?,
            window_title_enabled,
        };
        let allowed_json = serde_json::to_string(&preferences.allowed_apps)?;
        let blocked_json = serde_json::to_string(&preferences.blocked_apps)?;
        let mut transaction = db.begin().await?;

        for (key, value) in [
            (ALLOWED_APPS_KEY, allowed_json),
            (BLOCKED_APPS_KEY, blocked_json),
            (
                WINDOW_TITLE_ENABLED_KEY,
                preferences.window_title_enabled.to_string(),
            ),
        ] {
            sqlx::query(
                "INSERT INTO assistant_preferences (key, value, updated_at)
                 VALUES (?, ?, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at",
            )
            .bind(key)
            .bind(value)
            .execute(&mut *transaction)
            .await?;
        }

        if !preferences.window_title_enabled {
            for (table, statement) in [
                (
                    "assistant_capture_sessions",
                    "UPDATE assistant_capture_sessions SET window_title = NULL",
                ),
                (
                    "assistant_imports",
                    "UPDATE assistant_imports SET window_title = NULL",
                ),
            ] {
                let exists: i64 = sqlx::query_scalar(
                    "SELECT EXISTS(
                        SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?
                     )",
                )
                .bind(table)
                .fetch_one(&mut *transaction)
                .await?;
                if exists == 1 {
                    sqlx::query(statement).execute(&mut *transaction).await?;
                }
            }
        }

        transaction.commit().await?;
        Ok(preferences)
    }

    pub async fn load_data_policy(db: &SqlitePool) -> Result<AssistantDataPolicy> {
        let rows = sqlx::query(
            "SELECT key, value
             FROM assistant_preferences
             WHERE key IN (?, ?)",
        )
        .bind(PREVIEW_REQUIRED_KEY)
        .bind(INBOX_RETENTION_DAYS_KEY)
        .fetch_all(db)
        .await?;

        let mut policy = AssistantDataPolicy::default();
        for row in rows {
            let key: String = row.get("key");
            let value: String = row.get("value");
            match key.as_str() {
                PREVIEW_REQUIRED_KEY => {
                    policy.preview_required = value.parse::<bool>().unwrap_or(true);
                }
                INBOX_RETENTION_DAYS_KEY if value == "manual" => {
                    policy.inbox_retention_days = None;
                }
                INBOX_RETENTION_DAYS_KEY => {
                    policy.inbox_retention_days = value
                        .parse::<u16>()
                        .ok()
                        .filter(|days| VALID_INBOX_RETENTION_DAYS.contains(days))
                        .or(Some(DEFAULT_INBOX_RETENTION_DAYS));
                }
                _ => {}
            }
        }
        Ok(policy)
    }

    pub async fn save_data_policy(
        db: &SqlitePool,
        preview_required: bool,
        inbox_retention_days: Option<u16>,
    ) -> Result<AssistantDataPolicy> {
        if let Some(days) = inbox_retention_days {
            if !VALID_INBOX_RETENTION_DAYS.contains(&days) {
                return Err(anyhow!("稍后处理箱保留天数仅支持 1、7 或 30 天"));
            }
        }
        let policy = AssistantDataPolicy {
            preview_required,
            inbox_retention_days,
        };
        let retention_value = inbox_retention_days
            .map(|days| days.to_string())
            .unwrap_or_else(|| "manual".to_string());
        let mut transaction = db.begin().await?;

        for (key, value) in [
            (PREVIEW_REQUIRED_KEY, preview_required.to_string()),
            (INBOX_RETENTION_DAYS_KEY, retention_value),
        ] {
            sqlx::query(
                "INSERT INTO assistant_preferences (key, value, updated_at)
                 VALUES (?, ?, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at",
            )
            .bind(key)
            .bind(value)
            .execute(&mut *transaction)
            .await?;
        }

        transaction.commit().await?;
        Ok(policy)
    }

    pub async fn load_onboarding(db: &SqlitePool) -> Result<AssistantOnboardingState> {
        let value: Option<String> =
            sqlx::query_scalar("SELECT value FROM assistant_preferences WHERE key = ?")
                .bind(PERMISSION_GUIDE_COMPLETED_KEY)
                .fetch_optional(db)
                .await?;
        Ok(AssistantOnboardingState {
            permission_guide_completed: value
                .as_deref()
                .and_then(|value| value.parse::<bool>().ok())
                .unwrap_or(false),
        })
    }

    pub async fn complete_permission_guide(db: &SqlitePool) -> Result<AssistantOnboardingState> {
        upsert_value(db, PERMISSION_GUIDE_COMPLETED_KEY, "true").await?;
        Ok(AssistantOnboardingState {
            permission_guide_completed: true,
        })
    }

    pub async fn load_shortcut_diagnostic(
        db: &SqlitePool,
    ) -> Result<Option<AssistantShortcutDiagnostic>> {
        let value: Option<String> =
            sqlx::query_scalar("SELECT value FROM assistant_preferences WHERE key = ?")
                .bind(SHORTCUT_DIAGNOSTIC_KEY)
                .fetch_optional(db)
                .await?;
        Ok(value.and_then(|value| serde_json::from_str(&value).ok()))
    }

    pub async fn save_shortcut_diagnostic(
        db: &SqlitePool,
        diagnostic: &AssistantShortcutDiagnostic,
    ) -> Result<()> {
        let value = serde_json::to_string(diagnostic)?;
        upsert_value(db, SHORTCUT_DIAGNOSTIC_KEY, &value).await
    }

    pub async fn clear_shortcut_diagnostic(db: &SqlitePool) -> Result<()> {
        sqlx::query("DELETE FROM assistant_preferences WHERE key = ?")
            .bind(SHORTCUT_DIAGNOSTIC_KEY)
            .execute(db)
            .await?;
        Ok(())
    }

    pub async fn load_runtime(db: &SqlitePool) -> Result<AssistantRuntimePreferences> {
        let rows = sqlx::query(
            "SELECT key, value
             FROM assistant_preferences
             WHERE key IN (?, ?)",
        )
        .bind(ASSISTANT_ENABLED_KEY)
        .bind(DIAGNOSTIC_LOGGING_ENABLED_KEY)
        .fetch_all(db)
        .await?;
        let mut preferences = AssistantRuntimePreferences::default();
        for row in rows {
            let key: String = row.get("key");
            let value: String = row.get("value");
            match key.as_str() {
                ASSISTANT_ENABLED_KEY => {
                    preferences.enabled = value.parse::<bool>().unwrap_or(true);
                }
                DIAGNOSTIC_LOGGING_ENABLED_KEY => {
                    preferences.diagnostic_logging_enabled = value.parse::<bool>().unwrap_or(false);
                }
                _ => {}
            }
        }
        Ok(preferences)
    }

    pub async fn save_runtime(
        db: &SqlitePool,
        enabled: bool,
        diagnostic_logging_enabled: bool,
    ) -> Result<AssistantRuntimePreferences> {
        let preferences = AssistantRuntimePreferences {
            enabled,
            diagnostic_logging_enabled,
        };
        let mut transaction = db.begin().await?;
        for (key, value) in [
            (ASSISTANT_ENABLED_KEY, enabled.to_string()),
            (
                DIAGNOSTIC_LOGGING_ENABLED_KEY,
                diagnostic_logging_enabled.to_string(),
            ),
        ] {
            sqlx::query(
                "INSERT INTO assistant_preferences (key, value, updated_at)
                 VALUES (?, ?, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at",
            )
            .bind(key)
            .bind(value)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(preferences)
    }

    pub async fn load_translation(db: &SqlitePool) -> Result<AssistantTranslationPreferences> {
        let rows = sqlx::query(
            "SELECT key, value
             FROM assistant_preferences
             WHERE key IN (?, ?)",
        )
        .bind(TRANSLATION_TARGET_LANGUAGE_KEY)
        .bind(TRANSLATION_TERMINOLOGY_STYLE_KEY)
        .fetch_all(db)
        .await?;
        let mut preferences = AssistantTranslationPreferences::default();
        for row in rows {
            let key: String = row.get("key");
            let value: String = row.get("value");
            match key.as_str() {
                TRANSLATION_TARGET_LANGUAGE_KEY
                    if VALID_TRANSLATION_TARGET_LANGUAGES.contains(&value.as_str()) =>
                {
                    preferences.target_language = value;
                }
                TRANSLATION_TERMINOLOGY_STYLE_KEY
                    if VALID_TRANSLATION_TERMINOLOGY_STYLES.contains(&value.as_str()) =>
                {
                    preferences.terminology_style = value;
                }
                _ => {}
            }
        }
        Ok(preferences)
    }

    pub async fn save_translation(
        db: &SqlitePool,
        target_language: &str,
        terminology_style: &str,
    ) -> Result<AssistantTranslationPreferences> {
        if !VALID_TRANSLATION_TARGET_LANGUAGES.contains(&target_language) {
            return Err(anyhow!("不支持的目标语言"));
        }
        if !VALID_TRANSLATION_TERMINOLOGY_STYLES.contains(&terminology_style) {
            return Err(anyhow!("不支持的术语偏好"));
        }
        let preferences = AssistantTranslationPreferences {
            target_language: target_language.to_string(),
            terminology_style: terminology_style.to_string(),
        };
        let mut transaction = db.begin().await?;
        for (key, value) in [
            (
                TRANSLATION_TARGET_LANGUAGE_KEY,
                preferences.target_language.as_str(),
            ),
            (
                TRANSLATION_TERMINOLOGY_STYLE_KEY,
                preferences.terminology_style.as_str(),
            ),
        ] {
            sqlx::query(
                "INSERT INTO assistant_preferences (key, value, updated_at)
                 VALUES (?, ?, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at",
            )
            .bind(key)
            .bind(value)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(preferences)
    }
}

// ─── 角色站位持久化 ──────────────────────────────────────────────────

const DOCK_PLACEMENT_KEY: &str = "dock_placement";

/// 桌面小妍站位：显示器标识 + 吸附边缘 + 沿边缘偏移（物理像素）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantDockPlacement {
    pub monitor_id: String,
    pub edge: String,
    pub offset: i32,
}

impl AssistantPreferenceService {
    pub async fn load_dock_placement(db: &SqlitePool) -> Result<Option<AssistantDockPlacement>> {
        let value: Option<String> =
            sqlx::query_scalar("SELECT value FROM assistant_preferences WHERE key = ?")
                .bind(DOCK_PLACEMENT_KEY)
                .fetch_optional(db)
                .await?;
        Ok(value.and_then(|value| serde_json::from_str(&value).ok()))
    }

    pub async fn save_dock_placement(
        db: &SqlitePool,
        placement: &AssistantDockPlacement,
    ) -> Result<()> {
        let value = serde_json::to_string(placement)?;
        upsert_value(db, DOCK_PLACEMENT_KEY, &value).await
    }

    pub async fn clear_dock_placement(db: &SqlitePool) -> Result<()> {
        sqlx::query("DELETE FROM assistant_preferences WHERE key = ?")
            .bind(DOCK_PLACEMENT_KEY)
            .execute(db)
            .await?;
        Ok(())
    }
}

async fn upsert_value(db: &SqlitePool, key: &str, value: &str) -> Result<()> {
    sqlx::query(
        "INSERT INTO assistant_preferences (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at",
    )
    .bind(key)
    .bind(value)
    .execute(db)
    .await?;
    Ok(())
}

// ─── 直达动作快捷键（P1-1，PRD §16.2）──────────────────────────────────────

const DIRECT_SHORTCUTS_KEY: &str = "direct_shortcuts";
const DIRECT_SHORTCUT_DIAGNOSTIC_KEY_PREFIX: &str = "direct_shortcut_diagnostic:";

/// 可选直达动作；默认不注册，用户在设置页开启后才持久化组合键。
pub const DIRECT_SHORTCUT_ACTIONS: [&str; 3] = ["interpret", "translate", "screenshot"];

pub fn is_valid_direct_action(action: &str) -> bool {
    DIRECT_SHORTCUT_ACTIONS.contains(&action)
}

fn direct_shortcut_diagnostic_key(action: &str) -> String {
    format!("{DIRECT_SHORTCUT_DIAGNOSTIC_KEY_PREFIX}{action}")
}

impl AssistantPreferenceService {
    /// 已开启的直达动作组合键（动作 → 快捷键）；未开启的动作不出现在映射中。
    pub async fn load_direct_shortcuts(
        db: &SqlitePool,
    ) -> Result<std::collections::HashMap<String, String>> {
        let value: Option<String> =
            sqlx::query_scalar("SELECT value FROM assistant_preferences WHERE key = ?")
                .bind(DIRECT_SHORTCUTS_KEY)
                .fetch_optional(db)
                .await?;
        let raw = value
            .and_then(|value| {
                serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&value).ok()
            })
            .unwrap_or_default();
        let mut shortcuts = std::collections::HashMap::new();
        for (action, shortcut) in raw {
            if !is_valid_direct_action(&action) {
                continue;
            }
            if let Some(shortcut) =
                shortcut.as_str().map(str::trim).filter(|value| !value.is_empty())
            {
                shortcuts.insert(action, shortcut.to_string());
            }
        }
        Ok(shortcuts)
    }

    /// 开启（Some）或关闭（None）某个直达动作；返回更新后的完整映射。
    pub async fn save_direct_shortcut(
        db: &SqlitePool,
        action: &str,
        shortcut: Option<&str>,
    ) -> Result<std::collections::HashMap<String, String>> {
        if !is_valid_direct_action(action) {
            return Err(anyhow!("不支持的直达动作：{action}"));
        }
        let mut shortcuts = Self::load_direct_shortcuts(db).await?;
        match shortcut.map(str::trim).filter(|value| !value.is_empty()) {
            Some(shortcut) => {
                shortcuts.insert(action.to_string(), shortcut.to_string());
            }
            None => {
                shortcuts.remove(action);
            }
        }
        let value = serde_json::to_string(&shortcuts)?;
        upsert_value(db, DIRECT_SHORTCUTS_KEY, &value).await?;
        Ok(shortcuts)
    }

    pub async fn load_direct_shortcut_diagnostic(
        db: &SqlitePool,
        action: &str,
    ) -> Result<Option<AssistantShortcutDiagnostic>> {
        let value: Option<String> =
            sqlx::query_scalar("SELECT value FROM assistant_preferences WHERE key = ?")
                .bind(direct_shortcut_diagnostic_key(action))
                .fetch_optional(db)
                .await?;
        Ok(value.and_then(|value| serde_json::from_str(&value).ok()))
    }

    pub async fn save_direct_shortcut_diagnostic(
        db: &SqlitePool,
        action: &str,
        diagnostic: &AssistantShortcutDiagnostic,
    ) -> Result<()> {
        if !is_valid_direct_action(action) {
            return Err(anyhow!("不支持的直达动作：{action}"));
        }
        let value = serde_json::to_string(diagnostic)?;
        upsert_value(db, &direct_shortcut_diagnostic_key(action), &value).await
    }

    pub async fn clear_direct_shortcut_diagnostic(db: &SqlitePool, action: &str) -> Result<()> {
        sqlx::query("DELETE FROM assistant_preferences WHERE key = ?")
            .bind(direct_shortcut_diagnostic_key(action))
            .execute(db)
            .await?;
        Ok(())
    }
}

fn normalize_app_rules(items: Vec<String>) -> Result<Vec<String>> {
    if items.len() > MAX_APP_RULES {
        return Err(anyhow!("每类应用规则最多支持 {MAX_APP_RULES} 条"));
    }

    let mut normalized = Vec::with_capacity(items.len());
    for item in items {
        let bundle_id = item.trim();
        if bundle_id.is_empty() {
            continue;
        }
        if bundle_id.len() > MAX_BUNDLE_ID_LEN
            || !bundle_id
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || "._-".contains(character))
        {
            return Err(anyhow!("应用标识格式无效：{bundle_id}"));
        }
        if !normalized
            .iter()
            .any(|existing: &String| existing.eq_ignore_ascii_case(bundle_id))
        {
            normalized.push(bundle_id.to_string());
        }
    }
    Ok(normalized)
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
        pool
    }

    #[tokio::test]
    async fn privacy_rules_round_trip_normalizes_and_deduplicates() {
        let pool = setup().await;
        let saved = AssistantPreferenceService::save_privacy(
            &pool,
            vec![
                " com.apple.Safari ".to_string(),
                "COM.APPLE.SAFARI".to_string(),
            ],
            vec!["com.example.private".to_string()],
            true,
        )
        .await
        .unwrap();

        assert_eq!(saved.allowed_apps, vec!["com.apple.Safari"]);
        assert_eq!(saved.blocked_apps, vec!["com.example.private"]);
        assert_eq!(
            AssistantPreferenceService::load_privacy(&pool)
                .await
                .unwrap(),
            saved
        );
    }

    #[tokio::test]
    async fn privacy_rules_reject_invalid_bundle_ids_without_partial_write() {
        let pool = setup().await;
        let result = AssistantPreferenceService::save_privacy(
            &pool,
            vec!["com.example.allowed".to_string()],
            vec!["contains spaces".to_string()],
            false,
        )
        .await;

        assert!(result.is_err());
        assert_eq!(
            AssistantPreferenceService::load_privacy(&pool)
                .await
                .unwrap(),
            AssistantPrivacyPreferences::default()
        );
    }

    #[tokio::test]
    async fn disabling_window_titles_clears_existing_capture_and_import_metadata() {
        let pool = setup().await;
        for statement in [
            "CREATE TABLE assistant_capture_sessions (
                id TEXT PRIMARY KEY,
                window_title TEXT
            )",
            "CREATE TABLE assistant_imports (
                id TEXT PRIMARY KEY,
                window_title TEXT
            )",
            "INSERT INTO assistant_capture_sessions (id, window_title)
             VALUES ('capture-1', 'Sensitive paper title')",
            "INSERT INTO assistant_imports (id, window_title)
             VALUES ('import-1', 'Sensitive paper title')",
        ] {
            sqlx::query(statement).execute(&pool).await.unwrap();
        }

        let saved = AssistantPreferenceService::save_privacy(&pool, Vec::new(), Vec::new(), false)
            .await
            .unwrap();
        assert!(!saved.window_title_enabled);

        let capture_title: Option<String> = sqlx::query_scalar(
            "SELECT window_title FROM assistant_capture_sessions WHERE id = 'capture-1'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        let import_title: Option<String> =
            sqlx::query_scalar("SELECT window_title FROM assistant_imports WHERE id = 'import-1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(capture_title.is_none());
        assert!(import_title.is_none());
    }

    #[tokio::test]
    async fn data_policy_defaults_and_round_trips_manual_retention() {
        let pool = setup().await;
        assert_eq!(
            AssistantPreferenceService::load_data_policy(&pool)
                .await
                .unwrap(),
            AssistantDataPolicy::default()
        );

        let saved = AssistantPreferenceService::save_data_policy(&pool, false, None)
            .await
            .unwrap();
        assert_eq!(
            saved,
            AssistantDataPolicy {
                preview_required: false,
                inbox_retention_days: None,
            }
        );
        assert_eq!(
            AssistantPreferenceService::load_data_policy(&pool)
                .await
                .unwrap(),
            saved
        );
    }

    #[tokio::test]
    async fn data_policy_rejects_unsupported_retention_days() {
        let pool = setup().await;
        let result = AssistantPreferenceService::save_data_policy(&pool, true, Some(365)).await;
        assert!(result.is_err());
        assert_eq!(
            AssistantPreferenceService::load_data_policy(&pool)
                .await
                .unwrap(),
            AssistantDataPolicy::default()
        );
    }

    #[tokio::test]
    async fn permission_guide_is_only_completed_after_explicit_action() {
        let pool = setup().await;
        assert!(
            !AssistantPreferenceService::load_onboarding(&pool)
                .await
                .unwrap()
                .permission_guide_completed
        );

        AssistantPreferenceService::complete_permission_guide(&pool)
            .await
            .unwrap();
        assert!(
            AssistantPreferenceService::load_onboarding(&pool)
                .await
                .unwrap()
                .permission_guide_completed
        );
    }

    #[tokio::test]
    async fn shortcut_diagnostic_round_trips_and_can_be_cleared() {
        let pool = setup().await;
        let diagnostic = AssistantShortcutDiagnostic {
            status: "degraded".to_string(),
            requested_shortcut: "Alt+Space".to_string(),
            active_shortcut: Some("Control+Space".to_string()),
            message: "快捷键冲突".to_string(),
            updated_at: "2026-07-29T00:00:00Z".to_string(),
        };
        AssistantPreferenceService::save_shortcut_diagnostic(&pool, &diagnostic)
            .await
            .unwrap();
        assert_eq!(
            AssistantPreferenceService::load_shortcut_diagnostic(&pool)
                .await
                .unwrap(),
            Some(diagnostic)
        );

        AssistantPreferenceService::clear_shortcut_diagnostic(&pool)
            .await
            .unwrap();
        assert!(AssistantPreferenceService::load_shortcut_diagnostic(&pool)
            .await
            .unwrap()
            .is_none());
    }

    #[tokio::test]
    async fn runtime_preferences_default_enabled_without_diagnostics_and_round_trip() {
        let pool = setup().await;
        assert_eq!(
            AssistantPreferenceService::load_runtime(&pool)
                .await
                .unwrap(),
            AssistantRuntimePreferences::default()
        );

        let saved = AssistantPreferenceService::save_runtime(&pool, false, true)
            .await
            .unwrap();
        assert_eq!(
            saved,
            AssistantRuntimePreferences {
                enabled: false,
                diagnostic_logging_enabled: true,
            }
        );
        assert_eq!(
            AssistantPreferenceService::load_runtime(&pool)
                .await
                .unwrap(),
            saved
        );
    }

    #[tokio::test]
    async fn dock_placement_round_trips_ignores_malformed_values_and_can_be_cleared() {
        let pool = setup().await;
        assert!(AssistantPreferenceService::load_dock_placement(&pool)
            .await
            .unwrap()
            .is_none());

        let placement = AssistantDockPlacement {
            monitor_id: "Built-in Retina Display".to_string(),
            edge: "right".to_string(),
            offset: 700,
        };
        AssistantPreferenceService::save_dock_placement(&pool, &placement)
            .await
            .unwrap();
        assert_eq!(
            AssistantPreferenceService::load_dock_placement(&pool)
                .await
                .unwrap(),
            Some(placement)
        );

        sqlx::query("UPDATE assistant_preferences SET value = 'not-json' WHERE key = ?")
            .bind(DOCK_PLACEMENT_KEY)
            .execute(&pool)
            .await
            .unwrap();
        assert!(AssistantPreferenceService::load_dock_placement(&pool)
            .await
            .unwrap()
            .is_none());

        AssistantPreferenceService::clear_dock_placement(&pool)
            .await
            .unwrap();
        assert!(AssistantPreferenceService::load_dock_placement(&pool)
            .await
            .unwrap()
            .is_none());
    }

    #[tokio::test]
    async fn translation_preferences_validate_and_round_trip() {
        let pool = setup().await;
        assert_eq!(
            AssistantPreferenceService::load_translation(&pool)
                .await
                .unwrap(),
            AssistantTranslationPreferences::default()
        );

        let saved = AssistantPreferenceService::save_translation(&pool, "ja", "original")
            .await
            .unwrap();
        assert_eq!(saved.target_language, "ja");
        assert_eq!(saved.terminology_style, "original");
        assert_eq!(
            AssistantPreferenceService::load_translation(&pool)
                .await
                .unwrap(),
            saved
        );
        assert!(
            AssistantPreferenceService::save_translation(&pool, "xx", "original")
                .await
                .is_err()
        );
        assert!(
            AssistantPreferenceService::save_translation(&pool, "zh", "unknown")
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn direct_shortcuts_default_empty_and_round_trip_per_action() {
        let pool = setup().await;
        assert!(AssistantPreferenceService::load_direct_shortcuts(&pool)
            .await
            .unwrap()
            .is_empty());

        let saved = AssistantPreferenceService::save_direct_shortcut(&pool, "interpret", Some("Alt+1"))
            .await
            .unwrap();
        assert_eq!(saved.get("interpret").map(String::as_str), Some("Alt+1"));
        assert!(!saved.contains_key("translate"));

        let saved = AssistantPreferenceService::save_direct_shortcut(&pool, "interpret", None)
            .await
            .unwrap();
        assert!(!saved.contains_key("interpret"));
        assert!(AssistantPreferenceService::load_direct_shortcuts(&pool)
            .await
            .unwrap()
            .is_empty());

        assert!(
            AssistantPreferenceService::save_direct_shortcut(&pool, "unknown", Some("Alt+9"))
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn direct_shortcuts_ignore_unknown_actions_and_empty_values_on_load() {
        let pool = setup().await;
        upsert_value(
            &pool,
            DIRECT_SHORTCUTS_KEY,
            r#"{"interpret":"Alt+1","unknown":"Alt+9","translate":"  "}"#,
        )
        .await
        .unwrap();

        let loaded = AssistantPreferenceService::load_direct_shortcuts(&pool)
            .await
            .unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded.get("interpret").map(String::as_str), Some("Alt+1"));
    }

    #[tokio::test]
    async fn direct_shortcut_diagnostic_is_scoped_per_action_and_can_be_cleared() {
        let pool = setup().await;
        let diagnostic = AssistantShortcutDiagnostic {
            status: "error".to_string(),
            requested_shortcut: "Alt+1".to_string(),
            active_shortcut: None,
            message: "快捷键冲突".to_string(),
            updated_at: "2026-08-26T00:00:00Z".to_string(),
        };
        AssistantPreferenceService::save_direct_shortcut_diagnostic(&pool, "interpret", &diagnostic)
            .await
            .unwrap();
        assert_eq!(
            AssistantPreferenceService::load_direct_shortcut_diagnostic(&pool, "interpret")
                .await
                .unwrap(),
            Some(diagnostic)
        );
        assert!(AssistantPreferenceService::load_direct_shortcut_diagnostic(&pool, "translate")
            .await
            .unwrap()
            .is_none());

        AssistantPreferenceService::clear_direct_shortcut_diagnostic(&pool, "interpret")
            .await
            .unwrap();
        assert!(AssistantPreferenceService::load_direct_shortcut_diagnostic(&pool, "interpret")
            .await
            .unwrap()
            .is_none());

        assert!(
            AssistantPreferenceService::save_direct_shortcut_diagnostic(&pool, "unknown", &AssistantShortcutDiagnostic {
                status: "error".to_string(),
                requested_shortcut: "Alt+9".to_string(),
                active_shortcut: None,
                message: String::new(),
                updated_at: "2026-08-26T00:00:00Z".to_string(),
            })
            .await
            .is_err()
        );
    }
}

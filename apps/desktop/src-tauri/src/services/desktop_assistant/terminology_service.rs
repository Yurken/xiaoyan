//! 桌面助手稳定术语偏好。
//!
//! 用户显式保存的术语映射复用 `assistant_preferences` 持久化，避免为小型偏好
//! 引入独立数据表。翻译时只返回当前原文实际命中的映射；截图场景无法预先
//! 读取 OCR 文本，因此返回对应目标语言下的有限术语表。

use anyhow::{anyhow, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

const TERMINOLOGY_PREFERENCES_KEY: &str = "translation_term_preferences";
const VALID_TARGET_LANGUAGES: &[&str] = &["zh", "en", "ja", "de", "fr"];
const MAX_TERM_PREFERENCES: usize = 100;
const MAX_TERM_CHARS: usize = 120;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantTerminologyPreference {
    pub source_term: String,
    pub preferred_translation: String,
    pub target_language: String,
    pub updated_at: String,
}

pub struct AssistantTerminologyService;

impl AssistantTerminologyService {
    pub async fn list(db: &SqlitePool) -> Result<Vec<AssistantTerminologyPreference>> {
        let value: Option<String> =
            sqlx::query_scalar("SELECT value FROM assistant_preferences WHERE key = ?")
                .bind(TERMINOLOGY_PREFERENCES_KEY)
                .fetch_optional(db)
                .await?;
        parse_preferences(value.as_deref())
    }

    pub async fn save(
        db: &SqlitePool,
        source_term: &str,
        preferred_translation: &str,
        target_language: &str,
    ) -> Result<Vec<AssistantTerminologyPreference>> {
        let source_term = validate_term(source_term, "原术语")?;
        let preferred_translation = validate_term(preferred_translation, "选定译法")?;
        validate_target_language(target_language)?;

        let mut transaction = db.begin().await?;
        let value: Option<String> =
            sqlx::query_scalar("SELECT value FROM assistant_preferences WHERE key = ?")
                .bind(TERMINOLOGY_PREFERENCES_KEY)
                .fetch_optional(&mut *transaction)
                .await?;
        let mut preferences = parse_preferences(value.as_deref())?;
        preferences.retain(|preference| {
            preference.target_language != target_language
                || !preference.source_term.eq_ignore_ascii_case(&source_term)
        });
        preferences.insert(
            0,
            AssistantTerminologyPreference {
                source_term,
                preferred_translation,
                target_language: target_language.to_string(),
                updated_at: Utc::now().to_rfc3339(),
            },
        );
        preferences.truncate(MAX_TERM_PREFERENCES);
        persist(&mut transaction, &preferences).await?;
        transaction.commit().await?;
        Ok(preferences)
    }

    pub async fn delete(
        db: &SqlitePool,
        source_term: &str,
        target_language: &str,
    ) -> Result<Vec<AssistantTerminologyPreference>> {
        let source_term = validate_term(source_term, "原术语")?;
        validate_target_language(target_language)?;
        let mut transaction = db.begin().await?;
        let value: Option<String> =
            sqlx::query_scalar("SELECT value FROM assistant_preferences WHERE key = ?")
                .bind(TERMINOLOGY_PREFERENCES_KEY)
                .fetch_optional(&mut *transaction)
                .await?;
        let mut preferences = parse_preferences(value.as_deref())?;
        preferences.retain(|preference| {
            preference.target_language != target_language
                || !preference.source_term.eq_ignore_ascii_case(&source_term)
        });
        persist(&mut transaction, &preferences).await?;
        transaction.commit().await?;
        Ok(preferences)
    }

    pub async fn matching(
        db: &SqlitePool,
        content: &str,
        target_language: &str,
    ) -> Result<Vec<AssistantTerminologyPreference>> {
        validate_target_language(target_language)?;
        let preferences = Self::list(db).await?;
        if content.starts_with("data:image/") {
            return Ok(preferences
                .into_iter()
                .filter(|preference| preference.target_language == target_language)
                .collect());
        }
        let normalized_content = content.to_lowercase();
        Ok(preferences
            .into_iter()
            .filter(|preference| {
                preference.target_language == target_language
                    && normalized_content.contains(&preference.source_term.to_lowercase())
            })
            .collect())
    }
}

async fn persist(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    preferences: &[AssistantTerminologyPreference],
) -> Result<()> {
    let value = serde_json::to_string(preferences)?;
    sqlx::query(
        "INSERT INTO assistant_preferences (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at",
    )
    .bind(TERMINOLOGY_PREFERENCES_KEY)
    .bind(value)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

fn parse_preferences(value: Option<&str>) -> Result<Vec<AssistantTerminologyPreference>> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    let preferences: Vec<AssistantTerminologyPreference> = serde_json::from_str(value)?;
    Ok(preferences
        .into_iter()
        .filter(|preference| {
            validate_term(&preference.source_term, "原术语").is_ok()
                && validate_term(&preference.preferred_translation, "选定译法").is_ok()
                && validate_target_language(&preference.target_language).is_ok()
        })
        .take(MAX_TERM_PREFERENCES)
        .collect())
}

fn validate_term(value: &str, label: &str) -> Result<String> {
    let value = value.trim();
    let characters = value.chars().count();
    if characters == 0 || characters > MAX_TERM_CHARS {
        return Err(anyhow!("{}必须为 1–{} 个字符", label, MAX_TERM_CHARS));
    }
    if value.chars().any(char::is_control) {
        return Err(anyhow!("{}不能包含控制字符", label));
    }
    Ok(value.to_string())
}

fn validate_target_language(value: &str) -> Result<()> {
    if !VALID_TARGET_LANGUAGES.contains(&value) {
        return Err(anyhow!("不支持的目标语言"));
    }
    Ok(())
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
    async fn save_overwrites_the_same_term_and_can_delete_it() {
        let pool = setup().await;
        AssistantTerminologyService::save(&pool, "agent", "智能体", "zh")
            .await
            .unwrap();
        let saved = AssistantTerminologyService::save(&pool, "Agent", "代理体", "zh")
            .await
            .unwrap();
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].preferred_translation, "代理体");

        let remaining = AssistantTerminologyService::delete(&pool, "agent", "zh")
            .await
            .unwrap();
        assert!(remaining.is_empty());
    }

    #[tokio::test]
    async fn matching_only_returns_terms_in_the_text_and_target_language() {
        let pool = setup().await;
        AssistantTerminologyService::save(&pool, "agent", "智能体", "zh")
            .await
            .unwrap();
        AssistantTerminologyService::save(&pool, "retrieval", "检索", "zh")
            .await
            .unwrap();
        AssistantTerminologyService::save(&pool, "agent", "Agent", "de")
            .await
            .unwrap();

        let matched =
            AssistantTerminologyService::matching(&pool, "An Agent plans the next step.", "zh")
                .await
                .unwrap();
        assert_eq!(matched.len(), 1);
        assert_eq!(matched[0].preferred_translation, "智能体");
    }

    #[tokio::test]
    async fn invalid_or_oversized_terms_are_rejected() {
        let pool = setup().await;
        assert!(
            AssistantTerminologyService::save(&pool, "\n", "智能体", "zh")
                .await
                .is_err()
        );
        assert!(
            AssistantTerminologyService::save(&pool, "agent", "智能体", "xx")
                .await
                .is_err()
        );
    }
}

//! Confirmed desktop-assistant imports and persistence.

use anyhow::{anyhow, Result};
use base64::Engine;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use super::action_service::{parse_image_data_url, ActionMetadata, ActionResult, AssistantAction};
use super::capture_store::{AssistantImportRecord, CaptureStore};
use super::content_policy::{limit_text_chars, MAX_NOTE_TEXT_CHARS};
use super::note_attachment_service::NoteAttachmentService;

pub(super) fn validated_image_extension(media_type: &str, bytes: &[u8]) -> Result<&'static str> {
    let valid = match media_type {
        "image/png" => (
            "png",
            bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]),
        ),
        "image/jpeg" => ("jpg", bytes.starts_with(&[0xFF, 0xD8, 0xFF])),
        "image/webp" => (
            "webp",
            bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP",
        ),
        "image/gif" => (
            "gif",
            bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a"),
        ),
        _ => return Err(anyhow!("不支持的图片格式")),
    };
    if valid.1 {
        Ok(valid.0)
    } else {
        Err(anyhow!("图片内容与声明的 MIME 类型不匹配"))
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportTarget {
    Note,
    Image,
    Paper,
    Later,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportRetentionPolicy {
    Permanent,
    OneDay,
    SevenDays,
    ThirtyDays,
    Manual,
}

impl ImportRetentionPolicy {
    fn parse(value: &str) -> Result<Self> {
        match value {
            "permanent" => Ok(Self::Permanent),
            "1_day" => Ok(Self::OneDay),
            "7_days" => Ok(Self::SevenDays),
            "30_days" => Ok(Self::ThirtyDays),
            "manual" => Ok(Self::Manual),
            _ => Err(anyhow!("不支持的保留策略")),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Permanent => "permanent",
            Self::OneDay => "1_day",
            Self::SevenDays => "7_days",
            Self::ThirtyDays => "30_days",
            Self::Manual => "manual",
        }
    }

    fn expires_at(self) -> Option<String> {
        let days = match self {
            Self::OneDay => 1,
            Self::SevenDays => 7,
            Self::ThirtyDays => 30,
            Self::Permanent | Self::Manual => return None,
        };
        Some((Utc::now() + Duration::days(days)).to_rfc3339())
    }
}

pub struct AssistantImportOptions<'a> {
    pub title: Option<&'a str>,
    pub tags: Option<&'a [String]>,
    pub research_theme_id: Option<&'a str>,
    pub preserve_original: bool,
    pub original_content: Option<&'a str>,
    pub retention_policy: &'a str,
}

struct ImportedArtifact {
    result: ActionResult,
    storage_location: String,
    stored_bytes: u64,
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

impl ImportTarget {
    fn as_str(self) -> &'static str {
        match self {
            Self::Note => "note",
            Self::Image => "image",
            Self::Paper => "paper",
            Self::Later => "later",
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
        options: AssistantImportOptions<'_>,
    ) -> Result<ActionResult> {
        CaptureStore::require_confirmed(db, session_id).await?;
        let target = target.parse::<ImportTarget>()?;
        if matches!(target, ImportTarget::Image) && !options.preserve_original {
            return Err(anyhow!("保存图片资产必须保留原始截图"));
        }
        let research_theme_id = validate_research_theme(db, options.research_theme_id).await?;
        let retention_policy = ImportRetentionPolicy::parse(options.retention_policy)?;
        validate_retention_policy(&target, retention_policy)?;
        let expires_at = retention_policy.expires_at();
        let artifact = match target {
            ImportTarget::Note => {
                let note_content = prepare_text_content(
                    content,
                    options.original_content,
                    options.preserve_original,
                )?;
                Self::import_as_note(
                    db,
                    app_data_dir,
                    session_id,
                    &note_content,
                    options.title,
                    options.tags,
                    research_theme_id.as_deref(),
                    options
                        .preserve_original
                        .then_some(options.original_content)
                        .flatten()
                        .filter(|original| original.starts_with("data:image/")),
                )
                .await
            }
            ImportTarget::Image => Self::import_as_image(app_data_dir, session_id, content),
            ImportTarget::Paper => {
                Self::import_as_paper(db, session_id, content, options.title).await
            }
            ImportTarget::Later => {
                let later_content = prepare_text_content(
                    content,
                    options.original_content,
                    options.preserve_original,
                )?;
                Self::import_as_later(
                    db,
                    session_id,
                    &later_content,
                    options.title,
                    research_theme_id.as_deref(),
                    retention_policy,
                    expires_at.as_deref(),
                )
                .await
            }
        }?;

        let content_kind = if content.starts_with("data:image/") {
            "[image]"
        } else {
            "[text]"
        };
        CaptureStore::record_import(
            db,
            session_id,
            AssistantImportRecord {
                target: target.as_str(),
                target_id: &artifact.result.id,
                content_kind,
                research_theme_id: research_theme_id.as_deref(),
                preserve_original: options.preserve_original,
                retention_policy: retention_policy.as_str(),
                expires_at: expires_at.as_deref(),
                storage_location: &artifact.storage_location,
                estimated_size_bytes: artifact.stored_bytes,
            },
        )
        .await?;

        Ok(artifact.result)
    }

    async fn import_as_note(
        db: &SqlitePool,
        app_data_dir: &std::path::Path,
        session_id: &str,
        content: &str,
        title: Option<&str>,
        tags: Option<&[String]>,
        research_theme_id: Option<&str>,
        original_screenshot: Option<&str>,
    ) -> Result<ImportedArtifact> {
        let note_title = title
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| {
                let preview: String = content.chars().take(50).collect();
                format!("从小妍桌面助手导入 - {}", preview)
            });
        let note_id = Uuid::new_v4().to_string();
        let tags_json = serde_json::to_string(tags.unwrap_or(&[]))?;

        sqlx::query(
            "INSERT INTO knowledge_notes (id, research_interest_id, title, content, tags, source_type, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'assistant', ?, datetime('now'), datetime('now'))",
        )
        .bind(&note_id)
        .bind(research_theme_id)
        .bind(&note_title)
        .bind(&content)
        .bind(tags_json)
        .bind(session_id)
        .execute(db)
        .await?;

        let attachment = if let Some(screenshot) = original_screenshot {
            match NoteAttachmentService::store_screenshot(db, app_data_dir, &note_id, screenshot)
                .await
            {
                Ok(attachment) => Some(attachment),
                Err(error) => {
                    let _ = sqlx::query("DELETE FROM knowledge_notes WHERE id = ?")
                        .bind(&note_id)
                        .execute(db)
                        .await;
                    return Err(error);
                }
            }
        } else {
            None
        };
        let stored_bytes = content.len() as u64
            + attachment
                .as_ref()
                .map(|attachment| attachment.size_bytes)
                .unwrap_or(0);
        let storage_location = attachment
            .as_ref()
            .map(|attachment| {
                format!(
                    "local_database:knowledge_notes;app_data:assistant_note_attachments/{}",
                    attachment.relative_path
                )
            })
            .unwrap_or_else(|| "local_database:knowledge_notes".to_string());

        Ok(ImportedArtifact {
            stored_bytes,
            storage_location,
            result: import_result(
                &note_id,
                session_id,
                format!("已保存为知识笔记\n\nID: {}\n标题: {}", note_id, note_title),
                format!("note:{}", note_id),
            ),
        })
    }

    fn import_as_image(
        app_data_dir: &std::path::Path,
        session_id: &str,
        content: &str,
    ) -> Result<ImportedArtifact> {
        let asset_id = Uuid::new_v4().to_string();
        let image = parse_image_data_url(content)?;
        let image_data = base64::engine::general_purpose::STANDARD.decode(&image.data)?;
        let extension = validated_image_extension(&image.media_type, &image_data)?;
        let image_dir = app_data_dir.join("assistant_images");
        std::fs::create_dir_all(&image_dir)?;
        let image_path = image_dir.join(format!("{}.{}", asset_id, extension));
        let stored_bytes = image_data.len() as u64;
        std::fs::write(&image_path, image_data)?;

        Ok(ImportedArtifact {
            stored_bytes,
            storage_location: format!("app_data:assistant_images/{}.{}", asset_id, extension),
            result: import_result(
                &asset_id,
                session_id,
                format!(
                    "截图已保存\n\nID: {}\n路径: {}",
                    asset_id,
                    image_path.display()
                ),
                format!("image:{}", asset_id),
            ),
        })
    }

    async fn import_as_paper(
        db: &SqlitePool,
        session_id: &str,
        content: &str,
        title: Option<&str>,
    ) -> Result<ImportedArtifact> {
        let paper_title = title.map(str::to_string).unwrap_or_else(|| {
            let preview: String = content.chars().take(100).collect();
            format!("从小妍桌面助手导入 - {}", preview)
        });
        let candidate_id = Uuid::new_v4().to_string();
        let content_preview: String = content.chars().take(500).collect();

        sqlx::query(
            "INSERT INTO assistant_paper_candidates (id, session_id, title, content_preview, status, created_at) VALUES (?, ?, ?, ?, 'pending', datetime('now'))",
        )
        .bind(&candidate_id)
        .bind(session_id)
        .bind(&paper_title)
        .bind(&content_preview)
        .execute(db)
        .await?;

        Ok(ImportedArtifact {
            stored_bytes: content_preview.len() as u64,
            storage_location: "local_database:assistant_paper_candidates".to_string(),
            result: import_result(
                &candidate_id,
                session_id,
                format!(
                    "已创建论文导入候选\n\nID: {}\n标题: {}",
                    candidate_id, paper_title
                ),
                format!("paper:{}", candidate_id),
            ),
        })
    }

    async fn import_as_later(
        db: &SqlitePool,
        session_id: &str,
        content: &str,
        title: Option<&str>,
        research_theme_id: Option<&str>,
        retention_policy: ImportRetentionPolicy,
        expires_at: Option<&str>,
    ) -> Result<ImportedArtifact> {
        let later_title = title.map(str::to_string).unwrap_or_else(|| {
            let preview: String = content.chars().take(50).collect();
            format!("稍后处理 - {}", preview)
        });
        let item_id = Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO assistant_later_items (
                id, title, content, session_id, research_interest_id,
                retention_policy, expires_at, status, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))",
        )
        .bind(&item_id)
        .bind(&later_title)
        .bind(content)
        .bind(session_id)
        .bind(research_theme_id)
        .bind(retention_policy.as_str())
        .bind(expires_at)
        .execute(db)
        .await?;

        Ok(ImportedArtifact {
            stored_bytes: content.len() as u64,
            storage_location: "local_database:assistant_later_items".to_string(),
            result: import_result(
                &item_id,
                session_id,
                format!("已放入稍后处理\n\nID: {}\n标题: {}", item_id, later_title),
                format!("later:{}", item_id),
            ),
        })
    }
}

fn prepare_text_content(
    content: &str,
    original_content: Option<&str>,
    preserve_original: bool,
) -> Result<String> {
    if content.starts_with("data:image/") {
        return Err(anyhow!(
            "截图不能直接保存为文本，请先生成文字结果或选择图片资产"
        ));
    }
    let content = content.trim();
    if content.is_empty() {
        return Err(anyhow!("导入内容不能为空"));
    }
    let mut combined = content.to_string();
    if preserve_original {
        if let Some(original) = original_content
            .map(str::trim)
            .filter(|original| !original.is_empty() && *original != content)
        {
            if !original.starts_with("data:image/") {
                combined.push_str("\n\n---\n\n## 原始内容\n\n");
                combined.push_str(original);
            }
        }
    }
    Ok(limit_text_chars(&combined, MAX_NOTE_TEXT_CHARS).content)
}

pub(super) async fn validate_research_theme(
    db: &SqlitePool,
    research_theme_id: Option<&str>,
) -> Result<Option<String>> {
    let Some(theme_id) = research_theme_id
        .map(str::trim)
        .filter(|theme_id| !theme_id.is_empty())
    else {
        return Ok(None);
    };
    if theme_id.len() > 128
        || theme_id
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err(anyhow!("研究主题标识无效"));
    }
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM research_interests WHERE id = ?)")
            .bind(theme_id)
            .fetch_one(db)
            .await?;
    if !exists {
        return Err(anyhow!("所选研究主题不存在，请刷新后重试"));
    }
    Ok(Some(theme_id.to_string()))
}

fn validate_retention_policy(
    target: &ImportTarget,
    retention_policy: ImportRetentionPolicy,
) -> Result<()> {
    match target {
        ImportTarget::Later if retention_policy == ImportRetentionPolicy::Permanent => {
            Err(anyhow!("稍后处理项必须选择到期时间或手动清理"))
        }
        ImportTarget::Later => Ok(()),
        _ if retention_policy != ImportRetentionPolicy::Permanent => {
            Err(anyhow!("正式资产必须使用长期保留策略"))
        }
        _ => Ok(()),
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
            input_tokens: None,
            output_tokens: None,
            token_usage_estimated: false,
            duration_ms: None,
            sources: Some(vec![source]),
            source_details: None,
            knowledge_theme: None,
        }),
        created_at: chrono::Utc::now(),
    }
}

#[cfg(test)]
#[path = "import_service_tests.rs"]
mod tests;

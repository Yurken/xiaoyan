//! Durable, user-editable provenance for assistant imports.

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantSourceRegion {
    pub x: Option<i64>,
    pub y: Option<i64>,
    pub width: u64,
    pub height: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantSourceAttachment {
    pub id: String,
    pub kind: String,
    pub media_type: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantSourceMetadata {
    pub import_id: String,
    pub target: String,
    pub target_id: String,
    pub source_type: Option<String>,
    pub source_app: Option<String>,
    pub source_app_bundle_id: Option<String>,
    pub window_title: Option<String>,
    pub source_title: Option<String>,
    pub source_url: Option<String>,
    pub captured_at: Option<String>,
    pub capture_region: Option<AssistantSourceRegion>,
    pub attachments: Vec<AssistantSourceAttachment>,
}

pub struct AssistantSourceService;

impl AssistantSourceService {
    pub async fn get(
        db: &SqlitePool,
        target: &str,
        target_id: &str,
    ) -> Result<Option<AssistantSourceMetadata>> {
        let target = validated_target(target)?;
        let target_id = target_id.trim();
        if target_id.is_empty() || target_id.len() > 128 {
            return Err(anyhow!("来源目标标识无效"));
        }
        let Some(row) = sqlx::query(
            "SELECT id, target, target_id, source_type, source_app, source_app_bundle_id,
                    window_title, source_title, source_url, captured_at,
                    capture_region_x, capture_region_y, capture_region_width,
                    capture_region_height
             FROM assistant_imports
             WHERE target = ? AND target_id = ?
             ORDER BY datetime(created_at) DESC
             LIMIT 1",
        )
        .bind(target)
        .bind(target_id)
        .fetch_optional(db)
        .await?
        else {
            return Ok(None);
        };
        let width = row.get::<Option<i64>, _>("capture_region_width");
        let height = row.get::<Option<i64>, _>("capture_region_height");
        let capture_region = width
            .zip(height)
            .map(|(width, height)| AssistantSourceRegion {
                x: row.get("capture_region_x"),
                y: row.get("capture_region_y"),
                width: width.max(0) as u64,
                height: height.max(0) as u64,
            });
        let attachment_rows = if target == "note" {
            sqlx::query(
                "SELECT id, kind, media_type, size_bytes
                 FROM assistant_note_attachments WHERE note_id = ? ORDER BY datetime(created_at)",
            )
            .bind(target_id)
            .fetch_all(db)
            .await?
        } else {
            Vec::new()
        };
        let attachments = attachment_rows
            .into_iter()
            .map(|attachment| AssistantSourceAttachment {
                id: attachment.get("id"),
                kind: attachment.get("kind"),
                media_type: attachment.get("media_type"),
                size_bytes: attachment.get::<i64, _>("size_bytes").max(0) as u64,
            })
            .collect();
        Ok(Some(AssistantSourceMetadata {
            import_id: row.get("id"),
            target: row.get("target"),
            target_id: row.get("target_id"),
            source_type: row.get("source_type"),
            source_app: row.get("source_app"),
            source_app_bundle_id: row.get("source_app_bundle_id"),
            window_title: row.get("window_title"),
            source_title: row.get("source_title"),
            source_url: row.get("source_url"),
            captured_at: row.get("captured_at"),
            capture_region,
            attachments,
        }))
    }

    pub async fn update(
        db: &SqlitePool,
        target: &str,
        target_id: &str,
        source_app: Option<&str>,
        window_title: Option<&str>,
        source_title: Option<&str>,
        source_url: Option<&str>,
    ) -> Result<AssistantSourceMetadata> {
        let target = validated_target(target)?;
        let source_app = normalized_text(source_app, 200, "来源应用")?;
        let window_title = normalized_text(window_title, 200, "窗口标题")?;
        let source_title = normalized_text(source_title, 300, "来源标题")?;
        let source_url = normalized_url(source_url)?;
        let import_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM assistant_imports
             WHERE target = ? AND target_id = ?
             ORDER BY datetime(created_at) DESC LIMIT 1",
        )
        .bind(target)
        .bind(target_id.trim())
        .fetch_optional(db)
        .await?;
        let import_id = import_id.ok_or_else(|| anyhow!("未找到可编辑的来源记录"))?;
        sqlx::query(
            "UPDATE assistant_imports
             SET source_app = ?, window_title = ?, source_title = ?, source_url = ?
             WHERE id = ?",
        )
        .bind(source_app)
        .bind(window_title)
        .bind(source_title)
        .bind(source_url)
        .bind(import_id)
        .execute(db)
        .await?;
        Self::get(db, target, target_id)
            .await?
            .ok_or_else(|| anyhow!("来源记录更新后无法读取"))
    }
}

fn validated_target(target: &str) -> Result<&str> {
    match target.trim() {
        "note" => Ok("note"),
        "image" => Ok("image"),
        "paper" => Ok("paper"),
        _ => Err(anyhow!("不支持的来源目标")),
    }
}

fn normalized_text(value: Option<&str>, max_chars: usize, label: &str) -> Result<Option<String>> {
    let value = value.map(str::trim).filter(|value| !value.is_empty());
    let Some(value) = value else {
        return Ok(None);
    };
    if value.chars().count() > max_chars || value.chars().any(char::is_control) {
        return Err(anyhow!("{label}格式无效或过长"));
    }
    Ok(Some(value.to_string()))
}

fn normalized_url(value: Option<&str>) -> Result<Option<String>> {
    let Some(value) = normalized_text(value, 2_048, "来源链接")? else {
        return Ok(None);
    };
    let url = reqwest::Url::parse(&value).map_err(|_| anyhow!("来源链接格式无效"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(anyhow!("来源链接仅支持 HTTP 或 HTTPS"));
    }
    Ok(Some(url.to_string()))
}

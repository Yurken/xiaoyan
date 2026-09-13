//! Managed screenshot attachments owned by assistant-created knowledge notes.

use std::path::{Component, Path, PathBuf};

use anyhow::{anyhow, Result};
use base64::Engine;
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

use super::action_service::parse_image_data_url;
use super::import_service::validated_image_extension;

const ATTACHMENT_DIRECTORY: &str = "assistant_note_attachments";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredNoteAttachment {
    pub id: String,
    pub media_type: String,
    pub relative_path: String,
    pub size_bytes: u64,
}

pub struct NoteAttachmentService;

impl NoteAttachmentService {
    pub async fn store_screenshot(
        db: &SqlitePool,
        app_data_dir: &Path,
        note_id: &str,
        data_url: &str,
    ) -> Result<StoredNoteAttachment> {
        let image = parse_image_data_url(data_url)?;
        let bytes = base64::engine::general_purpose::STANDARD.decode(&image.data)?;
        let extension = validated_image_extension(&image.media_type, &bytes)?;
        let attachment_id = Uuid::new_v4().to_string();
        let relative_path = format!("{attachment_id}.{extension}");
        let directory = app_data_dir.join(ATTACHMENT_DIRECTORY);
        std::fs::create_dir_all(&directory)?;
        let path = safe_attachment_path(app_data_dir, &relative_path)?;
        std::fs::write(&path, &bytes)?;

        let insert = sqlx::query(
            "INSERT INTO assistant_note_attachments (
                id, note_id, kind, relative_path, media_type, size_bytes, created_at
             ) VALUES (?, ?, 'screenshot', ?, ?, ?, datetime('now'))",
        )
        .bind(&attachment_id)
        .bind(note_id)
        .bind(&relative_path)
        .bind(&image.media_type)
        .bind(i64::try_from(bytes.len()).unwrap_or(i64::MAX))
        .execute(db)
        .await;
        if let Err(error) = insert {
            let _ = std::fs::remove_file(&path);
            return Err(error.into());
        }

        Ok(StoredNoteAttachment {
            id: attachment_id,
            media_type: image.media_type,
            relative_path,
            size_bytes: bytes.len() as u64,
        })
    }

    pub async fn delete_note_with_attachments(
        db: &SqlitePool,
        app_data_dir: &Path,
        note_id: &str,
    ) -> Result<String> {
        let note = sqlx::query("SELECT title FROM knowledge_notes WHERE id = ?")
            .bind(note_id)
            .fetch_optional(db)
            .await?
            .ok_or_else(|| anyhow!("未找到对应笔记。"))?;
        let rows =
            sqlx::query("SELECT relative_path FROM assistant_note_attachments WHERE note_id = ?")
                .bind(note_id)
                .fetch_all(db)
                .await?;

        let mut staged = Vec::new();
        for row in rows {
            let relative_path: String = row.get("relative_path");
            let original = safe_attachment_path(app_data_dir, &relative_path)?;
            if !original.exists() {
                continue;
            }
            let staged_path = original.with_extension(format!(
                "{}.deleting-{}",
                original
                    .extension()
                    .and_then(|value| value.to_str())
                    .unwrap_or("asset"),
                Uuid::new_v4()
            ));
            if let Err(error) = std::fs::rename(&original, &staged_path) {
                restore_staged_files(&staged);
                return Err(error.into());
            }
            staged.push((original, staged_path));
        }

        let deletion = async {
            let mut transaction = db.begin().await?;
            sqlx::query("DELETE FROM assistant_note_attachments WHERE note_id = ?")
                .bind(note_id)
                .execute(&mut *transaction)
                .await?;
            sqlx::query("DELETE FROM assistant_imports WHERE target = 'note' AND target_id = ?")
                .bind(note_id)
                .execute(&mut *transaction)
                .await?;
            let deleted = sqlx::query("DELETE FROM knowledge_notes WHERE id = ?")
                .bind(note_id)
                .execute(&mut *transaction)
                .await?
                .rows_affected();
            if deleted != 1 {
                return Err(anyhow!("笔记状态已变化，请刷新后重试"));
            }
            transaction.commit().await?;
            Ok::<_, anyhow::Error>(())
        }
        .await;
        if let Err(error) = deletion {
            restore_staged_files(&staged);
            return Err(error);
        }
        for (_, staged_path) in staged {
            std::fs::remove_file(staged_path)?;
        }
        Ok(note.get("title"))
    }
}

fn safe_attachment_path(app_data_dir: &Path, relative_path: &str) -> Result<PathBuf> {
    let relative = Path::new(relative_path);
    if relative.components().count() != 1
        || !matches!(relative.components().next(), Some(Component::Normal(_)))
    {
        return Err(anyhow!("笔记附件路径无效，已停止删除"));
    }
    Ok(app_data_dir.join(ATTACHMENT_DIRECTORY).join(relative))
}

fn restore_staged_files(staged: &[(PathBuf, PathBuf)]) {
    for (original, staged_path) in staged.iter().rev() {
        if staged_path.exists() {
            let _ = std::fs::rename(staged_path, original);
        }
    }
}

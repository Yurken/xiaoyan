//! Main-window inbox for confirmed assistant captures and dropped files.

use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

use super::content_policy::{limit_text_chars, MAX_NOTE_TEXT_CHARS};
use super::file_candidate_service::{validate_file, FileCandidateKind};
use super::import_service::validate_research_theme;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantInboxLaterItem {
    pub id: String,
    pub title: String,
    pub content_preview: String,
    pub research_theme_id: Option<String>,
    pub research_theme_name: Option<String>,
    pub source_type: Option<String>,
    pub source_app: Option<String>,
    pub window_title: Option<String>,
    pub retention_policy: Option<String>,
    pub expires_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantInboxPaperCandidate {
    pub id: String,
    pub title: String,
    pub file_name: Option<String>,
    pub file_size_bytes: Option<u64>,
    pub has_source_file: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantInboxFileCandidate {
    pub id: String,
    pub file_name: String,
    pub kind: String,
    pub media_type: String,
    pub size_bytes: u64,
    pub recommended_target: String,
    pub expires_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantInboxOverview {
    pub later_items: Vec<AssistantInboxLaterItem>,
    pub paper_candidates: Vec<AssistantInboxPaperCandidate>,
    pub file_candidates: Vec<AssistantInboxFileCandidate>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantInboxActionResult {
    pub target: String,
    pub target_id: String,
}

#[derive(Debug, Clone)]
pub struct ClaimedPaperCandidate {
    pub id: String,
    pub title: String,
    pub file_path: PathBuf,
}

pub struct AssistantInboxService;

impl AssistantInboxService {
    pub async fn validate_theme(
        db: &SqlitePool,
        selected_theme_id: Option<&str>,
    ) -> Result<Option<String>> {
        validate_research_theme(db, selected_theme_id).await
    }

    pub async fn list(db: &SqlitePool) -> Result<AssistantInboxOverview> {
        let later_rows = sqlx::query(
            "SELECT li.id, li.title, substr(li.content, 1, 280) AS content_preview,
                    li.research_interest_id, ri.topic AS research_theme_name,
                    cs.source_type, cs.source_app, cs.window_title,
                    li.retention_policy, li.expires_at, li.created_at
             FROM assistant_later_items li
             LEFT JOIN research_interests ri ON ri.id = li.research_interest_id
             LEFT JOIN assistant_capture_sessions cs ON cs.id = li.session_id
             WHERE li.status = 'pending'
               AND (li.expires_at IS NULL OR datetime(li.expires_at) >= datetime('now'))
             ORDER BY datetime(li.created_at) DESC
             LIMIT 200",
        )
        .fetch_all(db)
        .await?;
        let later_items = later_rows
            .into_iter()
            .map(|row| AssistantInboxLaterItem {
                id: row.get("id"),
                title: row.get("title"),
                content_preview: row.get("content_preview"),
                research_theme_id: row.get("research_interest_id"),
                research_theme_name: row.get("research_theme_name"),
                source_type: row.get("source_type"),
                source_app: row.get("source_app"),
                window_title: row.get("window_title"),
                retention_policy: row.get("retention_policy"),
                expires_at: row.get("expires_at"),
                created_at: row.get("created_at"),
            })
            .collect();

        let paper_rows = sqlx::query(
            "SELECT id, title, file_path, file_size_bytes, created_at
             FROM assistant_paper_candidates
             WHERE status = 'pending'
             ORDER BY datetime(created_at) DESC
             LIMIT 200",
        )
        .fetch_all(db)
        .await?;
        let paper_candidates = paper_rows
            .into_iter()
            .map(|row| {
                let file_path: Option<String> = row.get("file_path");
                let file_name = file_path.as_deref().map(display_file_name);
                AssistantInboxPaperCandidate {
                    id: row.get("id"),
                    title: row.get("title"),
                    file_name,
                    file_size_bytes: row
                        .get::<Option<i64>, _>("file_size_bytes")
                        .map(|size| size.max(0) as u64),
                    has_source_file: file_path.is_some(),
                    created_at: row.get("created_at"),
                }
            })
            .collect();

        let file_rows = sqlx::query(
            "SELECT id, file_name, kind, media_type, size_bytes, recommended_target,
                    expires_at, created_at
             FROM assistant_file_candidates
             WHERE status = 'pending' AND kind <> 'pdf'
               AND datetime(expires_at) >= datetime('now')
             ORDER BY datetime(created_at) DESC
             LIMIT 200",
        )
        .fetch_all(db)
        .await?;
        let file_candidates = file_rows
            .into_iter()
            .map(|row| AssistantInboxFileCandidate {
                id: row.get("id"),
                file_name: row.get("file_name"),
                kind: row.get("kind"),
                media_type: row.get("media_type"),
                size_bytes: row.get::<i64, _>("size_bytes").max(0) as u64,
                recommended_target: row.get("recommended_target"),
                expires_at: row.get("expires_at"),
                created_at: row.get("created_at"),
            })
            .collect();

        Ok(AssistantInboxOverview {
            later_items,
            paper_candidates,
            file_candidates,
        })
    }

    pub async fn convert_later_to_note(
        db: &SqlitePool,
        item_id: &str,
        selected_theme_id: Option<&str>,
    ) -> Result<AssistantInboxActionResult> {
        validate_id(item_id)?;
        let row = sqlx::query(
            "SELECT title, content, research_interest_id
             FROM assistant_later_items
             WHERE id = ? AND status = 'pending'
               AND (expires_at IS NULL OR datetime(expires_at) >= datetime('now'))",
        )
        .bind(item_id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| anyhow!("稍后处理项不存在、已失效或正在处理"))?;
        let stored_theme: Option<String> = row.get("research_interest_id");
        let theme =
            validate_research_theme(db, selected_theme_id.or(stored_theme.as_deref())).await?;
        let note_id = Uuid::new_v4().to_string();
        let mut transaction = db.begin().await?;
        let claimed = sqlx::query(
            "UPDATE assistant_later_items SET status = 'converting', updated_at = datetime('now')
             WHERE id = ? AND status = 'pending'
               AND (expires_at IS NULL OR datetime(expires_at) >= datetime('now'))",
        )
        .bind(item_id)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
        if claimed != 1 {
            return Err(anyhow!("稍后处理项已被处理，请刷新列表"));
        }
        sqlx::query(
            "INSERT INTO knowledge_notes (
                id, research_interest_id, title, content, tags, source_type, source_id,
                created_at, updated_at
             ) VALUES (?, ?, ?, ?, '[]', 'assistant', ?, datetime('now'), datetime('now'))",
        )
        .bind(&note_id)
        .bind(&theme)
        .bind(row.get::<String, _>("title"))
        .bind(row.get::<String, _>("content"))
        .bind(format!("later:{item_id}"))
        .execute(&mut *transaction)
        .await?;
        sqlx::query(
            "INSERT INTO assistant_imports (
                id, session_id, target, target_id, content_preview, source_type,
                source_app, source_app_bundle_id, window_title, captured_at,
                capture_region_x, capture_region_y, capture_region_width, capture_region_height,
                source_title, source_url, research_interest_id, preserve_original,
                retention_policy, expires_at, storage_location, estimated_size_bytes, created_at
             )
             SELECT ?, session_id, 'note', ?, '[text]', source_type,
                    source_app, source_app_bundle_id, window_title, captured_at,
                    capture_region_x, capture_region_y, capture_region_width, capture_region_height,
                    source_title, source_url, ?, 0, 'permanent', NULL,
                    'local_database:knowledge_notes', ?, datetime('now')
             FROM assistant_imports
             WHERE target = 'later' AND target_id = ?
             ORDER BY datetime(created_at) DESC LIMIT 1",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&note_id)
        .bind(theme.as_deref())
        .bind(row.get::<String, _>("content").len() as i64)
        .bind(item_id)
        .execute(&mut *transaction)
        .await?;
        sqlx::query("DELETE FROM assistant_later_items WHERE id = ? AND status = 'converting'")
            .bind(item_id)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(AssistantInboxActionResult {
            target: "note".to_string(),
            target_id: note_id,
        })
    }

    pub async fn discard_later(db: &SqlitePool, item_id: &str) -> Result<()> {
        delete_pending(db, "assistant_later_items", item_id).await
    }

    pub async fn claim_paper(db: &SqlitePool, candidate_id: &str) -> Result<ClaimedPaperCandidate> {
        validate_id(candidate_id)?;
        let mut transaction = db.begin().await?;
        let claimed = sqlx::query(
            "UPDATE assistant_paper_candidates SET status = 'importing'
             WHERE id = ? AND status = 'pending' AND file_path IS NOT NULL",
        )
        .bind(candidate_id)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
        if claimed != 1 {
            return Err(anyhow!("该候选尚未关联有效 PDF，或已被处理"));
        }
        let row =
            sqlx::query("SELECT title, file_path FROM assistant_paper_candidates WHERE id = ?")
                .bind(candidate_id)
                .fetch_one(&mut *transaction)
                .await?;
        transaction.commit().await?;
        Ok(ClaimedPaperCandidate {
            id: candidate_id.to_string(),
            title: row.get("title"),
            file_path: PathBuf::from(row.get::<String, _>("file_path")),
        })
    }

    pub async fn complete_paper(
        db: &SqlitePool,
        candidate_id: &str,
        paper_id: &str,
        research_theme_id: Option<&str>,
    ) -> Result<()> {
        let mut transaction = db.begin().await?;
        let candidate = sqlx::query(
            "SELECT session_id, file_size_bytes FROM assistant_paper_candidates
             WHERE id = ? AND status = 'importing'",
        )
        .bind(candidate_id)
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or_else(|| anyhow!("论文候选状态已变化，请刷新列表"))?;
        sqlx::query(
            "UPDATE assistant_paper_candidates
             SET status = 'imported', imported_at = datetime('now'), imported_paper_id = ?
             WHERE id = ? AND status = 'importing'",
        )
        .bind(paper_id)
        .bind(candidate_id)
        .execute(&mut *transaction)
        .await?;
        sqlx::query(
            "UPDATE assistant_file_candidates SET status = 'imported'
             WHERE id = ? AND status IN ('pending', 'importing')",
        )
        .bind(candidate_id)
        .execute(&mut *transaction)
        .await?;
        sqlx::query(
            "INSERT INTO assistant_imports (
                id, session_id, target, target_id, content_preview, source_type,
                captured_at, research_interest_id, preserve_original, retention_policy,
                storage_location, estimated_size_bytes, created_at
             ) VALUES (?, ?, 'paper', ?, '[pdf]', 'dropped_file', datetime('now'), ?, 1,
                       'permanent', 'local_database:papers', ?, datetime('now'))",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(candidate.get::<String, _>("session_id"))
        .bind(paper_id)
        .bind(research_theme_id)
        .bind(candidate.get::<Option<i64>, _>("file_size_bytes"))
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn restore_paper(db: &SqlitePool, candidate_id: &str) -> Result<()> {
        sqlx::query(
            "UPDATE assistant_paper_candidates SET status = 'pending'
             WHERE id = ? AND status = 'importing'",
        )
        .bind(candidate_id)
        .execute(db)
        .await?;
        Ok(())
    }

    pub async fn discard_paper(db: &SqlitePool, candidate_id: &str) -> Result<()> {
        validate_id(candidate_id)?;
        let mut transaction = db.begin().await?;
        let changed = sqlx::query(
            "UPDATE assistant_paper_candidates SET status = 'discarded'
             WHERE id = ? AND status = 'pending'",
        )
        .bind(candidate_id)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
        if changed != 1 {
            return Err(anyhow!("论文候选不存在或已被处理"));
        }
        sqlx::query(
            "UPDATE assistant_file_candidates SET status = 'discarded'
             WHERE id = ? AND status = 'pending'",
        )
        .bind(candidate_id)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn import_file(
        db: &SqlitePool,
        app_data_dir: &Path,
        candidate_id: &str,
        selected_theme_id: Option<&str>,
    ) -> Result<AssistantInboxActionResult> {
        validate_id(candidate_id)?;
        let theme = validate_research_theme(db, selected_theme_id).await?;
        let row = sqlx::query(
            "SELECT file_path, file_name, kind, size_bytes
             FROM assistant_file_candidates
             WHERE id = ? AND status = 'pending' AND kind <> 'pdf'
               AND datetime(expires_at) >= datetime('now')",
        )
        .bind(candidate_id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| anyhow!("文件候选不存在、已失效或正在处理"))?;
        let path = PathBuf::from(row.get::<String, _>("file_path"));
        let expected_name: String = row.get("file_name");
        let expected_kind: String = row.get("kind");
        let expected_size = row.get::<i64, _>("size_bytes").max(0) as u64;
        let validated = validate_file(&path)?;
        if validated.file_name != expected_name
            || validated.kind.as_str() != expected_kind
            || validated.size_bytes != expected_size
        {
            return Err(anyhow!("文件在确认后发生变化，请重新拖入"));
        }
        let claimed = sqlx::query(
            "UPDATE assistant_file_candidates SET status = 'importing'
             WHERE id = ? AND status = 'pending'
               AND datetime(expires_at) >= datetime('now')",
        )
        .bind(candidate_id)
        .execute(db)
        .await?
        .rows_affected();
        if claimed != 1 {
            return Err(anyhow!("文件候选已被处理，请刷新列表"));
        }

        let result = match validated.kind {
            FileCandidateKind::Markdown | FileCandidateKind::Text => {
                Self::store_file_note(
                    db,
                    candidate_id,
                    validated.path,
                    &expected_name,
                    theme.as_deref(),
                )
                .await
            }
            FileCandidateKind::Image => {
                Self::store_file_image(db, app_data_dir, candidate_id, validated, theme.as_deref())
                    .await
            }
            FileCandidateKind::Pdf => Err(anyhow!("PDF 应从论文候选区导入")),
        };
        if result.is_err() {
            let _ = sqlx::query(
                "UPDATE assistant_file_candidates SET status = 'pending'
                 WHERE id = ? AND status = 'importing'",
            )
            .bind(candidate_id)
            .execute(db)
            .await;
        }
        result
    }

    pub async fn discard_file(db: &SqlitePool, candidate_id: &str) -> Result<()> {
        validate_id(candidate_id)?;
        let changed = sqlx::query(
            "UPDATE assistant_file_candidates SET status = 'discarded'
             WHERE id = ? AND status = 'pending' AND kind <> 'pdf'",
        )
        .bind(candidate_id)
        .execute(db)
        .await?
        .rows_affected();
        if changed != 1 {
            return Err(anyhow!("文件候选不存在或已被处理"));
        }
        Ok(())
    }

    async fn store_file_note(
        db: &SqlitePool,
        candidate_id: &str,
        path: PathBuf,
        file_name: &str,
        theme_id: Option<&str>,
    ) -> Result<AssistantInboxActionResult> {
        let raw = std::fs::read_to_string(path)?;
        let content = limit_text_chars(raw.trim(), MAX_NOTE_TEXT_CHARS).content;
        if content.trim().is_empty() {
            return Err(anyhow!("文本文件没有可保存的内容"));
        }
        let title = Path::new(file_name)
            .file_stem()
            .and_then(|value| value.to_str())
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("导入的研究笔记");
        let note_id = Uuid::new_v4().to_string();
        let mut transaction = db.begin().await?;
        sqlx::query(
            "INSERT INTO knowledge_notes (
                id, research_interest_id, title, content, tags, source_type, source_id,
                created_at, updated_at
             ) VALUES (?, ?, ?, ?, '[]', 'assistant_file', ?, datetime('now'), datetime('now'))",
        )
        .bind(&note_id)
        .bind(theme_id)
        .bind(title)
        .bind(&content)
        .bind(format!("file:{candidate_id}"))
        .execute(&mut *transaction)
        .await?;
        record_file_import(
            &mut transaction,
            candidate_id,
            "note",
            &note_id,
            "[text]",
            theme_id,
            false,
            "local_database:knowledge_notes",
            content.len() as u64,
        )
        .await?;
        mark_file_imported(&mut transaction, candidate_id).await?;
        transaction.commit().await?;
        Ok(AssistantInboxActionResult {
            target: "note".to_string(),
            target_id: note_id,
        })
    }

    async fn store_file_image(
        db: &SqlitePool,
        app_data_dir: &Path,
        candidate_id: &str,
        file: super::file_candidate_service::ValidatedFile,
        theme_id: Option<&str>,
    ) -> Result<AssistantInboxActionResult> {
        let asset_id = Uuid::new_v4().to_string();
        let extension = match file.media_type.as_str() {
            "image/png" => "png",
            "image/jpeg" => "jpg",
            "image/webp" => "webp",
            _ => return Err(anyhow!("不支持的图片格式")),
        };
        let image_dir = app_data_dir.join("assistant_images");
        std::fs::create_dir_all(&image_dir)?;
        let destination = image_dir.join(format!("{asset_id}.{extension}"));
        std::fs::copy(&file.path, &destination)?;
        let storage = format!("app_data:assistant_images/{asset_id}.{extension}");
        let completion = async {
            let mut transaction = db.begin().await?;
            record_file_import(
                &mut transaction,
                candidate_id,
                "image",
                &asset_id,
                "[image]",
                theme_id,
                true,
                &storage,
                file.size_bytes,
            )
            .await?;
            mark_file_imported(&mut transaction, candidate_id).await?;
            transaction.commit().await?;
            Ok::<_, anyhow::Error>(())
        }
        .await;
        if let Err(error) = completion {
            let _ = std::fs::remove_file(&destination);
            return Err(error);
        }
        Ok(AssistantInboxActionResult {
            target: "image".to_string(),
            target_id: asset_id,
        })
    }
}

async fn record_file_import(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    candidate_id: &str,
    target: &str,
    target_id: &str,
    preview: &str,
    theme_id: Option<&str>,
    preserve_original: bool,
    storage_location: &str,
    stored_bytes: u64,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO assistant_imports (
            id, session_id, target, target_id, content_preview, source_type,
            captured_at, research_interest_id, preserve_original, retention_policy,
            storage_location, estimated_size_bytes, created_at
         ) VALUES (?, ?, ?, ?, ?, 'dropped_file', datetime('now'), ?, ?,
                   'permanent', ?, ?, datetime('now'))",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(format!("dropped-file:{candidate_id}"))
    .bind(target)
    .bind(target_id)
    .bind(preview)
    .bind(theme_id)
    .bind(i64::from(preserve_original))
    .bind(storage_location)
    .bind(stored_bytes as i64)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn mark_file_imported(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    candidate_id: &str,
) -> Result<()> {
    let changed = sqlx::query(
        "UPDATE assistant_file_candidates SET status = 'imported'
         WHERE id = ? AND status = 'importing'",
    )
    .bind(candidate_id)
    .execute(&mut **transaction)
    .await?
    .rows_affected();
    if changed != 1 {
        return Err(anyhow!("文件候选状态已变化，请刷新列表"));
    }
    Ok(())
}

async fn delete_pending(db: &SqlitePool, table: &str, id: &str) -> Result<()> {
    validate_id(id)?;
    let changed = sqlx::query(&format!(
        "DELETE FROM {table} WHERE id = ? AND status = 'pending'"
    ))
    .bind(id)
    .execute(db)
    .await?
    .rows_affected();
    if changed != 1 {
        return Err(anyhow!("收集箱条目不存在或已被处理"));
    }
    Ok(())
}

fn validate_id(id: &str) -> Result<()> {
    if Uuid::parse_str(id.trim()).is_err() {
        return Err(anyhow!("收集箱条目标识无效"));
    }
    Ok(())
}

fn display_file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("未命名 PDF")
        .chars()
        .take(255)
        .collect()
}

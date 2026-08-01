//! Safe inspection and persistence for files explicitly dropped onto the assistant panel.

use std::{
    collections::HashSet,
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

const MAX_FILES_PER_DROP: usize = 10;
const MAX_PDF_BYTES: u64 = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES: u64 = 20 * 1024 * 1024;
const MAX_TEXT_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum FileCandidateKind {
    Pdf,
    Image,
    Markdown,
    Text,
}

impl FileCandidateKind {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Pdf => "pdf",
            Self::Image => "image",
            Self::Markdown => "markdown",
            Self::Text => "text",
        }
    }

    fn recommended_target(self) -> &'static str {
        match self {
            Self::Pdf => "paper",
            Self::Image => "image",
            Self::Markdown | Self::Text => "note",
        }
    }

    fn max_bytes(self) -> u64 {
        match self {
            Self::Pdf => MAX_PDF_BYTES,
            Self::Image => MAX_IMAGE_BYTES,
            Self::Markdown | Self::Text => MAX_TEXT_BYTES,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantFileCandidate {
    pub id: String,
    pub file_name: String,
    pub kind: String,
    pub media_type: String,
    pub size_bytes: u64,
    pub recommended_target: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RejectedFileCandidate {
    pub file_name: String,
    pub reason: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileCandidateInspection {
    pub candidates: Vec<AssistantFileCandidate>,
    pub rejected: Vec<RejectedFileCandidate>,
}

pub(super) struct ValidatedFile {
    pub(super) path: PathBuf,
    pub(super) file_name: String,
    pub(super) kind: FileCandidateKind,
    pub(super) media_type: String,
    pub(super) size_bytes: u64,
}

pub struct FileCandidateService;

impl FileCandidateService {
    pub async fn inspect_and_create(
        db: &SqlitePool,
        paths: Vec<String>,
    ) -> Result<FileCandidateInspection> {
        if paths.is_empty() {
            return Ok(FileCandidateInspection::default());
        }

        let mut inspection = FileCandidateInspection::default();
        let mut seen = HashSet::new();
        for (index, raw_path) in paths.into_iter().enumerate() {
            let fallback_name = display_file_name(Path::new(&raw_path));
            if index >= MAX_FILES_PER_DROP {
                inspection.rejected.push(RejectedFileCandidate {
                    file_name: fallback_name,
                    reason: format!("单次最多拖入 {MAX_FILES_PER_DROP} 个文件"),
                });
                continue;
            }

            match validate_file(Path::new(&raw_path)) {
                Ok(file) => {
                    let path_key = file.path.to_string_lossy().to_string();
                    if !seen.insert(path_key) {
                        inspection.rejected.push(RejectedFileCandidate {
                            file_name: file.file_name,
                            reason: "同一文件在本次拖入中重复出现".to_string(),
                        });
                        continue;
                    }
                    let candidate = persist_preview_candidate(db, file).await?;
                    inspection.candidates.push(candidate);
                }
                Err(error) => inspection.rejected.push(RejectedFileCandidate {
                    file_name: fallback_name,
                    reason: error.to_string(),
                }),
            }
        }
        Ok(inspection)
    }

    pub async fn confirm(
        db: &SqlitePool,
        candidate_ids: Vec<String>,
    ) -> Result<Vec<AssistantFileCandidate>> {
        let ids = normalize_candidate_ids(candidate_ids)?;
        let mut transaction = db.begin().await?;
        let mut confirmed = Vec::with_capacity(ids.len());

        for id in ids {
            let row = sqlx::query(
                "SELECT file_path, file_name, kind, media_type, size_bytes, recommended_target
                 FROM assistant_file_candidates
                 WHERE id = ? AND status = 'preview'
                       AND datetime(expires_at) >= datetime('now')",
            )
            .bind(&id)
            .fetch_optional(&mut *transaction)
            .await?
            .ok_or_else(|| anyhow!("文件候选已失效，请重新拖入"))?;

            let path: String = row.get("file_path");
            let file_name: String = row.get("file_name");
            let kind: String = row.get("kind");
            let media_type: String = row.get("media_type");
            let size_bytes = row.get::<i64, _>("size_bytes").max(0) as u64;
            let recommended_target: String = row.get("recommended_target");

            // Confirm against the current filesystem state, not only the earlier preview.
            let current = validate_file(Path::new(&path))?;
            if current.file_name != file_name
                || current.kind.as_str() != kind
                || current.size_bytes != size_bytes
            {
                return Err(anyhow!("文件在预览后发生变化，请重新拖入"));
            }

            sqlx::query(
                "UPDATE assistant_file_candidates
                 SET status = 'pending', confirmed_at = datetime('now')
                 WHERE id = ?",
            )
            .bind(&id)
            .execute(&mut *transaction)
            .await?;

            if kind == "pdf" {
                let title = Path::new(&file_name)
                    .file_stem()
                    .and_then(|value| value.to_str())
                    .unwrap_or("Dropped PDF");
                sqlx::query(
                    "INSERT INTO assistant_paper_candidates (
                        id, session_id, title, content_preview, file_path,
                        file_size_bytes, status, created_at
                     ) VALUES (?, ?, ?, NULL, ?, ?, 'pending', datetime('now'))
                     ON CONFLICT(id) DO NOTHING",
                )
                .bind(&id)
                .bind(format!("dropped-file:{id}"))
                .bind(title)
                .bind(&path)
                .bind(size_bytes as i64)
                .execute(&mut *transaction)
                .await?;
            }

            confirmed.push(AssistantFileCandidate {
                id,
                file_name,
                kind,
                media_type,
                size_bytes,
                recommended_target,
            });
        }

        transaction.commit().await?;
        Ok(confirmed)
    }

    pub async fn discard(db: &SqlitePool, candidate_ids: Vec<String>) -> Result<u64> {
        let ids = normalize_candidate_ids(candidate_ids)?;
        let mut transaction = db.begin().await?;
        let mut deleted = 0;
        for id in ids {
            deleted += sqlx::query(
                "DELETE FROM assistant_file_candidates
                 WHERE id = ? AND status = 'preview'",
            )
            .bind(id)
            .execute(&mut *transaction)
            .await?
            .rows_affected();
        }
        transaction.commit().await?;
        Ok(deleted)
    }
}

fn normalize_candidate_ids(candidate_ids: Vec<String>) -> Result<Vec<String>> {
    if candidate_ids.is_empty() || candidate_ids.len() > MAX_FILES_PER_DROP {
        return Err(anyhow!("文件候选数量必须在 1 到 {MAX_FILES_PER_DROP} 之间"));
    }
    let mut ids = Vec::with_capacity(candidate_ids.len());
    for candidate_id in candidate_ids {
        let id = candidate_id.trim();
        if Uuid::parse_str(id).is_err() {
            return Err(anyhow!("文件候选标识无效"));
        }
        if !ids.iter().any(|existing| existing == id) {
            ids.push(id.to_string());
        }
    }
    Ok(ids)
}

async fn persist_preview_candidate(
    db: &SqlitePool,
    file: ValidatedFile,
) -> Result<AssistantFileCandidate> {
    let id = Uuid::new_v4().to_string();
    let candidate = AssistantFileCandidate {
        id: id.clone(),
        file_name: file.file_name,
        kind: file.kind.as_str().to_string(),
        media_type: file.media_type,
        size_bytes: file.size_bytes,
        recommended_target: file.kind.recommended_target().to_string(),
    };
    sqlx::query(
        "INSERT INTO assistant_file_candidates (
            id, file_path, file_name, kind, media_type, size_bytes,
            recommended_target, status, created_at, expires_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'preview', datetime('now'), datetime('now', '+24 hours'))",
    )
    .bind(&candidate.id)
    .bind(file.path.to_string_lossy().to_string())
    .bind(&candidate.file_name)
    .bind(&candidate.kind)
    .bind(&candidate.media_type)
    .bind(candidate.size_bytes as i64)
    .bind(&candidate.recommended_target)
    .execute(db)
    .await?;
    Ok(candidate)
}

pub(super) fn validate_file(path: &Path) -> Result<ValidatedFile> {
    let canonical = path
        .canonicalize()
        .map_err(|_| anyhow!("文件不存在或无法访问"))?;
    let metadata = canonical.metadata()?;
    if !metadata.is_file() {
        return Err(anyhow!("不支持文件夹或非普通文件"));
    }
    if metadata.len() == 0 {
        return Err(anyhow!("不支持空文件"));
    }

    let file_name = display_file_name(&canonical);
    let extension = canonical
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| anyhow!("不支持没有扩展名的文件"))?;
    let (kind, media_type) = match extension.as_str() {
        "pdf" => (FileCandidateKind::Pdf, "application/pdf"),
        "png" => (FileCandidateKind::Image, "image/png"),
        "jpg" | "jpeg" => (FileCandidateKind::Image, "image/jpeg"),
        "webp" => (FileCandidateKind::Image, "image/webp"),
        "md" | "markdown" => (FileCandidateKind::Markdown, "text/markdown"),
        "txt" => (FileCandidateKind::Text, "text/plain"),
        _ => return Err(anyhow!("仅支持 PDF、PNG、JPEG、WebP、Markdown 和 TXT")),
    };
    if metadata.len() > kind.max_bytes() {
        return Err(anyhow!(match kind {
            FileCandidateKind::Pdf => "PDF 超过 100 MB 限制",
            FileCandidateKind::Image => "图片超过 20 MB 限制",
            FileCandidateKind::Markdown | FileCandidateKind::Text => "文本文件超过 5 MB 限制",
        }));
    }

    validate_signature(&canonical, kind, &extension)?;
    Ok(ValidatedFile {
        path: canonical,
        file_name,
        kind,
        media_type: media_type.to_string(),
        size_bytes: metadata.len(),
    })
}

fn validate_signature(path: &Path, kind: FileCandidateKind, extension: &str) -> Result<()> {
    let mut file = File::open(path)?;
    let mut header = [0_u8; 12];
    let bytes_read = file.read(&mut header)?;
    let header = &header[..bytes_read];
    let valid = match kind {
        FileCandidateKind::Pdf => header.starts_with(b"%PDF-"),
        FileCandidateKind::Image if extension == "png" => {
            header.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A])
        }
        FileCandidateKind::Image if matches!(extension, "jpg" | "jpeg") => {
            header.starts_with(&[0xFF, 0xD8, 0xFF])
        }
        FileCandidateKind::Image if extension == "webp" => {
            header.len() >= 12 && &header[..4] == b"RIFF" && &header[8..12] == b"WEBP"
        }
        FileCandidateKind::Markdown | FileCandidateKind::Text => {
            let mut bytes = Vec::new();
            File::open(path)?.read_to_end(&mut bytes)?;
            std::str::from_utf8(&bytes).is_ok()
        }
        FileCandidateKind::Image => false,
    };
    if valid {
        Ok(())
    } else {
        Err(anyhow!("文件内容与扩展名不匹配或文本不是 UTF-8"))
    }
}

fn display_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("未命名文件")
        .chars()
        .take(255)
        .collect()
}

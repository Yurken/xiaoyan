//! Managed image assets created by confirmed desktop-assistant imports.

use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

use super::source_service::AssistantSourceRegion;

const IMAGE_DIRECTORY: &str = "assistant_images";
const STORAGE_PREFIX: &str = "app_data:assistant_images/";
const MAX_ASSETS: usize = 200;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantImageAsset {
    pub id: String,
    pub media_type: String,
    pub size_bytes: u64,
    pub available: bool,
    pub created_at: String,
    pub source_type: Option<String>,
    pub source_app: Option<String>,
    pub source_app_bundle_id: Option<String>,
    pub window_title: Option<String>,
    pub source_title: Option<String>,
    pub source_url: Option<String>,
    pub captured_at: Option<String>,
    pub capture_region: Option<AssistantSourceRegion>,
}

pub struct AssistantImageAssetService;

impl AssistantImageAssetService {
    pub async fn list(db: &SqlitePool, app_data_dir: &Path) -> Result<Vec<AssistantImageAsset>> {
        let rows = sqlx::query(
            "SELECT target_id, storage_location, estimated_size_bytes, created_at,
                    source_type, source_app, source_app_bundle_id, window_title,
                    source_title, source_url, captured_at, capture_region_x,
                    capture_region_y, capture_region_width, capture_region_height
             FROM assistant_imports
             WHERE target = 'image' AND target_id IS NOT NULL
             ORDER BY datetime(created_at) DESC, rowid DESC
             LIMIT 500",
        )
        .fetch_all(db)
        .await?;

        let mut seen = HashSet::new();
        let mut assets = Vec::new();
        for row in rows {
            let id: String = row.get("target_id");
            if !seen.insert(id.clone()) {
                continue;
            }
            let storage_location: Option<String> = row.get("storage_location");
            let resolved = storage_location
                .as_deref()
                .and_then(|location| safe_asset_path(app_data_dir, &id, location).ok());
            let media_type = storage_location
                .as_deref()
                .and_then(media_type_from_storage)
                .unwrap_or("application/octet-stream")
                .to_string();
            let file_size = resolved
                .as_ref()
                .and_then(|path| std::fs::metadata(path).ok())
                .map(|metadata| metadata.len());
            let width = row.get::<Option<i64>, _>("capture_region_width");
            let height = row.get::<Option<i64>, _>("capture_region_height");
            assets.push(AssistantImageAsset {
                id,
                media_type,
                size_bytes: file_size.unwrap_or_else(|| {
                    row.get::<Option<i64>, _>("estimated_size_bytes")
                        .unwrap_or(0)
                        .max(0) as u64
                }),
                available: resolved.as_ref().is_some_and(|path| path.is_file()),
                created_at: row.get("created_at"),
                source_type: row.get("source_type"),
                source_app: row.get("source_app"),
                source_app_bundle_id: row.get("source_app_bundle_id"),
                window_title: row.get("window_title"),
                source_title: row.get("source_title"),
                source_url: row.get("source_url"),
                captured_at: row.get("captured_at"),
                capture_region: width
                    .zip(height)
                    .map(|(width, height)| AssistantSourceRegion {
                        x: row.get("capture_region_x"),
                        y: row.get("capture_region_y"),
                        width: width.max(0) as u64,
                        height: height.max(0) as u64,
                    }),
            });
            if assets.len() == MAX_ASSETS {
                break;
            }
        }
        Ok(assets)
    }

    pub async fn delete(db: &SqlitePool, app_data_dir: &Path, asset_id: &str) -> Result<()> {
        let asset_id = validated_asset_id(asset_id)?;
        let rows = sqlx::query(
            "SELECT storage_location FROM assistant_imports
             WHERE target = 'image' AND target_id = ?",
        )
        .bind(asset_id)
        .fetch_all(db)
        .await?;
        if rows.is_empty() {
            return Err(anyhow!("图片资产不存在或已被删除"));
        }

        let mut paths = Vec::new();
        for row in rows {
            let location: Option<String> = row.get("storage_location");
            let location = location.ok_or_else(|| anyhow!("图片资产存储记录无效，已停止删除"))?;
            let path = safe_asset_path(app_data_dir, asset_id, &location)?;
            if !paths.contains(&path) {
                paths.push(path);
            }
        }

        let staged = stage_existing_files(paths)?;

        let deletion = async {
            let mut transaction = db.begin().await?;
            let deleted = sqlx::query(
                "DELETE FROM assistant_imports WHERE target = 'image' AND target_id = ?",
            )
            .bind(asset_id)
            .execute(&mut *transaction)
            .await?
            .rows_affected();
            if deleted == 0 {
                return Err(anyhow!("图片资产状态已变化，请刷新后重试"));
            }
            transaction.commit().await?;
            Ok::<_, anyhow::Error>(())
        }
        .await;
        if let Err(error) = deletion {
            restore_staged_files(&staged);
            return Err(error);
        }
        remove_staged_files(staged)?;
        Ok(())
    }

    pub async fn delete_all(db: &SqlitePool, app_data_dir: &Path) -> Result<u32> {
        let rows = sqlx::query(
            "SELECT target_id, storage_location FROM assistant_imports WHERE target = 'image'",
        )
        .fetch_all(db)
        .await?;
        if rows.is_empty() {
            return Ok(0);
        }

        // Validate every record before moving any file so a corrupt path cannot cause a partial
        // clear or escape the managed image directory.
        let mut asset_ids = HashSet::new();
        let mut paths = Vec::new();
        for row in rows {
            let asset_id: Option<String> = row.get("target_id");
            let asset_id = asset_id
                .as_deref()
                .ok_or_else(|| anyhow!("图片资产标识无效，已停止批量清理"))?;
            let location: Option<String> = row.get("storage_location");
            let location =
                location.ok_or_else(|| anyhow!("图片资产存储记录无效，已停止批量清理"))?;
            let path = safe_asset_path(app_data_dir, asset_id, &location)?;
            asset_ids.insert(asset_id.to_string());
            if !paths.contains(&path) {
                paths.push(path);
            }
        }

        let staged = stage_existing_files(paths)?;
        let deletion = async {
            let mut transaction = db.begin().await?;
            sqlx::query("DELETE FROM assistant_imports WHERE target = 'image'")
                .execute(&mut *transaction)
                .await?;
            transaction.commit().await?;
            Ok::<_, anyhow::Error>(())
        }
        .await;
        if let Err(error) = deletion {
            restore_staged_files(&staged);
            return Err(error);
        }
        remove_staged_files(staged)?;
        Ok(asset_ids.len().min(u32::MAX as usize) as u32)
    }
}

fn stage_existing_files(paths: Vec<PathBuf>) -> Result<Vec<(PathBuf, PathBuf)>> {
    let mut staged = Vec::new();
    for original in paths {
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
    Ok(staged)
}

fn remove_staged_files(staged: Vec<(PathBuf, PathBuf)>) -> Result<()> {
    for (_, staged_path) in staged {
        std::fs::remove_file(staged_path)?;
    }
    Ok(())
}

fn validated_asset_id(asset_id: &str) -> Result<&str> {
    let asset_id = asset_id.trim();
    let parsed = Uuid::parse_str(asset_id).map_err(|_| anyhow!("图片资产标识无效"))?;
    if parsed.to_string() != asset_id {
        return Err(anyhow!("图片资产标识无效"));
    }
    Ok(asset_id)
}

fn safe_asset_path(app_data_dir: &Path, asset_id: &str, storage_location: &str) -> Result<PathBuf> {
    validated_asset_id(asset_id)?;
    let relative = storage_location
        .strip_prefix(STORAGE_PREFIX)
        .ok_or_else(|| anyhow!("图片资产存储路径无效，已停止删除"))?;
    let relative_path = Path::new(relative);
    if relative_path.components().count() != 1
        || !matches!(
            relative_path.components().next(),
            Some(Component::Normal(_))
        )
    {
        return Err(anyhow!("图片资产存储路径无效，已停止删除"));
    }
    let stem = relative_path.file_stem().and_then(|value| value.to_str());
    let extension = relative_path.extension().and_then(|value| value.to_str());
    if stem != Some(asset_id) || !matches!(extension, Some("png" | "jpg" | "webp" | "gif")) {
        return Err(anyhow!("图片资产文件名与记录不匹配，已停止删除"));
    }
    Ok(app_data_dir.join(IMAGE_DIRECTORY).join(relative_path))
}

fn media_type_from_storage(storage_location: &str) -> Option<&'static str> {
    match Path::new(storage_location).extension()?.to_str()? {
        "png" => Some("image/png"),
        "jpg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        _ => None,
    }
}

fn restore_staged_files(staged: &[(PathBuf, PathBuf)]) {
    for (original, staged_path) in staged.iter().rev() {
        if staged_path.exists() {
            let _ = std::fs::rename(staged_path, original);
        }
    }
}

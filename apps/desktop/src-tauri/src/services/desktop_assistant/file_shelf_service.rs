//! Persistent local file shelf used by the desktop companion and the inbox.

use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

const MAX_ITEMS_PER_STASH: usize = 20;
const MAX_ITEM_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const SHELF_DIR: &str = "assistant-file-shelf";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileShelfItem {
    pub id: String,
    pub file_name: String,
    pub is_directory: bool,
    pub size_bytes: u64,
    pub source_type: String,
    pub available: bool,
    pub created_at: String,
    pub last_copied_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RejectedShelfItem {
    pub file_name: String,
    pub reason: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileShelfStashResult {
    pub items: Vec<FileShelfItem>,
    pub rejected: Vec<RejectedShelfItem>,
}

pub struct FileShelfService;

impl FileShelfService {
    pub async fn list(db: &SqlitePool) -> Result<Vec<FileShelfItem>> {
        let rows = sqlx::query(
            "SELECT id, file_name, stored_path, is_directory, size_bytes, source_type,
                    created_at, last_copied_at
             FROM assistant_file_shelf_items
             ORDER BY datetime(created_at) DESC, rowid DESC
             LIMIT 500",
        )
        .fetch_all(db)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| {
                let stored_path: String = row.get("stored_path");
                FileShelfItem {
                    id: row.get("id"),
                    file_name: row.get("file_name"),
                    is_directory: row.get::<i64, _>("is_directory") != 0,
                    size_bytes: row.get::<i64, _>("size_bytes").max(0) as u64,
                    source_type: row.get("source_type"),
                    available: Path::new(&stored_path).exists(),
                    created_at: row.get("created_at"),
                    last_copied_at: row.get("last_copied_at"),
                }
            })
            .collect())
    }

    pub async fn stash_paths(
        db: &SqlitePool,
        app_data_dir: &Path,
        paths: Vec<String>,
        source_type: &str,
    ) -> Result<FileShelfStashResult> {
        if !matches!(source_type, "drag" | "clipboard" | "picker") {
            return Err(anyhow!("中转来源无效"));
        }
        if paths.is_empty() {
            return Ok(FileShelfStashResult::default());
        }

        let shelf_root = app_data_dir.join(SHELF_DIR);
        fs::create_dir_all(&shelf_root).context("无法创建文件中转目录")?;
        let mut result = FileShelfStashResult::default();

        for (index, raw_path) in paths.into_iter().enumerate() {
            let path = PathBuf::from(&raw_path);
            let fallback_name = display_file_name(&path);
            if index >= MAX_ITEMS_PER_STASH {
                result.rejected.push(RejectedShelfItem {
                    file_name: fallback_name,
                    reason: format!("单次最多暂存 {MAX_ITEMS_PER_STASH} 项"),
                });
                continue;
            }

            let id = Uuid::new_v4().to_string();
            let item_dir = shelf_root.join(&id);
            let copy_dir = item_dir.clone();
            let copied = tokio::task::spawn_blocking(move || {
                let source = prepare_source(&path)?;
                if copy_dir.starts_with(&source.path) {
                    return Err(anyhow!("不能把文件中转站目录暂存到自身"));
                }
                let stored_path = copy_dir.join(&source.file_name);
                if let Err(error) = copy_source(&source.path, &stored_path) {
                    let _ = fs::remove_dir_all(&copy_dir);
                    return Err(error);
                }
                Ok::<_, anyhow::Error>((source, stored_path))
            })
            .await
            .map_err(|error| anyhow!("文件暂存任务失败：{error}"))?;

            match copied {
                Ok((source, stored_path)) => {
                    let insert = sqlx::query(
                        "INSERT INTO assistant_file_shelf_items (
                            id, file_name, stored_path, original_path, is_directory,
                            size_bytes, source_type, created_at
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
                    )
                    .bind(&id)
                    .bind(&source.file_name)
                    .bind(stored_path.to_string_lossy().to_string())
                    .bind(source.path.to_string_lossy().to_string())
                    .bind(i64::from(source.is_directory))
                    .bind(source.size_bytes.min(i64::MAX as u64) as i64)
                    .bind(source_type)
                    .execute(db)
                    .await;
                    if let Err(error) = insert {
                        let _ = fs::remove_dir_all(&item_dir);
                        return Err(error.into());
                    }

                    result.items.push(FileShelfItem {
                        id,
                        file_name: source.file_name,
                        is_directory: source.is_directory,
                        size_bytes: source.size_bytes,
                        source_type: source_type.to_string(),
                        available: true,
                        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                        last_copied_at: None,
                    });
                }
                Err(error) => result.rejected.push(RejectedShelfItem {
                    file_name: fallback_name,
                    reason: error.to_string(),
                }),
            }
        }
        Ok(result)
    }

    pub async fn copy_to_clipboard(db: &SqlitePool, item_ids: Vec<String>) -> Result<usize> {
        let ids = normalize_ids(item_ids)?;
        let paths = load_paths(db, &ids).await?;
        let clipboard_paths = paths.clone();
        tokio::task::spawn_blocking(move || write_file_paths_to_clipboard(&clipboard_paths))
            .await
            .map_err(|error| anyhow!("写入剪贴板任务失败：{error}"))??;

        for id in &ids {
            sqlx::query(
                "UPDATE assistant_file_shelf_items SET last_copied_at = datetime('now') WHERE id = ?",
            )
            .bind(id)
            .execute(db)
            .await?;
        }
        Ok(paths.len())
    }

    pub async fn remove(
        db: &SqlitePool,
        app_data_dir: &Path,
        item_ids: Vec<String>,
    ) -> Result<usize> {
        let ids = normalize_ids(item_ids)?;
        let paths = load_paths_allow_missing(db, &ids).await?;
        let shelf_root = app_data_dir.join(SHELF_DIR);
        let delete_targets = ids
            .iter()
            .zip(&paths)
            .map(|(id, path)| {
                let item_dir = path.parent().ok_or_else(|| anyhow!("中转副本路径无效"))?;
                if item_dir.parent() != Some(shelf_root.as_path())
                    || item_dir.file_name().and_then(|value| value.to_str()) != Some(id)
                {
                    return Err(anyhow!("拒绝移除中转目录以外的文件"));
                }
                Ok(item_dir.to_path_buf())
            })
            .collect::<Result<Vec<_>>>()?;
        tokio::task::spawn_blocking(move || {
            for item_dir in delete_targets {
                if item_dir.exists() {
                    fs::remove_dir_all(&item_dir)
                        .with_context(|| format!("无法移除中转副本：{}", item_dir.display()))?;
                }
            }
            Ok::<_, anyhow::Error>(())
        })
        .await
        .map_err(|error| anyhow!("移除中转副本任务失败：{error}"))??;

        let mut removed = 0;
        for id in ids {
            removed += sqlx::query("DELETE FROM assistant_file_shelf_items WHERE id = ?")
                .bind(id)
                .execute(db)
                .await?
                .rows_affected() as usize;
        }
        Ok(removed)
    }

    pub async fn reveal(db: &SqlitePool, item_id: String) -> Result<()> {
        let paths = load_paths(db, &normalize_ids(vec![item_id])?).await?;
        let path = paths[0].clone();
        tokio::task::spawn_blocking(move || reveal_path(&path))
            .await
            .map_err(|error| anyhow!("打开 Finder 任务失败：{error}"))?
    }
}

#[derive(Debug)]
struct PreparedSource {
    path: PathBuf,
    file_name: String,
    is_directory: bool,
    size_bytes: u64,
}

fn prepare_source(path: &Path) -> Result<PreparedSource> {
    let original_metadata =
        fs::symlink_metadata(path).map_err(|_| anyhow!("文件或文件夹不存在"))?;
    if original_metadata.file_type().is_symlink() {
        return Err(anyhow!("暂不支持符号链接"));
    }
    let canonical = path
        .canonicalize()
        .map_err(|_| anyhow!("文件或文件夹不存在"))?;
    let metadata = fs::symlink_metadata(&canonical)?;
    if metadata.file_type().is_symlink() {
        return Err(anyhow!("暂不支持符号链接"));
    }
    if !metadata.is_file() && !metadata.is_dir() {
        return Err(anyhow!("仅支持普通文件或文件夹"));
    }
    let size_bytes = path_size(&canonical)?;
    if size_bytes > MAX_ITEM_BYTES {
        return Err(anyhow!("单项暂存大小不能超过 2 GB"));
    }
    Ok(PreparedSource {
        file_name: display_file_name(&canonical),
        path: canonical,
        is_directory: metadata.is_dir(),
        size_bytes,
    })
}

fn path_size(path: &Path) -> Result<u64> {
    let metadata = fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() {
        return Err(anyhow!("文件夹内含符号链接，暂不支持暂存"));
    }
    if metadata.is_file() {
        return Ok(metadata.len());
    }
    let mut total = 0_u64;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        total = total
            .checked_add(path_size(&entry.path())?)
            .ok_or_else(|| anyhow!("文件夹大小超出支持范围"))?;
        if total > MAX_ITEM_BYTES {
            return Ok(total);
        }
    }
    Ok(total)
}

fn copy_source(source: &Path, destination: &Path) -> Result<()> {
    let metadata = fs::symlink_metadata(source)?;
    if metadata.is_file() {
        let parent = destination
            .parent()
            .ok_or_else(|| anyhow!("中转路径无效"))?;
        fs::create_dir_all(parent)?;
        fs::copy(source, destination).context("无法复制文件")?;
        return Ok(());
    }
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let entry_type = entry.file_type()?;
        if entry_type.is_symlink() {
            return Err(anyhow!("文件夹内含符号链接，暂不支持暂存"));
        }
        copy_source(&entry.path(), &destination.join(entry.file_name()))?;
    }
    Ok(())
}

fn normalize_ids(item_ids: Vec<String>) -> Result<Vec<String>> {
    if item_ids.is_empty() || item_ids.len() > 500 {
        return Err(anyhow!("请选择 1 到 500 个中转项"));
    }
    let mut ids = Vec::with_capacity(item_ids.len());
    for id in item_ids {
        let trimmed = id.trim();
        if Uuid::parse_str(trimmed).is_err() {
            return Err(anyhow!("中转项标识无效"));
        }
        if !ids.iter().any(|existing| existing == trimmed) {
            ids.push(trimmed.to_string());
        }
    }
    Ok(ids)
}

async fn load_paths(db: &SqlitePool, ids: &[String]) -> Result<Vec<PathBuf>> {
    let paths = load_paths_allow_missing(db, ids).await?;
    if let Some(missing) = paths.iter().find(|path| !path.exists()) {
        return Err(anyhow!("中转副本已丢失：{}", display_file_name(missing)));
    }
    Ok(paths)
}

async fn load_paths_allow_missing(db: &SqlitePool, ids: &[String]) -> Result<Vec<PathBuf>> {
    let mut paths = Vec::with_capacity(ids.len());
    for id in ids {
        let path = sqlx::query_scalar::<_, String>(
            "SELECT stored_path FROM assistant_file_shelf_items WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| anyhow!("中转项不存在或已被移除"))?;
        paths.push(PathBuf::from(path));
    }
    Ok(paths)
}

#[cfg(target_os = "macos")]
pub fn read_file_paths_from_clipboard() -> Result<Vec<String>> {
    const SCRIPT: &str = r#"
try
    set clipboardItems to the clipboard as alias list
on error
    try
        set clipboardItems to {the clipboard as alias}
    on error
        return ""
    end try
end try
set AppleScript's text item delimiters to character id 31
set pathItems to {}
repeat with clipboardItem in clipboardItems
    set end of pathItems to POSIX path of clipboardItem
end repeat
return pathItems as text
"#;
    let output = Command::new("osascript")
        .args(["-e", SCRIPT])
        .output()
        .context("无法读取系统剪贴板")?;
    if !output.status.success() {
        return Err(anyhow!("无法读取剪贴板中的文件"));
    }
    let mut value = String::from_utf8(output.stdout).context("剪贴板文件路径不是 UTF-8")?;
    while matches!(value.as_bytes().last(), Some(b'\n' | b'\r')) {
        value.pop();
    }
    Ok(value
        .split('\u{1f}')
        .filter(|path| !path.is_empty())
        .map(ToString::to_string)
        .collect())
}

#[cfg(not(target_os = "macos"))]
pub fn read_file_paths_from_clipboard() -> Result<Vec<String>> {
    Err(anyhow!("从剪贴板暂存文件目前仅支持 macOS"))
}

#[cfg(target_os = "macos")]
fn write_file_paths_to_clipboard(paths: &[PathBuf]) -> Result<()> {
    const SCRIPT: &str = r#"
on run argv
    set fileItems to {}
    repeat with rawPath in argv
        set end of fileItems to (POSIX file (contents of rawPath) as alias)
    end repeat
    set the clipboard to fileItems
    return count of fileItems
end run
"#;
    let output = Command::new("osascript")
        .args(["-e", SCRIPT, "--"])
        .args(paths)
        .output()
        .context("无法写入系统剪贴板")?;
    if output.status.success() {
        Ok(())
    } else {
        Err(anyhow!("无法把所选文件复制到系统剪贴板"))
    }
}

#[cfg(not(target_os = "macos"))]
fn write_file_paths_to_clipboard(_paths: &[PathBuf]) -> Result<()> {
    Err(anyhow!("复制中转文件目前仅支持 macOS"))
}

#[cfg(target_os = "macos")]
fn reveal_path(path: &Path) -> Result<()> {
    let status = Command::new("open")
        .arg("-R")
        .arg(path)
        .status()
        .context("无法打开 Finder")?;
    if status.success() {
        Ok(())
    } else {
        Err(anyhow!("无法在 Finder 中显示中转副本"))
    }
}

#[cfg(not(target_os = "macos"))]
fn reveal_path(_path: &Path) -> Result<()> {
    Err(anyhow!("在文件管理器中显示目前仅支持 macOS"))
}

fn display_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("未命名项目")
        .chars()
        .take(255)
        .collect()
}

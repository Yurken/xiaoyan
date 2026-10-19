//! Sync asset preparation and transfer. All filesystem/network I/O stays outside
//! the local merge transaction; only selected rows require a resolved asset.
use super::{
    effective_ts, is_asset_table, is_newer_timestamp, pk_column, MergePlan, ASSETS_DIR,
};
use crate::services::settings_service::{decrypt_blob, encrypt_blob, MAGIC_SYNC};
use crate::services::webdav_service::{self, WebdavConfig};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs::{File, OpenOptions};
use std::future::Future;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub(super) type ResolvedAssets = HashMap<String, Result<String, String>>;

fn hash_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path)
        .map_err(|error| format!("读取同步附件失败（{}）: {error}", path.display()))?;
    if !file.metadata().map_err(|error| error.to_string())?.is_file() {
        return Err(format!("同步附件不是普通文件: {}", path.display()));
    }
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = match file.read(&mut buffer) {
            Ok(count) => count,
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(format!("读取同步附件失败（{}）: {error}", path.display())),
        };
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn validate_asset_name(hash: &str, extension: &str) -> Result<(), String> {
    if hash.len() != 64
        || !hash.bytes().all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err("同步附件哈希格式无效".to_string());
    }
    if !extension.is_empty()
        && (!extension.starts_with('.')
            || extension.len() == 1
            || (extension.ends_with('.') || extension.ends_with(' '))
            || extension.chars().any(|c| c.is_control() || "/\\:<>\"|?*".contains(c)))
    {
        return Err("同步附件扩展名无效".to_string());
    }
    Ok(())
}

pub(super) fn prepare_snapshot_assets(
    tables: &mut BTreeMap<String, Vec<Value>>,
) -> Result<(BTreeMap<String, String>, HashMap<String, String>), String> {
    let mut assets = BTreeMap::new();
    let mut sources = HashMap::new();
    let mut source_hashes: HashMap<String, String> = HashMap::new();
    for (table, rows) in tables {
        if !is_asset_table(table) {
            continue;
        }
        for row in rows {
            let Value::Object(object) = row else {
                continue;
            };
            let Some(path) = object.get("file_path").and_then(Value::as_str) else {
                continue;
            };
            if path.is_empty() {
                continue;
            }
            if path.starts_with("asset://") {
                return Err(format!("本地 {table} 附件尚未解析，无法发布同步快照"));
            }
            let hash = match source_hashes.get(path) {
                Some(hash) => hash.clone(),
                None => {
                    let hash = hash_file(Path::new(path))?;
                    source_hashes.insert(path.to_string(), hash.clone());
                    hash
                }
            };
            let extension = Path::new(path)
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| format!(".{extension}"))
                .unwrap_or_default();
            validate_asset_name(&hash, &extension)?;
            assets.insert(hash.clone(), extension);
            sources.entry(hash.clone()).or_insert_with(|| path.to_string());
            object.insert("file_path".to_string(), Value::String(format!("asset://{hash}")));
        }
    }
    Ok((assets, sources))
}

async fn upload_assets_with<F, Fut>(
    sources: &HashMap<String, String>,
    existing: &HashSet<String>,
    mut upload: F,
) -> Result<usize, String>
where
    F: FnMut(String, Vec<u8>) -> Fut,
    Fut: Future<Output = Result<(), String>>,
{
    let mut uploaded = 0;
    for (hash, source) in sources {
        validate_asset_name(hash, "")?;
        if existing.contains(hash) {
            continue;
        }
        let bytes = std::fs::read(source)
            .map_err(|error| format!("读取待上传附件失败（{source}）: {error}"))?;
        if format!("{:x}", Sha256::digest(&bytes)) != *hash {
            return Err(format!("同步附件在快照后发生变化，请重试: {source}"));
        }
        upload(hash.clone(), bytes).await?;
        uploaded += 1;
    }
    Ok(uploaded)
}

pub(super) async fn upload_assets(
    config: &WebdavConfig,
    sources: &HashMap<String, String>,
    existing: &HashSet<String>,
) -> Result<usize, String> {
    upload_assets_with(sources, existing, |hash, bytes| async move {
        let encrypted = encrypt_blob(&bytes, &config.password, MAGIC_SYNC)?;
        drop(bytes);
        webdav_service::put_file(
            config,
            &format!("{ASSETS_DIR}/{hash}.rcblob"),
            encrypted.as_bytes(),
        )
        .await
    })
    .await
}

struct PendingAsset {
    path: PathBuf,
    installed: bool,
}

impl Drop for PendingAsset {
    fn drop(&mut self) {
        if !self.installed {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

fn install_asset(dir: &Path, local: &Path, bytes: &[u8]) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|error| format!("创建资产目录失败: {error}"))?;
    let temporary = dir.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    // Only delete a temporary path after successfully creating our own file.
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|error| format!("创建临时附件失败: {error}"))?;
    let mut pending = PendingAsset {
        path: temporary,
        installed: false,
    };
    let written = file.write_all(bytes).and_then(|_| file.sync_all());
    drop(file);
    written.map_err(|error| format!("写入同步附件失败: {error}"))?;
    std::fs::rename(&pending.path, local)
        .map_err(|error| format!("发布同步附件失败: {error}"))?;
    pending.installed = true;
    Ok(())
}

async fn resolve_asset_with<F, Fut>(
    dir: &Path,
    hash: &str,
    extension: &str,
    fetch: F,
) -> Result<(String, bool), String>
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Result<Option<Vec<u8>>, String>>,
{
    validate_asset_name(hash, extension)?;
    let local = dir.join(format!("{hash}{extension}"));
    if hash_file(&local).as_deref() == Ok(hash) {
        return Ok((local.to_string_lossy().to_string(), false));
    }
    let bytes = fetch(hash.to_string())
        .await?
        .ok_or_else(|| format!("远端同步附件缺失: {hash}"))?;
    if format!("{:x}", Sha256::digest(&bytes)) != hash {
        return Err(format!("同步附件内容与哈希不符: {hash}"));
    }
    install_asset(dir, &local, &bytes)?;
    Ok((local.to_string_lossy().to_string(), true))
}

pub(super) async fn download_assets(
    config: &WebdavConfig,
    app_data_dir: &Path,
    plan: &MergePlan,
) -> (ResolvedAssets, usize) {
    let mut needed = HashSet::new();
    for (table, bucket) in &plan.rows {
        if !is_asset_table(table) {
            continue;
        }
        for (id, row) in bucket {
            if plan.tombstones.get(&(table.clone(), id.clone())).is_some_and(|deleted_at| {
                !is_newer_timestamp(&effective_ts(table, row), deleted_at)
            }) {
                continue;
            }
            if let Some(hash) = row
                .get("file_path")
                .and_then(Value::as_str)
                .and_then(|path| path.strip_prefix("asset://"))
            {
                needed.insert(hash.to_string());
            }
        }
    }

    let dir = app_data_dir.join("sync_assets");
    let mut resolved = HashMap::new();
    let mut downloaded = 0;
    for hash in needed {
        let extension = plan.assets.get(&hash).map(String::as_str).unwrap_or("");
        let result = resolve_asset_with(&dir, &hash, extension, |hash| async move {
            let Some(encrypted) =
                webdav_service::get_file(config, &format!("{ASSETS_DIR}/{hash}.rcblob")).await?
            else {
                return Ok(None);
            };
            let text = std::str::from_utf8(&encrypted)
                .map_err(|_| format!("同步附件加密数据损坏: {hash}"))?;
            decrypt_blob(text, &config.password, MAGIC_SYNC).map(Some)
        })
        .await;
        // Defer per-asset failures: the transaction may skip every referencing
        // row because a newer local edit or a local tombstone wins.
        resolved.insert(hash, result.map(|(path, fetched)| {
            downloaded += usize::from(fetched);
            path
        }));
    }
    (resolved, downloaded)
}

/// Called only after the transaction has selected a remote row for upsert.
/// A failure rolls back the whole merge instead of replacing a good path with "".
pub(super) fn resolve_row_asset_path(
    table: &str,
    row: &mut Map<String, Value>,
    assets: &ResolvedAssets,
) -> Result<(), String> {
    if !is_asset_table(table) {
        return Ok(());
    }
    let Some(value) = row.get("file_path") else {
        return Ok(());
    };
    if value.is_null() || value.as_str() == Some("") {
        return Ok(());
    }
    let id = row.get(pk_column(table)).and_then(Value::as_str).unwrap_or("?");
    let hash = value
        .as_str()
        .and_then(|path| path.strip_prefix("asset://"))
        .ok_or_else(|| format!("远端 {table}/{id} 附件不是可用的同步引用"))?;
    let local = match assets.get(hash) {
        Some(Ok(path)) if !path.is_empty() => path.clone(),
        Some(Err(error)) => return Err(format!("{table}/{id} 附件未就绪: {error}")),
        _ => return Err(format!("{table}/{id} 附件未解析: {hash}")),
    };
    row.insert("file_path".to_string(), Value::String(local));
    Ok(())
}

#[cfg(test)]
#[path = "sync_assets_tests.rs"]
mod tests;

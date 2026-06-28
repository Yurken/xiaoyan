//! 基于「每设备独立状态文件」的无冲突 WebDAV 同步。
//!
//! 设计要点（详见 docs 与计划）：
//! - 每台设备只写自己的 `devices/{device_id}.rcstate`，因此 WebDAV 上永远不存在
//!   对同一文件的并发写 → 从根本上消除「丢更新」。
//! - 设备间通过确定性合并收敛：按主键做记录级 Last-Write-Wins（比较 `updated_at`，
//!   纯追加表回退 `created_at`），删除通过墓碑传播。
//! - 资产（PDF 等）按内容哈希存为 `assets/{sha256}.rcblob`（一次写入、去重），
//!   状态文件只保存 `asset://{hash}` 引用，保持精简、避免每次同步重传大文件。
//! - 所有上行/下行文件均用 WebDAV 密码经 AES-256-GCM 加密。

use crate::services::settings_service::{
    decrypt_blob, encrypt_blob, is_local_only_settings_key, row_to_json, BACKUP_TABLES, MAGIC_SYNC,
};
use crate::services::webdav_service::{self, WebdavConfig};
use crate::state::{default_settings, AppState};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::Path;
use tauri::{Emitter, Manager};

const SYNC_ROOT: &str = "xiaoyan-sync";
const DEVICES_DIR: &str = "xiaoyan-sync/devices";
const ASSETS_DIR: &str = "xiaoyan-sync/assets";
const SNAPSHOT_VERSION: u32 = 1;
const ASSET_TABLES: &[&str] = &["papers", "paper_figures", "experiment_attachments"];

/// 同步状态，供前端订阅展示。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SyncStatus {
    pub configured: bool,
    pub running: bool,
    pub last_sync_at: Option<String>,
    pub last_error: Option<String>,
    pub last_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncSummary {
    pub pushed: bool,
    pub pulled_devices: usize,
    pub rows_applied: usize,
    pub rows_deleted: usize,
    pub assets_uploaded: usize,
    pub assets_downloaded: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct DeviceSnapshot {
    version: u32,
    device_id: String,
    generated_at: String,
    /// table -> rows（每行为 JSON object；资产列已替换为 asset:// 引用，重列已剔除）
    tables: BTreeMap<String, Vec<serde_json::Value>>,
    tombstones: Vec<Tombstone>,
    /// 资产哈希 -> 扩展名（含点，可能为空），用于下载后恢复文件名
    assets: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Tombstone {
    table: String,
    id: String,
    deleted_at: String,
}

// ── 表元信息辅助 ──────────────────────────────────────────────────

fn pk_column(table: &str) -> &'static str {
    if table == "settings" {
        "key"
    } else {
        "id"
    }
}

/// 记录级合并所用的时钟列：可变表用 updated_at，纯追加表用 created_at。
fn ts_column(table: &str) -> &'static str {
    if crate::db::SYNC_MUTABLE_TABLES.contains(&table) {
        "updated_at"
    } else {
        "created_at"
    }
}

/// 体积大且本地可再生、不参与同步的列。
fn is_excluded_column(table: &str, column: &str) -> bool {
    matches!(
        (table, column),
        ("paper_chunks", "embedding")
            | ("knowledge_notes", "embedding")
            // 对话图片为 base64 大字段，仅本地多轮上下文用，不进全量同步快照，避免快照体积暴涨。
            | ("chat_messages", "images")
    )
}

fn is_asset_table(table: &str) -> bool {
    ASSET_TABLES.contains(&table)
}

fn effective_ts(table: &str, row: &serde_json::Value) -> String {
    row.get(ts_column(table))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .or_else(|| row.get("created_at").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string()
}

// ── sync_meta 读写 ───────────────────────────────────────────────

async fn meta_get(db: &sqlx::SqlitePool, key: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, String>("SELECT value FROM sync_meta WHERE key = ?")
        .bind(key)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())
}

async fn meta_set(db: &sqlx::SqlitePool, key: &str, value: &str) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 返回本设备稳定 id（首次生成并持久化到 sync_meta）。
async fn device_id(db: &sqlx::SqlitePool) -> Result<String, String> {
    if let Some(existing) = meta_get(db, "device_id").await? {
        if !existing.is_empty() {
            return Ok(existing);
        }
    }
    let id = uuid::Uuid::new_v4().to_string();
    meta_set(db, "device_id", &id).await?;
    Ok(id)
}

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

// ── 删除检测（基线对比）──────────────────────────────────────────

/// 对比上次同步保存的「行 id 基线」与当前行集合，为本地删除生成墓碑。
async fn detect_local_deletes(db: &sqlx::SqlitePool) -> Result<(), String> {
    let deleted_at = now_iso();
    for &table in BACKUP_TABLES {
        let pk = pk_column(table);
        let current: HashSet<String> =
            sqlx::query_scalar::<_, String>(&format!("SELECT {pk} FROM {table}"))
                .fetch_all(db)
                .await
                .map_err(|e| format!("读取 {table} 主键失败: {e}"))?
                .into_iter()
                .collect();

        let baseline_key = format!("baseline:{table}");
        let baseline: HashSet<String> = match meta_get(db, &baseline_key).await? {
            Some(json) => serde_json::from_str(&json).unwrap_or_default(),
            None => {
                // 首次同步该表：仅建立基线，不视为删除。
                let cur_vec: Vec<&String> = current.iter().collect();
                meta_set(db, &baseline_key, &serde_json::to_string(&cur_vec).unwrap()).await?;
                continue;
            }
        };

        for gone in baseline.difference(&current) {
            sqlx::query(
                "INSERT INTO sync_tombstones (entity_table, entity_id, deleted_at) VALUES (?, ?, ?)
                 ON CONFLICT(entity_table, entity_id) DO NOTHING",
            )
            .bind(table)
            .bind(gone)
            .bind(&deleted_at)
            .execute(db)
            .await
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 合并完成后刷新所有表的基线为当前状态。
async fn update_baselines(db: &sqlx::SqlitePool) -> Result<(), String> {
    for &table in BACKUP_TABLES {
        let pk = pk_column(table);
        let current: Vec<String> =
            sqlx::query_scalar::<_, String>(&format!("SELECT {pk} FROM {table}"))
                .fetch_all(db)
                .await
                .map_err(|e| e.to_string())?;
        meta_set(
            db,
            &format!("baseline:{table}"),
            &serde_json::to_string(&current).unwrap(),
        )
        .await?;
    }
    Ok(())
}

// ── 快照构建 ─────────────────────────────────────────────────────

/// 构建本设备快照；返回 (快照, 资产哈希->本地源文件路径)。
async fn build_snapshot(
    db: &sqlx::SqlitePool,
    device: &str,
) -> Result<(DeviceSnapshot, HashMap<String, String>), String> {
    let mut tables: BTreeMap<String, Vec<serde_json::Value>> = BTreeMap::new();
    let mut assets: BTreeMap<String, String> = BTreeMap::new();
    let mut asset_sources: HashMap<String, String> = HashMap::new();

    for &table in BACKUP_TABLES {
        let rows = sqlx::query(&format!("SELECT * FROM {table}"))
            .fetch_all(db)
            .await
            .map_err(|e| format!("导出 {table} 失败: {e}"))?;

        let mut arr = Vec::with_capacity(rows.len());
        for row in &rows {
            let value = row_to_json(row)?;
            let Some(mut obj) = value.as_object().cloned() else {
                continue;
            };

            if table == "settings" {
                if let Some(key) = obj.get("key").and_then(|v| v.as_str()) {
                    if is_local_only_settings_key(key) {
                        continue;
                    }
                }
            }

            obj.retain(|col, _| !is_excluded_column(table, col));

            if is_asset_table(table) {
                if let Some(fp) = obj.get("file_path").and_then(|v| v.as_str()) {
                    if !fp.is_empty() && !fp.starts_with("asset://") {
                        if let Some((hash, ext)) = hash_file(fp) {
                            assets.insert(hash.clone(), ext);
                            asset_sources
                                .entry(hash.clone())
                                .or_insert_with(|| fp.to_string());
                            obj.insert(
                                "file_path".into(),
                                serde_json::Value::String(format!("asset://{hash}")),
                            );
                        }
                    }
                }
            }

            arr.push(serde_json::Value::Object(obj));
        }
        tables.insert(table.to_string(), arr);
    }

    let tombstones = sqlx::query_as::<_, (String, String, String)>(
        "SELECT entity_table, entity_id, deleted_at FROM sync_tombstones",
    )
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?
    .into_iter()
    .map(|(table, id, deleted_at)| Tombstone {
        table,
        id,
        deleted_at,
    })
    .collect();

    let snapshot = DeviceSnapshot {
        version: SNAPSHOT_VERSION,
        device_id: device.to_string(),
        generated_at: now_iso(),
        tables,
        tombstones,
        assets,
    };
    Ok((snapshot, asset_sources))
}

fn hash_file(path: &str) -> Option<(String, String)> {
    let bytes = std::fs::read(path).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{e}"))
        .unwrap_or_default();
    Some((hash, ext))
}

// ── 合并 ─────────────────────────────────────────────────────────

struct MergePlan {
    /// table -> (id -> 最新行)
    rows: HashMap<String, HashMap<String, serde_json::Value>>,
    /// (table, id) -> 最新 deleted_at
    tombstones: HashMap<(String, String), String>,
    /// 资产哈希 -> 扩展名
    assets: BTreeMap<String, String>,
}

fn combine_snapshots(snapshots: &[DeviceSnapshot]) -> MergePlan {
    let mut rows: HashMap<String, HashMap<String, serde_json::Value>> = HashMap::new();
    let mut tombstones: HashMap<(String, String), String> = HashMap::new();
    let mut assets: BTreeMap<String, String> = BTreeMap::new();

    for snap in snapshots {
        for (table, list) in &snap.tables {
            let pk = pk_column(table);
            let bucket = rows.entry(table.clone()).or_default();
            for row in list {
                let Some(id) = row.get(pk).and_then(|v| v.as_str()) else {
                    continue;
                };
                let ts = effective_ts(table, row);
                match bucket.get(id) {
                    Some(existing) if effective_ts(table, existing) >= ts => {}
                    _ => {
                        bucket.insert(id.to_string(), row.clone());
                    }
                }
            }
        }
        for t in &snap.tombstones {
            let key = (t.table.clone(), t.id.clone());
            let keep = tombstones
                .get(&key)
                .map(|cur| t.deleted_at > *cur)
                .unwrap_or(true);
            if keep {
                tombstones.insert(key, t.deleted_at.clone());
            }
        }
        for (hash, ext) in &snap.assets {
            assets.entry(hash.clone()).or_insert_with(|| ext.clone());
        }
    }

    MergePlan {
        rows,
        tombstones,
        assets,
    }
}

/// 本地各表的有效时间戳：(table -> (id -> ts))
async fn load_local_ts(
    db: &sqlx::SqlitePool,
) -> Result<HashMap<String, HashMap<String, String>>, String> {
    let mut map = HashMap::new();
    for &table in BACKUP_TABLES {
        let pk = pk_column(table);
        let ts = ts_column(table);
        let rows = sqlx::query_as::<_, (String, Option<String>)>(&format!(
            "SELECT {pk}, {ts} FROM {table}"
        ))
        .fetch_all(db)
        .await
        .map_err(|e| format!("读取 {table} 时间戳失败: {e}"))?;
        let inner: HashMap<String, String> = rows
            .into_iter()
            .map(|(id, ts)| (id, ts.unwrap_or_default()))
            .collect();
        map.insert(table.to_string(), inner);
    }
    Ok(map)
}

/// 把合并计划应用到本地数据库（单事务）。返回 (应用行数, 删除行数)。
async fn apply_merge(
    db: &sqlx::SqlitePool,
    plan: &MergePlan,
    local_ts: &HashMap<String, HashMap<String, String>>,
    asset_paths: &HashMap<String, String>,
) -> Result<(usize, usize), String> {
    let mut tx = db.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("PRAGMA defer_foreign_keys = ON")
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    let mut applied = 0usize;
    let mut deleted = 0usize;

    // 1) 应用删除：仅当本地行不比墓碑更新时删除。
    for ((table, id), del_ts) in &plan.tombstones {
        let pk = pk_column(table);
        let local = local_ts.get(table).and_then(|m| m.get(id));
        let should_delete = match local {
            Some(ts) => ts <= del_ts,
            None => false, // 本地没有该行，无需删
        };
        if should_delete {
            sqlx::query(&format!("DELETE FROM {table} WHERE {pk} = ?"))
                .bind(id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("删除 {table} 失败: {e}"))?;
            deleted += 1;
        }
        // 记录墓碑（保留最新 deleted_at）
        sqlx::query(
            "INSERT INTO sync_tombstones (entity_table, entity_id, deleted_at) VALUES (?, ?, ?)
             ON CONFLICT(entity_table, entity_id) DO UPDATE SET
                 deleted_at = MAX(sync_tombstones.deleted_at, excluded.deleted_at)",
        )
        .bind(table)
        .bind(id)
        .bind(del_ts)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    // 2) 按依赖顺序 upsert（父表先于子表）。
    for &table in BACKUP_TABLES {
        let Some(bucket) = plan.rows.get(table) else {
            continue;
        };
        let pk = pk_column(table);
        for (id, row) in bucket {
            let row_ts = effective_ts(table, row);

            // 墓碑更新于该行 → 跳过（删除胜出）
            if let Some(del) = plan.tombstones.get(&(table.to_string(), id.clone())) {
                if *del >= row_ts {
                    continue;
                }
            }
            // 本地更新 → 跳过（本地胜出）
            if let Some(local) = local_ts.get(table).and_then(|m| m.get(id)) {
                if *local >= row_ts {
                    continue;
                }
            }

            upsert_row(&mut tx, table, pk, row, asset_paths).await?;
            applied += 1;
        }
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok((applied, deleted))
}

async fn upsert_row(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    table: &str,
    pk: &str,
    row: &serde_json::Value,
    asset_paths: &HashMap<String, String>,
) -> Result<(), String> {
    let Some(obj) = row.as_object() else {
        return Ok(());
    };
    if obj.is_empty() {
        return Ok(());
    }

    // 解析资产引用为本地路径。
    let mut resolved = obj.clone();
    if is_asset_table(table) {
        if let Some(fp) = resolved.get("file_path").and_then(|v| v.as_str()) {
            if let Some(hash) = fp.strip_prefix("asset://") {
                let local = asset_paths.get(hash).cloned().unwrap_or_default();
                resolved.insert("file_path".into(), serde_json::Value::String(local));
            }
        }
    }

    let entries: Vec<(&String, &serde_json::Value)> = resolved.iter().collect();
    let columns: Vec<String> = entries.iter().map(|(k, _)| (*k).clone()).collect();
    let columns_str = columns.join(", ");
    let placeholders = vec!["?"; entries.len()].join(", ");
    let updates: Vec<String> = columns
        .iter()
        .filter(|c| c.as_str() != pk)
        .map(|c| format!("{c} = excluded.{c}"))
        .collect();

    let sql = if updates.is_empty() {
        format!(
            "INSERT INTO {table} ({columns_str}) VALUES ({placeholders})
             ON CONFLICT({pk}) DO NOTHING"
        )
    } else {
        format!(
            "INSERT INTO {table} ({columns_str}) VALUES ({placeholders})
             ON CONFLICT({pk}) DO UPDATE SET {}",
            updates.join(", ")
        )
    };

    let mut query = sqlx::query(&sql);
    for (_, value) in entries {
        query = match value {
            serde_json::Value::Null => query.bind(Option::<String>::None),
            serde_json::Value::String(v) => query.bind(v.clone()),
            serde_json::Value::Bool(v) => query.bind(if *v { 1_i64 } else { 0_i64 }),
            serde_json::Value::Number(v) => {
                if let Some(i) = v.as_i64() {
                    query.bind(i)
                } else if let Some(f) = v.as_f64() {
                    query.bind(f)
                } else {
                    query.bind(v.to_string())
                }
            }
            other => query.bind(other.to_string()),
        };
    }
    query
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("写入 {table} 失败: {e}"))?;
    Ok(())
}

// ── 资产上行/下行 ────────────────────────────────────────────────

/// 上传本地快照引用的、服务器尚不存在的资产 blob。返回上传数量。
async fn upload_assets(
    config: &WebdavConfig,
    asset_sources: &HashMap<String, String>,
    existing: &HashSet<String>,
) -> Result<usize, String> {
    let mut uploaded = 0;
    for (hash, src) in asset_sources {
        if existing.contains(hash.as_str()) {
            continue;
        }
        let Ok(bytes) = std::fs::read(src) else {
            continue;
        };
        let encrypted = encrypt_blob(&bytes, &config.password, MAGIC_SYNC)?;
        let path = format!("{ASSETS_DIR}/{hash}.rcblob");
        webdav_service::put_file(config, &path, encrypted.as_bytes()).await?;
        uploaded += 1;
    }
    Ok(uploaded)
}

/// 下载合并计划引用的、本地缺失的资产到 app_data_dir/sync_assets。
/// 返回 (资产哈希 -> 本地绝对路径, 下载数量)。
async fn download_assets(
    config: &WebdavConfig,
    app_data_dir: &Path,
    plan: &MergePlan,
) -> Result<(HashMap<String, String>, usize), String> {
    // 收集计划中被引用的哈希
    let mut needed: HashSet<String> = HashSet::new();
    for bucket in plan.rows.values() {
        for row in bucket.values() {
            if let Some(fp) = row.get("file_path").and_then(|v| v.as_str()) {
                if let Some(hash) = fp.strip_prefix("asset://") {
                    needed.insert(hash.to_string());
                }
            }
        }
    }

    let dir = app_data_dir.join("sync_assets");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建资产目录失败: {e}"))?;

    let mut map = HashMap::new();
    let mut downloaded = 0;
    for hash in needed {
        let ext = plan.assets.get(&hash).cloned().unwrap_or_default();
        let local = dir.join(format!("{hash}{ext}"));
        if local.exists() {
            map.insert(hash, local.to_string_lossy().to_string());
            continue;
        }
        let remote = format!("{ASSETS_DIR}/{hash}.rcblob");
        match webdav_service::get_file(config, &remote).await? {
            Some(encrypted) => {
                let plaintext = decrypt_blob(
                    std::str::from_utf8(&encrypted).map_err(|_| "资产数据损坏".to_string())?,
                    &config.password,
                    MAGIC_SYNC,
                )?;
                std::fs::write(&local, plaintext).map_err(|e| format!("写入资产失败: {e}"))?;
                map.insert(hash, local.to_string_lossy().to_string());
                downloaded += 1;
            }
            None => {
                // 资产缺失：保持空路径，行其余元数据仍可用。
            }
        }
    }
    Ok((map, downloaded))
}

// ── 设置缓存刷新 ─────────────────────────────────────────────────

async fn refresh_settings_cache(state: &AppState) -> Result<(), String> {
    let raw = crate::repositories::settings_repository::load_all_settings(&state.db).await?;
    let mut cache = state.settings.write().await;
    cache.clear();
    for (key, value) in default_settings() {
        cache.insert(key, value);
    }
    for (key, value) in raw {
        cache.insert(key, value);
    }
    Ok(())
}

// ── 状态广播 ─────────────────────────────────────────────────────

async fn emit_status(state: &AppState, app: &tauri::AppHandle) {
    let status = state.sync_status.read().await.clone();
    let _ = app.emit("sync://status", status);
}

pub async fn current_status(state: &AppState) -> SyncStatus {
    let mut status = state.sync_status.read().await.clone();
    status.configured = crate::services::secure_store::load()
        .ok()
        .flatten()
        .is_some();
    status
}

// ── 对外主入口 ───────────────────────────────────────────────────

/// 执行一次完整同步。若未配置凭据或已有同步在运行，返回 Ok(None)。
pub async fn run_sync(
    state: &AppState,
    app: &tauri::AppHandle,
) -> Result<Option<SyncSummary>, String> {
    let Some(creds) = crate::services::secure_store::load()? else {
        return Ok(None);
    };
    let config = WebdavConfig {
        url: creds.url,
        username: creds.username,
        password: creds.password,
    };

    // 互斥：已有同步在跑则跳过本次。
    let _guard = match state.sync_lock.try_lock() {
        Ok(g) => g,
        Err(_) => return Ok(None),
    };

    {
        let mut s = state.sync_status.write().await;
        s.configured = true;
        s.running = true;
        s.last_error = None;
    }
    emit_status(state, app).await;

    let result = run_sync_inner(state, app, &config).await;

    {
        let mut s = state.sync_status.write().await;
        s.running = false;
        match &result {
            Ok(summary) => {
                s.last_sync_at = Some(now_iso());
                s.last_error = None;
                s.last_message = Some(format!(
                    "已同步：应用 {} 行、删除 {} 行、设备 {} 台",
                    summary.rows_applied, summary.rows_deleted, summary.pulled_devices
                ));
            }
            Err(e) => {
                s.last_error = Some(e.clone());
            }
        }
    }
    emit_status(state, app).await;

    result.map(Some)
}

async fn run_sync_inner(
    state: &AppState,
    app: &tauri::AppHandle,
    config: &WebdavConfig,
) -> Result<SyncSummary, String> {
    let db = &state.db;
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let device = device_id(db).await?;

    // 确保目录存在。
    webdav_service::ensure_collection(config, SYNC_ROOT).await?;
    webdav_service::ensure_collection(config, DEVICES_DIR).await?;
    webdav_service::ensure_collection(config, ASSETS_DIR).await?;

    // 1) 本地删除检测 → 墓碑。
    detect_local_deletes(db).await?;

    // 2) 构建并上传本设备快照（内容未变则跳过上传）。
    let (snapshot, asset_sources) = build_snapshot(db, &device).await?;
    let snapshot_json = serde_json::to_string(&snapshot).map_err(|e| e.to_string())?;

    // 资产：列出服务器已有 blob，上传缺失。
    let existing_assets: HashSet<String> = webdav_service::list_dir(config, ASSETS_DIR)
        .await?
        .into_iter()
        .filter_map(|f| {
            f.name
                .strip_suffix(".rcblob")
                .map(|s| s.to_string())
                .or(Some(f.name.clone()))
        })
        .collect();
    let assets_uploaded = upload_assets(config, &asset_sources, &existing_assets).await?;

    let encrypted = encrypt_blob(snapshot_json.as_bytes(), &config.password, MAGIC_SYNC)?;
    let push_hash = {
        let mut h = Sha256::new();
        h.update(snapshot_json.as_bytes());
        format!("{:x}", h.finalize())
    };
    let pushed = meta_get(db, "last_push_hash").await?.as_deref() != Some(push_hash.as_str());
    if pushed {
        let path = format!("{DEVICES_DIR}/{device}.rcstate");
        webdav_service::put_file(config, &path, encrypted.as_bytes()).await?;
        meta_set(db, "last_push_hash", &push_hash).await?;
    }

    // 3) 拉取其它设备快照。
    let own_file = format!("{device}.rcstate");
    let mut remote_snapshots = Vec::new();
    for file in webdav_service::list_dir(config, DEVICES_DIR).await? {
        if file.name == own_file || !file.name.ends_with(".rcstate") {
            continue;
        }
        let path = format!("{DEVICES_DIR}/{}", file.name);
        let Some(bytes) = webdav_service::get_file(config, &path).await? else {
            continue;
        };
        let text = std::str::from_utf8(&bytes).map_err(|_| "状态文件损坏".to_string())?;
        let plaintext = decrypt_blob(text, &config.password, MAGIC_SYNC)?;
        match serde_json::from_slice::<DeviceSnapshot>(&plaintext) {
            Ok(snap) => remote_snapshots.push(snap),
            Err(e) => return Err(format!("解析设备快照失败: {e}")),
        }
    }
    let pulled_devices = remote_snapshots.len();

    if remote_snapshots.is_empty() {
        // 没有其它设备：仅刷新基线即可。
        update_baselines(db).await?;
        return Ok(SyncSummary {
            pushed,
            pulled_devices: 0,
            rows_applied: 0,
            rows_deleted: 0,
            assets_uploaded,
            assets_downloaded: 0,
        });
    }

    // 4) 合并。
    let plan = combine_snapshots(&remote_snapshots);
    let (asset_paths, assets_downloaded) = download_assets(config, &app_data_dir, &plan).await?;
    let local_ts = load_local_ts(db).await?;
    let (rows_applied, rows_deleted) = apply_merge(db, &plan, &local_ts, &asset_paths).await?;

    // 5) 收尾：刷新基线与设置缓存。
    update_baselines(db).await?;
    refresh_settings_cache(state).await?;

    Ok(SyncSummary {
        pushed,
        pulled_devices,
        rows_applied,
        rows_deleted,
        assets_uploaded,
        assets_downloaded,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ts_and_pk_helpers() {
        assert_eq!(pk_column("settings"), "key");
        assert_eq!(pk_column("papers"), "id");
        assert_eq!(ts_column("papers"), "updated_at");
        assert_eq!(ts_column("chat_messages"), "created_at");
    }

    fn snap(
        device: &str,
        rows: Vec<(&str, serde_json::Value)>,
        tombs: Vec<Tombstone>,
    ) -> DeviceSnapshot {
        let mut tables: BTreeMap<String, Vec<serde_json::Value>> = BTreeMap::new();
        for (t, r) in rows {
            tables.entry(t.to_string()).or_default().push(r);
        }
        DeviceSnapshot {
            version: 1,
            device_id: device.to_string(),
            generated_at: "2026-01-01 00:00:00".into(),
            tables,
            tombstones: tombs,
            assets: BTreeMap::new(),
        }
    }

    #[test]
    fn combine_takes_newest_row_by_updated_at() {
        let older = serde_json::json!({"id":"p1","title":"old","updated_at":"2026-01-01 00:00:00"});
        let newer = serde_json::json!({"id":"p1","title":"new","updated_at":"2026-02-01 00:00:00"});
        let plan = combine_snapshots(&[
            snap("a", vec![("papers", older)], vec![]),
            snap("b", vec![("papers", newer.clone())], vec![]),
        ]);
        let row = &plan.rows["papers"]["p1"];
        assert_eq!(row.get("title").unwrap(), "new");
    }

    async fn test_pool() -> sqlx::SqlitePool {
        let dir = std::env::temp_dir().join(format!("xiaoyan_sync_test_{}", uuid::Uuid::new_v4()));
        crate::db::init_db(&dir).await.expect("init db")
    }

    /// 端到端验证：两库通过快照合并收敛、编辑取新、删除传播。
    #[tokio::test]
    async fn round_trip_merges_edits_and_propagates_delete() {
        let a = test_pool().await;
        let b = test_pool().await;
        let no_assets = HashMap::new();

        // A 创建 p1
        sqlx::query(
            "INSERT INTO papers (id,title,created_at,updated_at) \
             VALUES ('p1','v1','2026-01-01 00:00:00','2026-01-01 00:00:00')",
        )
        .execute(&a)
        .await
        .unwrap();

        // 建立基线并把 A 的快照合并进 B
        detect_local_deletes(&a).await.unwrap();
        let (snap_a, _) = build_snapshot(&a, "devA").await.unwrap();
        let plan = combine_snapshots(&[snap_a]);
        let lts = load_local_ts(&b).await.unwrap();
        apply_merge(&b, &plan, &lts, &no_assets).await.unwrap();
        detect_local_deletes(&b).await.unwrap();
        update_baselines(&b).await.unwrap();

        let title: String = sqlx::query_scalar("SELECT title FROM papers WHERE id='p1'")
            .fetch_one(&b)
            .await
            .unwrap();
        assert_eq!(title, "v1", "p1 应同步到 B");

        // B 编辑 p1（更晚时间戳）→ 合并回 A 应取新
        sqlx::query("UPDATE papers SET title='v2', updated_at='2026-02-01 00:00:00' WHERE id='p1'")
            .execute(&b)
            .await
            .unwrap();
        let (snap_b, _) = build_snapshot(&b, "devB").await.unwrap();
        let plan = combine_snapshots(&[snap_b]);
        let lts = load_local_ts(&a).await.unwrap();
        apply_merge(&a, &plan, &lts, &no_assets).await.unwrap();
        update_baselines(&a).await.unwrap();

        let title: String = sqlx::query_scalar("SELECT title FROM papers WHERE id='p1'")
            .fetch_one(&a)
            .await
            .unwrap();
        assert_eq!(title, "v2", "A 应取到更新的编辑");

        // A 删除 p1 → 生成墓碑 → 合并进 B 应删除
        sqlx::query("DELETE FROM papers WHERE id='p1'")
            .execute(&a)
            .await
            .unwrap();
        detect_local_deletes(&a).await.unwrap();
        let (snap_a2, _) = build_snapshot(&a, "devA").await.unwrap();
        assert!(!snap_a2.tombstones.is_empty(), "应生成删除墓碑");

        let plan = combine_snapshots(&[snap_a2]);
        let lts = load_local_ts(&b).await.unwrap();
        let (_applied, deleted) = apply_merge(&b, &plan, &lts, &no_assets).await.unwrap();
        assert!(deleted >= 1, "删除应被应用");

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM papers WHERE id='p1'")
            .fetch_one(&b)
            .await
            .unwrap();
        assert_eq!(count, 0, "删除应传播到 B");

        // 幂等：再合并一次不应改变结果（p1 仍不存在）
        let plan = combine_snapshots(&[build_snapshot(&a, "devA").await.unwrap().0]);
        let lts = load_local_ts(&b).await.unwrap();
        apply_merge(&b, &plan, &lts, &no_assets).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM papers WHERE id='p1'")
            .fetch_one(&b)
            .await
            .unwrap();
        assert_eq!(count, 0, "幂等：删除不应被复活");
    }

    /// 触发器应在普通 UPDATE 未显式改动 updated_at 时自动刷新它。
    #[tokio::test]
    async fn update_trigger_bumps_updated_at() {
        let db = test_pool().await;
        sqlx::query(
            "INSERT INTO papers (id,title,created_at,updated_at) \
             VALUES ('p9','t','2020-01-01 00:00:00','2020-01-01 00:00:00')",
        )
        .execute(&db)
        .await
        .unwrap();
        // 模拟忘记更新 updated_at 的写入路径
        sqlx::query("UPDATE papers SET tags='[\"x\"]' WHERE id='p9'")
            .execute(&db)
            .await
            .unwrap();
        let ts: String = sqlx::query_scalar("SELECT updated_at FROM papers WHERE id='p9'")
            .fetch_one(&db)
            .await
            .unwrap();
        assert_ne!(ts, "2020-01-01 00:00:00", "触发器应已刷新 updated_at");
    }

    #[test]
    fn combine_keeps_newest_tombstone() {
        let plan = combine_snapshots(&[
            snap(
                "a",
                vec![],
                vec![Tombstone {
                    table: "papers".into(),
                    id: "p1".into(),
                    deleted_at: "2026-01-01 00:00:00".into(),
                }],
            ),
            snap(
                "b",
                vec![],
                vec![Tombstone {
                    table: "papers".into(),
                    id: "p1".into(),
                    deleted_at: "2026-03-01 00:00:00".into(),
                }],
            ),
        ]);
        assert_eq!(
            plan.tombstones[&("papers".to_string(), "p1".to_string())],
            "2026-03-01 00:00:00"
        );
    }
}

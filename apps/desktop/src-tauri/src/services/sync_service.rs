//! 基于「每设备独立状态文件」的无冲突 WebDAV 同步。
//!
//! 设计要点（详见 docs 与计划）：
//! - 每台设备只写自己的 `devices/{device_id}.rcstate`，因此 WebDAV 上永远不存在
//!   不同设备覆盖对方状态文件的问题；本地判断与写入另由事务保护。
//! - 设备间通过确定性合并收敛：按主键做记录级 Last-Write-Wins（比较 `updated_at`，
//!   纯追加表回退 `created_at`），删除通过墓碑传播。
//! - 资产（PDF 等）按内容哈希存为 `assets/{sha256}.rcblob`（一次写入、去重），
//!   状态文件只保存 `asset://{hash}` 引用，保持精简、避免每次同步重传大文件。
//! - 所有上行/下行文件均用 WebDAV 密码经 AES-256-GCM 加密。

use crate::services::settings_service::{
    decrypt_blob, encrypt_blob, is_local_only_settings_key, BACKUP_TABLES, MAGIC_SYNC,
};
use crate::services::webdav_service::{self, WebdavConfig};
use crate::state::{default_settings, AppState};
use chrono::{DateTime, Duration as ChronoDuration, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::Path;
use tauri::{Emitter, Manager};

#[path = "sync_local_state.rs"]
mod local_state;
use local_state::{apply_merge, capture_local_state, checkpoint_local_deletes};

const SYNC_ROOT: &str = "xiaoyan-sync";
const DEVICES_DIR: &str = "xiaoyan-sync/devices";
const ASSETS_DIR: &str = "xiaoyan-sync/assets";
const SNAPSHOT_VERSION: u32 = 1;
const ASSET_TABLES: &[&str] = &["papers", "paper_figures", "experiment_attachments"];
const AUTO_SYNC_COOLDOWN: ChronoDuration = ChronoDuration::minutes(15);

/// 同步状态，供前端订阅展示。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SyncStatus {
    pub configured: bool,
    pub running: bool,
    pub last_sync_at: Option<String>,
    pub last_error: Option<String>,
    pub last_message: Option<String>,
    #[serde(skip)]
    last_run_started_at: Option<DateTime<Utc>>,
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

/// 统一生成带时区的 UTC 时间，避免和 SQLite 的无时区时间串混用。
fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

/// 将历史的 SQLite 时间（`YYYY-MM-DD HH:MM:SS`）和 RFC 3339 时间归一为 UTC。
///
/// 同步快照已发布过两种格式，不能直接按字符串排序：同一天内空格与 `T`
/// 的字典序会让较早的 RFC 3339 时间错误地胜出。无法解析的历史值保留
/// 字典序回退，保证合并结果仍然确定。
fn parse_sync_timestamp(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .map(|timestamp| timestamp.with_timezone(&Utc))
        .ok()
        .or_else(|| {
            NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S%.f")
                .ok()
                .map(|timestamp| timestamp.and_utc())
        })
}

fn compare_timestamps(left: &str, right: &str) -> Ordering {
    match (parse_sync_timestamp(left), parse_sync_timestamp(right)) {
        (Some(left), Some(right)) => left.cmp(&right),
        _ => left.cmp(right),
    }
}

fn is_newer_timestamp(candidate: &str, current: &str) -> bool {
    compare_timestamps(candidate, current).is_gt()
}

fn automatic_sync_is_due(last_run_started_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    last_run_started_at
        .map(|last_run| now.signed_duration_since(last_run) >= AUTO_SYNC_COOLDOWN)
        .unwrap_or(true)
}

// ── 快照构建 ─────────────────────────────────────────────────────

/// 构建本设备快照；返回 (快照, 资产哈希->本地源文件路径)。
async fn build_snapshot(
    db: &sqlx::SqlitePool,
    device: &str,
) -> Result<(DeviceSnapshot, HashMap<String, String>), String> {
    let (mut tables, tombstones) = capture_local_state(db).await?;
    let mut assets: BTreeMap<String, String> = BTreeMap::new();
    let mut asset_sources: HashMap<String, String> = HashMap::new();

    // The database transaction has ended before touching any asset file.
    for (table, rows) in &mut tables {
        for row in rows {
            let serde_json::Value::Object(obj) = row else {
                continue;
            };

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
        }
    }

    let snapshot = DeviceSnapshot {
        version: SNAPSHOT_VERSION,
        device_id: device.to_string(),
        generated_at: now_rfc3339(),
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
                    Some(existing) if !is_newer_timestamp(&ts, &effective_ts(table, existing)) => {}
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
                .map(|cur| is_newer_timestamp(&t.deleted_at, cur))
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
        .map(|creds| creds.enabled)
        .unwrap_or(false);
    status
}

// ── 对外主入口 ───────────────────────────────────────────────────

/// 执行一次后台自动同步。与上一次同步开始时间不足 15 分钟时跳过。
pub async fn run_sync(
    state: &AppState,
    app: &tauri::AppHandle,
) -> Result<Option<SyncSummary>, String> {
    run_sync_with_mode(state, app, true).await
}

/// 手动同步或重新启用同步时调用，不受后台频率限制。
pub async fn run_manual_sync(
    state: &AppState,
    app: &tauri::AppHandle,
) -> Result<Option<SyncSummary>, String> {
    run_sync_with_mode(state, app, false).await
}

/// 执行一次完整同步。若未启用凭据或已有同步在运行，返回 Ok(None)。
async fn run_sync_with_mode(
    state: &AppState,
    app: &tauri::AppHandle,
    is_automatic: bool,
) -> Result<Option<SyncSummary>, String> {
    let Some(creds) = crate::services::secure_store::load()? else {
        return Ok(None);
    };
    if !creds.enabled {
        return Ok(None);
    }
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
        let now = Utc::now();
        if is_automatic && !automatic_sync_is_due(s.last_run_started_at, now) {
            return Ok(None);
        }
        s.last_run_started_at = Some(now);
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
                s.last_sync_at = Some(now_rfc3339());
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

    // 1–2) 同一事务捕获删除、基线和行，再构建资产引用并上传快照。
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
        // 没有其它设备：也要记录网络等待期间发生的本地删除。
        checkpoint_local_deletes(db).await?;
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
    let (rows_applied, rows_deleted) = apply_merge(db, &plan, &asset_paths).await?;

    // 5) 基线已随合并提交；这里只刷新设置缓存。
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

    #[test]
    fn timestamps_compare_by_time_across_legacy_and_rfc3339_formats() {
        let legacy_later = "2026-01-01 09:00:00";
        let rfc_earlier = "2026-01-01T01:00:00Z";
        assert_eq!(
            compare_timestamps(legacy_later, rfc_earlier),
            Ordering::Greater
        );
        assert!(is_newer_timestamp(legacy_later, rfc_earlier));
        assert!(parse_sync_timestamp(&now_rfc3339()).is_some());
    }

    #[test]
    fn automatic_sync_uses_a_fifteen_minute_cooldown() {
        let started_at = DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert!(!automatic_sync_is_due(
            Some(started_at),
            started_at + ChronoDuration::minutes(14),
        ));
        assert!(automatic_sync_is_due(
            Some(started_at),
            started_at + ChronoDuration::minutes(15),
        ));
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

    #[test]
    fn combine_uses_real_time_when_snapshot_formats_differ() {
        let rfc_earlier = serde_json::json!({
            "id":"p1",
            "title":"rfc earlier",
            "updated_at":"2026-01-01T01:00:00Z"
        });
        let legacy_later = serde_json::json!({
            "id":"p1",
            "title":"legacy later",
            "updated_at":"2026-01-01 09:00:00"
        });
        let plan = combine_snapshots(&[
            snap("a", vec![("papers", rfc_earlier)], vec![]),
            snap("b", vec![("papers", legacy_later)], vec![]),
        ]);
        assert_eq!(plan.rows["papers"]["p1"]["title"], "legacy later");
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
        let (snap_a, _) = build_snapshot(&a, "devA").await.unwrap();
        let plan = combine_snapshots(&[snap_a]);
        apply_merge(&b, &plan, &no_assets).await.unwrap();

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
        apply_merge(&a, &plan, &no_assets).await.unwrap();

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
        let (snap_a2, _) = build_snapshot(&a, "devA").await.unwrap();
        assert!(!snap_a2.tombstones.is_empty(), "应生成删除墓碑");

        let plan = combine_snapshots(&[snap_a2]);
        let (_applied, deleted) = apply_merge(&b, &plan, &no_assets).await.unwrap();
        assert!(deleted >= 1, "删除应被应用");

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM papers WHERE id='p1'")
            .fetch_one(&b)
            .await
            .unwrap();
        assert_eq!(count, 0, "删除应传播到 B");

        // 幂等：再合并一次不应改变结果（p1 仍不存在）
        let plan = combine_snapshots(&[build_snapshot(&a, "devA").await.unwrap().0]);
        apply_merge(&b, &plan, &no_assets).await.unwrap();
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
                    deleted_at: "2026-01-01 09:00:00".into(),
                }],
            ),
            snap(
                "b",
                vec![],
                vec![Tombstone {
                    table: "papers".into(),
                    id: "p1".into(),
                    deleted_at: "2026-01-01T01:00:00Z".into(),
                }],
            ),
        ]);
        assert_eq!(
            plan.tombstones[&("papers".to_string(), "p1".to_string())],
            "2026-01-01 09:00:00"
        );
    }
}

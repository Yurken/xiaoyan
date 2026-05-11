use crate::state::AppState;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use serde_json::json;
use std::collections::HashMap;
use tauri::State;

const SALT_KEY: &str = "app_lock_password_salt";
const HASH_KEY: &str = "app_lock_password_hash";
const ENABLED_KEY: &str = "app_lock_enabled";
const TIMEOUT_KEY: &str = "app_lock_timeout_minutes";
const PBKDF2_ROUNDS: u32 = 310_000;
const SALT_LEN: usize = 16;
const HASH_LEN: usize = 32;

fn password_parts(settings: &HashMap<String, String>) -> Option<(&str, &str)> {
    let salt = settings.get(SALT_KEY)?.trim();
    let hash = settings.get(HASH_KEY)?.trim();
    if salt.is_empty() || hash.is_empty() { return None; }
    Some((salt, hash))
}

fn derive_hash(password: &str, salt: &[u8]) -> [u8; HASH_LEN] {
    let mut hash = [0u8; HASH_LEN];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password.as_bytes(), salt, PBKDF2_ROUNDS, &mut hash);
    hash
}

async fn save(state: &State<'_, AppState>, updates: HashMap<String, String>) -> Result<(), String> {
    for (key, value) in &updates {
        sqlx::query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?")
            .bind(key).bind(value).bind(value)
            .execute(&state.db).await.map_err(|e| e.to_string())?;
    }
    let mut cache = state.settings.write().await;
    for (key, value) in updates { cache.insert(key, value); }
    Ok(())
}

#[tauri::command]
pub async fn app_lock_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let settings = state.settings.read().await;
    let parts = password_parts(&settings);
    let enabled = settings.get(ENABLED_KEY).map(|v| v.as_str()) == Some("true") && parts.is_some();
    let timeout = settings.get(TIMEOUT_KEY).and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
    Ok(json!({ "enabled": enabled, "timeoutMinutes": timeout }))
}

#[tauri::command]
pub async fn app_lock_set_password(
    state: State<'_, AppState>,
    password: String,
) -> Result<serde_json::Value, String> {
    let password = password.trim().to_string();
    if password.is_empty() { return Err("密码不能为空。".into()); }

    let mut salt_bytes = [0u8; SALT_LEN];
    rand::rngs::OsRng.fill_bytes(&mut salt_bytes);
    let hash = derive_hash(&password, &salt_bytes);

    let mut updates = HashMap::new();
    updates.insert(SALT_KEY.into(), B64.encode(&salt_bytes));
    updates.insert(HASH_KEY.into(), B64.encode(&hash));
    updates.insert(ENABLED_KEY.into(), "true".into());
    save(&state, updates).await?;

    Ok(json!({ "enabled": true }))
}

#[tauri::command]
pub async fn app_lock_verify_password(
    state: State<'_, AppState>,
    password: String,
) -> Result<bool, String> {
    let settings = state.settings.read().await;
    let Some((salt_b64, hash_b64)) = password_parts(&settings) else { return Ok(true); };
    let salt = B64.decode(salt_b64).map_err(|_| "密码状态异常。".to_string())?;
    let expected = B64.decode(hash_b64).map_err(|_| "密码状态异常。".to_string())?;
    let actual = derive_hash(&password.trim(), &salt);

    let mut diff = 0u8;
    for i in 0..HASH_LEN { diff |= expected.get(i).unwrap_or(&0) ^ actual[i]; }
    if diff != 0 { return Err("密码错误。".into()); }
    Ok(true)
}

#[tauri::command]
pub async fn app_lock_clear_password(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let mut updates = HashMap::new();
    updates.insert(SALT_KEY.into(), "".into());
    updates.insert(HASH_KEY.into(), "".into());
    updates.insert(ENABLED_KEY.into(), "false".into());
    save(&state, updates).await?;
    Ok(json!({ "enabled": false }))
}

#[tauri::command]
pub async fn app_lock_set_timeout(
    state: State<'_, AppState>,
    minutes: String,
) -> Result<(), String> {
    let mut updates = HashMap::new();
    updates.insert(TIMEOUT_KEY.into(), minutes);
    save(&state, updates).await?;
    Ok(())
}

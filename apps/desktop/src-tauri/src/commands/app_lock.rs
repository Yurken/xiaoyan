use crate::repositories::settings_repository::upsert_settings;
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
const HINT_KEY: &str = "app_lock_password_hint";
const EMAIL_KEY: &str = "app_lock_email";
const SECURITY_QUESTION_KEY: &str = "app_lock_security_question";
const SECURITY_SALT_KEY: &str = "app_lock_security_answer_salt";
const SECURITY_HASH_KEY: &str = "app_lock_security_answer_hash";
const PBKDF2_ROUNDS: u32 = 310_000;
const SALT_LEN: usize = 16;
const HASH_LEN: usize = 32;

fn password_parts(settings: &HashMap<String, String>) -> Option<(&str, &str)> {
    let salt = settings.get(SALT_KEY)?.trim();
    let hash = settings.get(HASH_KEY)?.trim();
    if salt.is_empty() || hash.is_empty() {
        return None;
    }
    Some((salt, hash))
}

fn security_parts(settings: &HashMap<String, String>) -> Option<(&str, &str)> {
    let salt = settings.get(SECURITY_SALT_KEY)?.trim();
    let hash = settings.get(SECURITY_HASH_KEY)?.trim();
    if salt.is_empty() || hash.is_empty() {
        return None;
    }
    Some((salt, hash))
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn derive_hash(password: &str, salt: &[u8]) -> [u8; HASH_LEN] {
    let mut hash = [0u8; HASH_LEN];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password.as_bytes(), salt, PBKDF2_ROUNDS, &mut hash);
    hash
}

async fn save(state: &State<'_, AppState>, updates: HashMap<String, String>) -> Result<(), String> {
    upsert_settings(&state.db, &updates).await?;
    let mut cache = state.settings.write().await;
    for (key, value) in updates {
        cache.insert(key, value);
    }
    Ok(())
}

#[tauri::command]
pub async fn app_lock_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let settings = state.settings.read().await;
    let parts = password_parts(&settings);
    let enabled = settings.get(ENABLED_KEY).map(|v| v.as_str()) == Some("true") && parts.is_some();
    let timeout = settings
        .get(TIMEOUT_KEY)
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(0);
    let has_security = settings
        .get(SECURITY_HASH_KEY)
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);
    let has_hint = settings
        .get(HINT_KEY)
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);
    let has_email = settings
        .get(EMAIL_KEY)
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);
    Ok(
        json!({ "enabled": enabled, "timeoutMinutes": timeout, "hasSecurity": has_security, "hasHint": has_hint, "hasEmail": has_email }),
    )
}

#[tauri::command]
pub async fn app_lock_set_password(
    state: State<'_, AppState>,
    password: String,
    hint: Option<String>,
    email: String,
) -> Result<serde_json::Value, String> {
    let password = password.trim().to_string();
    let email = normalize_email(&email);
    if password.is_empty() {
        return Err("密码不能为空。".into());
    }
    if password.len() < 6 {
        return Err("密码长度不能少于6位。".into());
    }
    if email.is_empty() {
        return Err("邮箱不能为空。".into());
    }

    let mut salt_bytes = [0u8; SALT_LEN];
    rand::rngs::OsRng.fill_bytes(&mut salt_bytes);
    let hash = derive_hash(&password, &salt_bytes);

    let mut updates = HashMap::new();
    updates.insert(SALT_KEY.into(), B64.encode(&salt_bytes));
    updates.insert(HASH_KEY.into(), B64.encode(&hash));
    updates.insert(ENABLED_KEY.into(), "true".into());
    updates.insert(EMAIL_KEY.into(), email);
    if let Some(h) = hint {
        updates.insert(HINT_KEY.into(), h.trim().to_string());
    }
    save(&state, updates).await?;

    Ok(json!({ "enabled": true }))
}

#[tauri::command]
pub async fn app_lock_verify_password(
    state: State<'_, AppState>,
    password: String,
) -> Result<bool, String> {
    let settings = state.settings.read().await;
    let Some((salt_b64, hash_b64)) = password_parts(&settings) else {
        return Ok(true);
    };
    let salt = B64
        .decode(salt_b64)
        .map_err(|_| "密码状态异常。".to_string())?;
    let expected = B64
        .decode(hash_b64)
        .map_err(|_| "密码状态异常。".to_string())?;
    let actual = derive_hash(&password.trim(), &salt);

    let mut diff = 0u8;
    for i in 0..HASH_LEN {
        diff |= expected.get(i).unwrap_or(&0) ^ actual[i];
    }
    if diff != 0 {
        return Err("密码错误。".into());
    }
    Ok(true)
}

#[tauri::command]
pub async fn app_lock_clear_password(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let mut updates = HashMap::new();
    updates.insert(SALT_KEY.into(), "".into());
    updates.insert(HASH_KEY.into(), "".into());
    updates.insert(ENABLED_KEY.into(), "false".into());
    updates.insert(HINT_KEY.into(), "".into());
    updates.insert(EMAIL_KEY.into(), "".into());
    updates.insert(SECURITY_QUESTION_KEY.into(), "".into());
    updates.insert(SECURITY_SALT_KEY.into(), "".into());
    updates.insert(SECURITY_HASH_KEY.into(), "".into());
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

#[tauri::command]
pub async fn app_lock_get_hint(state: State<'_, AppState>) -> Result<String, String> {
    let settings = state.settings.read().await;
    Ok(settings.get(HINT_KEY).cloned().unwrap_or_default())
}

#[tauri::command]
pub async fn app_lock_get_recovery_info(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let settings = state.settings.read().await;
    let hint = settings.get(HINT_KEY).cloned().unwrap_or_default();
    let question = settings
        .get(SECURITY_QUESTION_KEY)
        .cloned()
        .unwrap_or_default();
    let has_email = settings
        .get(EMAIL_KEY)
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);
    let has_security = security_parts(&settings).is_some();
    Ok(
        json!({ "hint": hint, "question": question, "hasEmail": has_email, "hasSecurity": has_security }),
    )
}

#[tauri::command]
pub async fn app_lock_set_security(
    state: State<'_, AppState>,
    question: String,
    answer: String,
) -> Result<(), String> {
    let question = question.trim().to_string();
    let answer = answer.trim().to_string();
    if question.is_empty() || answer.is_empty() {
        return Err("密保问题和答案不能为空。".into());
    }

    let mut salt_bytes = [0u8; SALT_LEN];
    rand::rngs::OsRng.fill_bytes(&mut salt_bytes);
    let hash = derive_hash(&answer, &salt_bytes);

    let mut updates = HashMap::new();
    updates.insert(SECURITY_QUESTION_KEY.into(), question);
    updates.insert(SECURITY_SALT_KEY.into(), B64.encode(&salt_bytes));
    updates.insert(SECURITY_HASH_KEY.into(), B64.encode(&hash));
    save(&state, updates).await?;
    Ok(())
}

#[tauri::command]
pub async fn app_lock_verify_recovery(
    state: State<'_, AppState>,
    email: String,
    answer: String,
) -> Result<bool, String> {
    let email = normalize_email(&email);
    let answer = answer.trim().to_string();
    let settings = state.settings.read().await;

    let stored_email = settings
        .get(EMAIL_KEY)
        .map(|value| normalize_email(value))
        .unwrap_or_default();
    if stored_email != email {
        return Err("邮箱不匹配。".into());
    }

    let Some((salt_b64, hash_b64)) = security_parts(&settings) else {
        return Err("未设置密保，无法找回密码。".into());
    };
    let salt = B64
        .decode(salt_b64)
        .map_err(|_| "密保状态异常。".to_string())?;
    let expected = B64
        .decode(hash_b64)
        .map_err(|_| "密保状态异常。".to_string())?;
    let actual = derive_hash(&answer, &salt);
    let mut diff = 0u8;
    for i in 0..HASH_LEN {
        diff |= expected.get(i).unwrap_or(&0) ^ actual[i];
    }
    if diff != 0 {
        return Err("密保答案错误。".into());
    }

    Ok(true)
}

#[tauri::command]
pub async fn app_lock_reset_password(
    state: State<'_, AppState>,
    email: String,
    answer: String,
    new_password: String,
) -> Result<serde_json::Value, String> {
    let new_password = new_password.trim().to_string();
    let email = normalize_email(&email);
    let answer = answer.trim().to_string();
    if new_password.is_empty() {
        return Err("新密码不能为空。".into());
    }
    if new_password.len() < 6 {
        return Err("新密码长度不能少于6位。".into());
    }

    let settings = state.settings.read().await;

    // Verify email
    let stored_email = settings
        .get(EMAIL_KEY)
        .map(|value| normalize_email(value))
        .unwrap_or_default();
    if stored_email != email {
        return Err("邮箱不匹配。".into());
    }

    let Some((salt_b64, hash_b64)) = security_parts(&settings) else {
        return Err("未设置密保，无法找回密码。".into());
    };
    let salt = B64
        .decode(salt_b64)
        .map_err(|_| "密保状态异常。".to_string())?;
    let expected = B64
        .decode(hash_b64)
        .map_err(|_| "密保状态异常。".to_string())?;
    let actual = derive_hash(&answer, &salt);
    let mut diff = 0u8;
    for i in 0..HASH_LEN {
        diff |= expected.get(i).unwrap_or(&0) ^ actual[i];
    }
    if diff != 0 {
        return Err("密保答案错误。".into());
    }

    drop(settings);

    let mut salt_bytes = [0u8; SALT_LEN];
    rand::rngs::OsRng.fill_bytes(&mut salt_bytes);
    let hash = derive_hash(&new_password, &salt_bytes);

    let mut updates = HashMap::new();
    updates.insert(SALT_KEY.into(), B64.encode(&salt_bytes));
    updates.insert(HASH_KEY.into(), B64.encode(&hash));
    updates.insert(ENABLED_KEY.into(), "true".into());
    save(&state, updates).await?;

    Ok(json!({ "enabled": true }))
}

use crate::repositories::settings_repository::upsert_settings;
use crate::state::AppState;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use std::collections::HashMap;

const PASSWORD_SALT_KEY: &str = "xiaoyan_memory_detail_password_salt";
const PASSWORD_HASH_KEY: &str = "xiaoyan_memory_detail_password_hash";
const PBKDF2_ROUNDS: u32 = 310_000;
const SALT_LEN: usize = 16;
const HASH_LEN: usize = 32;
const ERR_EMPTY_PASSWORD: &str = "密码不能为空。";
const ERR_PASSWORD_REQUIRED: &str = "请输入密码后查看记忆详情。";
const ERR_CORRUPTED_PASSWORD: &str = "记忆详情密码状态异常，请重新设置密码。";

#[derive(Debug, Clone, serde::Serialize)]
pub struct MemoryPrivacyStatus {
    pub enabled: bool,
}

fn password_parts(settings: &HashMap<String, String>) -> Option<(&str, &str)> {
    let salt = settings.get(PASSWORD_SALT_KEY)?.trim();
    let hash = settings.get(PASSWORD_HASH_KEY)?.trim();
    if salt.is_empty() || hash.is_empty() {
        return None;
    }
    Some((salt, hash))
}

fn derive_password_hash(password: &str, salt: &[u8]) -> [u8; HASH_LEN] {
    let mut hash = [0u8; HASH_LEN];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password.as_bytes(), salt, PBKDF2_ROUNDS, &mut hash);
    hash
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut diff = 0u8;
    for (left_byte, right_byte) in left.iter().zip(right.iter()) {
        diff |= left_byte ^ right_byte;
    }
    diff == 0
}

async fn save_privacy_settings(
    state: &AppState,
    updates: HashMap<String, String>,
) -> Result<(), String> {
    upsert_settings(&state.db, &updates).await?;

    let mut cache = state.settings.write().await;
    for (key, value) in updates {
        cache.insert(key, value);
    }
    Ok(())
}

pub async fn status(state: &AppState) -> MemoryPrivacyStatus {
    let settings = state.settings.read().await;
    MemoryPrivacyStatus {
        enabled: password_parts(&settings).is_some(),
    }
}

pub async fn set_password(state: &AppState, password: &str) -> Result<MemoryPrivacyStatus, String> {
    let normalized = password.trim();
    if normalized.is_empty() {
        return Err(ERR_EMPTY_PASSWORD.to_string());
    }

    let mut salt = [0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    let hash = derive_password_hash(normalized, &salt);

    let mut updates = HashMap::new();
    updates.insert(PASSWORD_SALT_KEY.to_string(), B64.encode(salt));
    updates.insert(PASSWORD_HASH_KEY.to_string(), B64.encode(hash));
    save_privacy_settings(state, updates).await?;

    Ok(MemoryPrivacyStatus { enabled: true })
}

pub async fn clear_password(state: &AppState) -> Result<MemoryPrivacyStatus, String> {
    let mut updates = HashMap::new();
    updates.insert(PASSWORD_SALT_KEY.to_string(), String::new());
    updates.insert(PASSWORD_HASH_KEY.to_string(), String::new());
    save_privacy_settings(state, updates).await?;

    Ok(MemoryPrivacyStatus { enabled: false })
}

pub async fn verify_password(state: &AppState, password: &str) -> Result<bool, String> {
    let normalized = password.trim();
    if normalized.is_empty() {
        return Ok(false);
    }

    let settings = state.settings.read().await;
    let Some((salt_b64, expected_b64)) = password_parts(&settings) else {
        return Ok(true);
    };
    let salt = B64
        .decode(salt_b64)
        .map_err(|_| ERR_CORRUPTED_PASSWORD.to_string())?;
    let expected = B64
        .decode(expected_b64)
        .map_err(|_| ERR_CORRUPTED_PASSWORD.to_string())?;
    if salt.len() != SALT_LEN || expected.len() != HASH_LEN {
        return Err(ERR_CORRUPTED_PASSWORD.to_string());
    }

    let actual = derive_password_hash(normalized, &salt);
    Ok(constant_time_eq(&actual, &expected))
}

pub async fn ensure_detail_access(state: &AppState, password: Option<&str>) -> Result<(), String> {
    if !status(state).await.enabled {
        return Ok(());
    }
    let Some(password) = password else {
        return Err(ERR_PASSWORD_REQUIRED.to_string());
    };
    if verify_password(state, password).await? {
        Ok(())
    } else {
        Err("密码不正确。".to_string())
    }
}

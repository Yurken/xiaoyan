use crate::llm::{LlmClient, LlmMessage};
use crate::repositories::settings_repository::{load_all_settings, upsert_settings};
use crate::state::{default_settings, AppState, SENSITIVE_KEYS};
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use std::collections::{BTreeMap, HashMap};

const MAGIC: &[u8; 6] = b"RCCFG1";
const PBKDF2_ROUNDS: u32 = 200_000;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;
pub const MASK: &str = "***";

fn derive_key(password: &[u8], salt: &[u8]) -> [u8; KEY_LEN] {
    let mut key = [0u8; KEY_LEN];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password, salt, PBKDF2_ROUNDS, &mut key);
    key
}

fn encrypt_blob(plaintext: &[u8], password: &str) -> Result<String, String> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let key = derive_key(password.as_bytes(), &salt);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext)
        .map_err(|e| format!("加密失败: {e}"))?;

    let mut blob = Vec::with_capacity(MAGIC.len() + SALT_LEN + NONCE_LEN + ciphertext.len());
    blob.extend_from_slice(MAGIC);
    blob.extend_from_slice(&salt);
    blob.extend_from_slice(&nonce_bytes);
    blob.extend_from_slice(&ciphertext);
    Ok(B64.encode(&blob))
}

fn decrypt_blob(b64_data: &str, password: &str) -> Result<Vec<u8>, String> {
    let blob = B64
        .decode(b64_data)
        .map_err(|_| "文件格式无效。".to_string())?;
    let min_len = MAGIC.len() + SALT_LEN + NONCE_LEN + 16;
    if blob.len() < min_len {
        return Err("文件格式无效或已损坏。".to_string());
    }
    if &blob[..MAGIC.len()] != MAGIC {
        return Err("不是有效的配置文件。".to_string());
    }

    let offset = MAGIC.len();
    let salt = &blob[offset..offset + SALT_LEN];
    let nonce_bytes = &blob[offset + SALT_LEN..offset + SALT_LEN + NONCE_LEN];
    let ciphertext = &blob[offset + SALT_LEN + NONCE_LEN..];
    let key = derive_key(password.as_bytes(), salt);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));

    cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
        .map_err(|_| "密码错误或文件已损坏。".to_string())
}

fn is_exposed_key(defaults: &HashMap<String, String>, key: &str) -> bool {
    defaults.contains_key(key)
}

fn mask_value(key: &str, value: &str) -> String {
    if SENSITIVE_KEYS.contains(&key) && !value.is_empty() {
        MASK.to_string()
    } else {
        value.to_string()
    }
}

pub async fn get_exposed_settings(state: &AppState) -> Result<HashMap<String, String>, String> {
    let cache = state.settings.read().await;
    let defaults = default_settings();
    let mut result = HashMap::new();

    for (key, default) in &defaults {
        let value = cache
            .get(key)
            .map(|item| item.as_str())
            .unwrap_or(default.as_str());
        result.insert(key.clone(), mask_value(key, value));
    }

    Ok(result)
}

pub async fn update_settings(
    state: &AppState,
    data: &serde_json::Value,
) -> Result<Vec<String>, String> {
    let defaults = default_settings();
    let map = data.as_object().ok_or("请求参数格式不正确。")?;
    let mut to_save: HashMap<String, String> = HashMap::new();

    for (key, raw) in map {
        if !is_exposed_key(&defaults, key) {
            continue;
        }
        let value = raw.as_str().unwrap_or("").trim().to_string();
        if SENSITIVE_KEYS.contains(&key.as_str()) && value == MASK {
            continue;
        }
        to_save.insert(key.clone(), value);
    }

    upsert_settings(&state.db, &to_save).await?;

    let mut cache = state.settings.write().await;
    for (key, value) in &to_save {
        cache.insert(key.clone(), value.clone());
    }

    Ok(to_save.keys().cloned().collect())
}

pub async fn export_settings(state: &AppState, password: &str) -> Result<String, String> {
    if password.is_empty() {
        return Err("密码不能为空。".to_string());
    }

    let defaults = default_settings();
    let raw_settings = load_all_settings(&state.db).await?;
    let mut map = BTreeMap::new();

    for key in defaults.keys() {
        if let Some(value) = raw_settings.get(key) {
            map.insert(key.clone(), value.clone());
        }
    }

    let json = serde_json::to_string(&map).map_err(|e| e.to_string())?;
    encrypt_blob(json.as_bytes(), password)
}

pub async fn import_settings(
    state: &AppState,
    data: &str,
    password: &str,
) -> Result<Vec<String>, String> {
    if password.is_empty() {
        return Err("密码不能为空。".to_string());
    }

    let defaults = default_settings();
    let plaintext = decrypt_blob(data.trim(), password)?;
    let json_str = std::str::from_utf8(&plaintext).map_err(|_| "解密数据格式错误。".to_string())?;
    let map: BTreeMap<String, String> =
        serde_json::from_str(json_str).map_err(|_| "配置文件内容格式错误。".to_string())?;

    let mut to_save = HashMap::new();
    for (key, value) in map {
        if is_exposed_key(&defaults, &key) {
            to_save.insert(key, value);
        }
    }

    if to_save.is_empty() {
        return Err("文件中未找到有效配置项。".to_string());
    }

    upsert_settings(&state.db, &to_save).await?;

    let mut cache = state.settings.write().await;
    for (key, value) in &to_save {
        cache.insert(key.clone(), value.clone());
    }

    Ok(to_save.keys().cloned().collect())
}

pub async fn test_settings(state: &AppState, data: &serde_json::Value) -> Result<String, String> {
    let saved = state.settings.read().await.clone();
    let mut merged = saved;
    if let Some(map) = data.as_object() {
        for (key, value) in map {
            let next_value = value.as_str().unwrap_or("").trim().to_string();
            if !next_value.is_empty() && next_value != MASK {
                merged.insert(key.clone(), next_value);
            }
        }
    }

    let client = LlmClient::from_settings(&merged).map_err(|e| e.to_string())?;
    let messages = vec![LlmMessage::user("Reply with the single word: ok")];
    let reply = client
        .chat(&messages, None, 0.0)
        .await
        .map_err(|e| e.to_string())?;
    Ok(reply.trim().to_string())
}

pub async fn list_ollama_models(base_url: Option<String>) -> Result<Vec<String>, String> {
    let url = base_url
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "http://localhost:11434".to_string());
    let api_url = format!(
        "{}/api/tags",
        url.trim_end_matches('/').trim_end_matches("/v1")
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(&api_url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;
    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    Ok(json["models"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|model| model["name"].as_str().map(|name| name.to_string()))
        .collect())
}

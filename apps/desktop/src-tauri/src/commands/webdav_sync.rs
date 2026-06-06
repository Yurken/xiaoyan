use crate::services::settings_service::export_all_data;
use crate::services::webdav_service::{self, WebdavConfig, WebdavFile};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn webdav_test_connection(
    url: String,
    username: String,
    password: String,
) -> Result<(), String> {
    let config = WebdavConfig { url, username, password };
    webdav_service::test_connection(&config).await
}

#[tauri::command]
pub async fn webdav_list_backups(
    url: String,
    username: String,
    password: String,
) -> Result<Vec<WebdavFile>, String> {
    let config = WebdavConfig { url, username, password };
    webdav_service::list_backups(&config).await
}

#[tauri::command]
pub async fn webdav_upload_backup(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    // Export encrypted data backup (uses password for encryption)
    let backup_data = export_all_data(state.inner(), &app, &password).await?;

    let filename = format!(
        "xiaoyan-backup-{}.rcbak",
        chrono::Utc::now().format("%Y-%m-%dT%H%M%S")
    );

    // Upload to WebDAV (uses password for auth)
    let config = WebdavConfig { url, username, password };
    webdav_service::upload_backup(&config, &filename, backup_data.as_bytes()).await?;

    Ok(filename)
}

#[tauri::command]
pub async fn webdav_download_backup(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    url: String,
    username: String,
    password: String,
    filename: String,
) -> Result<(), String> {
    let config = WebdavConfig {
        url: url.clone(),
        username: username.clone(),
        password: password.clone(),
    };
    let data = webdav_service::download_backup(&config, &filename).await?;
    let data_str = String::from_utf8(data).map_err(|e| format!("备份文件格式错误: {}", e))?;

    crate::services::settings_service::import_all_data(state.inner(), &app, &data_str, &password).await
}

#[tauri::command]
pub async fn webdav_delete_backup(
    url: String,
    username: String,
    password: String,
    filename: String,
) -> Result<(), String> {
    let config = WebdavConfig { url, username, password };
    webdav_service::delete_backup(&config, &filename).await
}

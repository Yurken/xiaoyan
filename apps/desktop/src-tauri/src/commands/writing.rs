mod compile_workspace;
mod compiler;

pub use compiler::*;

use std::{
    fs,
    path::{Path, PathBuf},
};

use chrono::Utc;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;

use crate::commands::writing_support::{latex_install_guide_url, mactex_installer_url};

#[tauri::command]
pub async fn writing_import_image(
    app: tauri::AppHandle,
    draft_id: String,
    file_path: tauri_plugin_fs::FilePath,
) -> Result<WritingImageAsset, String> {
    tauri::async_runtime::spawn_blocking(move || import_image_asset(&app, &draft_id, file_path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn writing_open_mactex_installer(app: tauri::AppHandle) -> Result<(), String> {
    let Some(url) = mactex_installer_url() else {
        return Err("当前平台不提供内置 MacTeX 安装器，请改用安装说明。".to_string());
    };

    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn writing_open_mactex_download_page(app: tauri::AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(latex_install_guide_url(), None::<&str>)
        .map_err(|e| e.to_string())
}

fn import_image_asset(
    app: &tauri::AppHandle,
    draft_id: &str,
    file_path: tauri_plugin_fs::FilePath,
) -> Result<WritingImageAsset, String> {
    let source = file_path
        .into_path()
        .map_err(|e| e.to_string())?
        .canonicalize()
        .map_err(|e| format!("图片文件不可访问：{e}"))?;
    if !source.is_file() {
        return Err("请选择一个图片文件。".to_string());
    }

    let ext = source
        .extension()
        .and_then(|value| value.to_str())
        .and_then(normalize_image_extension)
        .ok_or_else(|| "仅支持 PNG、JPG/JPEG 或 PDF 图片。".to_string())?;
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let id = Uuid::new_v4().to_string();
    let short_id = id.chars().take(8).collect::<String>();
    let file_name = format!("{}-{short_id}.{ext}", sanitize_file_stem(stem));
    let project_path = format!("figures/{file_name}");
    let draft_dir = sanitize_project_name(draft_id);
    let destination_dir = managed_writing_assets_root(app)?
        .join(draft_dir)
        .join("figures");
    fs::create_dir_all(&destination_dir).map_err(|e| format!("无法创建图片目录：{e}"))?;
    let destination = destination_dir.join(&file_name);

    fs::copy(&source, &destination).map_err(|e| format!("复制图片失败：{e}"))?;

    Ok(WritingImageAsset {
        id,
        file_name,
        project_path,
        stored_path: destination.to_string_lossy().to_string(),
        created_at: Utc::now().to_rfc3339(),
    })
}

pub(super) fn managed_writing_assets_root<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let root = data_dir.join("writing_assets");
    fs::create_dir_all(&root).map_err(|e| format!("无法创建写作图片目录：{e}"))?;
    Ok(root)
}

pub(super) fn sanitize_project_name(value: &str) -> String {
    let mut output = String::new();
    let mut previous_dash = false;
    for ch in value.trim().chars() {
        let valid = ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-';
        if valid {
            output.push(ch);
            previous_dash = false;
        } else if !previous_dash {
            output.push('-');
            previous_dash = true;
        }
    }
    let sanitized = output.trim_matches(['-', '.']).to_string();
    if sanitized.is_empty() {
        "xiaoyan-paper".to_string()
    } else {
        sanitized
    }
}

pub(super) fn sanitize_file_stem(value: &str) -> String {
    let sanitized = sanitize_project_name(value);
    if sanitized.is_empty() {
        "image".to_string()
    } else {
        sanitized
    }
}

pub(super) fn normalize_image_extension(value: &str) -> Option<&'static str> {
    match value.to_ascii_lowercase().as_str() {
        "png" => Some("png"),
        "jpg" | "jpeg" => Some("jpg"),
        "pdf" => Some("pdf"),
        _ => None,
    }
}

pub(super) fn safe_project_image_path(project_path: &str) -> Result<PathBuf, String> {
    let file_name = project_path
        .strip_prefix("figures/")
        .ok_or_else(|| "图片路径必须位于 figures 目录。".to_string())?;
    if file_name.is_empty()
        || file_name.contains('/')
        || file_name.contains('\\')
        || file_name.contains("..")
    {
        return Err("图片文件名不合法。".to_string());
    }

    let ext = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .and_then(normalize_image_extension)
        .ok_or_else(|| "图片格式不受支持。".to_string())?;
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .map(sanitize_file_stem)
        .ok_or_else(|| "图片文件名不合法。".to_string())?;

    Ok(PathBuf::from("figures").join(format!("{stem}.{ext}")))
}

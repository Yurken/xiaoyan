use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use std::path::{Component, Path, PathBuf};

fn sanitize_asset_segment(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.') {
            output.push(ch);
        } else {
            output.push('_');
        }
    }
    if output.is_empty() {
        "asset".to_string()
    } else {
        output
    }
}

fn relative_path_string(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().to_string()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn collect_file_asset(
    assets: &mut serde_json::Map<String, serde_json::Value>,
    app_data_dir: &Path,
    file_path: &str,
    fallback_prefix: &str,
) -> Result<(), String> {
    if file_path.trim().is_empty() || assets.contains_key(file_path) {
        return Ok(());
    }

    let source = PathBuf::from(file_path);
    let bytes = std::fs::read(&source)
        .map_err(|error| format!("无法读取备份文件（{file_path}）：{error}"))?;
    let relative_path = source
        .strip_prefix(app_data_dir)
        .ok()
        .map(relative_path_string)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            let file_name = source
                .file_name()
                .and_then(|value| value.to_str())
                .map(sanitize_asset_segment)
                .unwrap_or_else(|| "asset.bin".to_string());
            format!(
                "restored_assets/{}/{}",
                sanitize_asset_segment(fallback_prefix),
                file_name
            )
        });

    assets.insert(
        file_path.to_string(),
        serde_json::json!({
            "relative_path": relative_path,
            "data": B64.encode(bytes),
        }),
    );
    Ok(())
}

pub(crate) fn collect_row_assets(
    table: &str,
    row: &serde_json::Value,
    app_data_dir: &Path,
    assets: &mut serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    if !matches!(table, "papers" | "paper_figures" | "experiment_attachments") {
        return Ok(());
    }

    let Some(file_path) = row.get("file_path").and_then(|value| value.as_str()) else {
        return Ok(());
    };
    let id = row
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or("row");
    collect_file_asset(assets, app_data_dir, file_path, &format!("{table}/{id}")).map_err(
        |error| {
            format!(
                "已取消备份导出（{table}/{id}）：{error}。请恢复文件或修正文件引用后重试。"
            )
        },
    )
}

#[cfg(test)]
#[path = "settings_backup_export_assets_tests.rs"]
mod tests;

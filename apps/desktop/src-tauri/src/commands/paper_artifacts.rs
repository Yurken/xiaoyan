use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

pub(crate) fn paper_dir(app: &AppHandle, paper_id: &str) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let paper_dir = data_dir.join("papers").join(paper_id);
    fs::create_dir_all(&paper_dir)
        .map_err(|e| format!("无法创建论文产物目录：{e}"))?;
    Ok(paper_dir)
}

pub(crate) fn paper_figures_dir(app: &AppHandle, paper_id: &str) -> Result<PathBuf, String> {
    let figures_dir = paper_dir(app, paper_id)?.join("figures");
    fs::create_dir_all(&figures_dir)
        .map_err(|e| format!("无法创建论文图片目录：{e}"))?;
    Ok(figures_dir)
}

pub(crate) fn save_markitdown_markdown(
    app: &AppHandle,
    paper_id: &str,
    markdown: &str,
) -> Result<PathBuf, String> {
    let markdown_path = paper_figures_dir(app, paper_id)?.join("source.md");
    fs::write(&markdown_path, markdown).map_err(|e| {
        format!(
            "无法写入 MarkItDown Markdown 文件 {}：{e}",
            markdown_path.display()
        )
    })?;
    Ok(markdown_path)
}

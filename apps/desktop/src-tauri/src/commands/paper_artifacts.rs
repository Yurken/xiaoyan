use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

pub(crate) fn paper_dir(app: &AppHandle, paper_id: &str) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let paper_dir = data_dir.join("papers").join(paper_id);
    fs::create_dir_all(&paper_dir).map_err(|e| format!("无法创建论文产物目录：{e}"))?;
    Ok(paper_dir)
}

pub(crate) fn paper_figures_dir(app: &AppHandle, paper_id: &str) -> Result<PathBuf, String> {
    let figures_dir = paper_dir(app, paper_id)?.join("figures");
    fs::create_dir_all(&figures_dir).map_err(|e| format!("无法创建论文图片目录：{e}"))?;
    Ok(figures_dir)
}

pub(crate) fn save_markitdown_markdown(
    app: &AppHandle,
    paper_id: &str,
    markdown: &str,
) -> Result<PathBuf, String> {
    save_paper_artifact(app, paper_id, "source.md", markdown)
}

pub(crate) fn save_plain_source_text(
    app: &AppHandle,
    paper_id: &str,
    text: &str,
) -> Result<PathBuf, String> {
    save_paper_artifact(app, paper_id, "source.txt", text)
}

pub(crate) fn save_fixed_source_markdown(
    app: &AppHandle,
    paper_id: &str,
    markdown: &str,
) -> Result<PathBuf, String> {
    save_paper_artifact(app, paper_id, "source_fix.md", markdown)
}

fn save_paper_artifact(
    app: &AppHandle,
    paper_id: &str,
    filename: &str,
    content: &str,
) -> Result<PathBuf, String> {
    let artifact_path = paper_dir(app, paper_id)?.join(filename);
    fs::write(&artifact_path, content)
        .map_err(|e| format!("无法写入论文产物文件 {}：{e}", artifact_path.display()))?;
    Ok(artifact_path)
}

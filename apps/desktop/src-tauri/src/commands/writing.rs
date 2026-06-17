use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;

use crate::commands::writing_support::{
    executable_candidates, latex_compiler_missing_message, latex_install_guide_url,
    mactex_installer_url,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WritingCompileRequest {
    pub project_name: String,
    pub main_tex: String,
    pub bibtex: String,
    pub notes: String,
    #[serde(default)]
    pub image_assets: Vec<WritingImageAsset>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WritingCompileResult {
    pub success: bool,
    pub pdf_path: Option<String>,
    pub work_dir: String,
    pub engine: String,
    pub log: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WritingImageAsset {
    pub id: String,
    pub file_name: String,
    pub project_path: String,
    pub stored_path: String,
    pub created_at: String,
}

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
pub async fn writing_compile_pdf(
    app: tauri::AppHandle,
    request: WritingCompileRequest,
) -> Result<WritingCompileResult, String> {
    tauri::async_runtime::spawn_blocking(move || compile_project(&app, request))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn writing_copy_pdf(pdf_path: String, destination_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let source = PathBuf::from(&pdf_path);
        if !source.exists() {
            return Err(format!("PDF 文件不存在：{pdf_path}"));
        }
        let destination = PathBuf::from(&destination_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建目标目录：{e}"))?;
        }
        fs::copy(&source, &destination).map_err(|e| format!("保存 PDF 失败：{e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn writing_open_compiled_pdf(
    app: tauri::AppHandle,
    pdf_path: String,
) -> Result<(), String> {
    let path = canonical_compiled_pdf_path(&app, Path::new(&pdf_path))?;
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
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

fn compile_project(
    app: &tauri::AppHandle,
    request: WritingCompileRequest,
) -> Result<WritingCompileResult, String> {
    let work_dir = create_work_dir(app, &request.project_name)?;
    write_project_files(app, &work_dir, &request)?;

    let mut log = String::new();

    let (engine, success) = if let Some(latexmk) = find_executable("latexmk") {
        let output = Command::new(&latexmk)
            .args([
                "-xelatex",
                "-interaction=nonstopmode",
                "-halt-on-error",
                "main.tex",
            ])
            .current_dir(&work_dir)
            .output()
            .map_err(|e| format!("运行 latexmk 失败：{e}"))?;
        append_output(&mut log, &latexmk, &output);
        ("latexmk".to_string(), output.status.success())
    } else if let Some(xelatex) = find_executable("xelatex") {
        (
            "xelatex".to_string(),
            run_xelatex_pipeline(&work_dir, &xelatex, &mut log)?,
        )
    } else {
        log.push_str(latex_compiler_missing_message());
        ("not-found".to_string(), false)
    };

    let pdf_path = work_dir.join("main.pdf");
    let pdf_exists = pdf_path.exists();
    let compile_success = success && pdf_exists;
    if success && !pdf_exists {
        log.push_str(
            "\n编译命令已结束，但没有生成 main.pdf。请检查日志中的 class/package 错误。\n",
        );
    }

    Ok(WritingCompileResult {
        success: compile_success,
        pdf_path: compile_success.then(|| pdf_path.to_string_lossy().to_string()),
        work_dir: work_dir.to_string_lossy().to_string(),
        engine,
        log: trim_log(log),
    })
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

fn create_work_dir(app: &tauri::AppHandle, project_name: &str) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let root = data_dir.join("writing_compiles");
    fs::create_dir_all(&root).map_err(|e| format!("无法创建编译目录：{e}"))?;
    let safe_name = sanitize_project_name(project_name);
    let work_dir = root.join(format!("{safe_name}-{}", Uuid::new_v4()));
    fs::create_dir_all(&work_dir).map_err(|e| format!("无法创建项目目录：{e}"))?;
    Ok(work_dir)
}

fn canonical_compiled_pdf_path(app: &tauri::AppHandle, path: &Path) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("writing_compiles");
    let canonical_root = root
        .canonicalize()
        .map_err(|e| format!("无法校验写作编译目录：{e}"))?;
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("PDF 文件不可访问：{e}"))?;

    if !canonical_path.is_file() {
        return Err("PDF 文件不存在。".to_string());
    }
    let is_pdf = canonical_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);
    if !is_pdf {
        return Err("仅支持打开 PDF 文件。".to_string());
    }
    if !canonical_path.starts_with(&canonical_root) {
        return Err("PDF 不在小妍写作编译目录内。".to_string());
    }

    Ok(canonical_path)
}

fn write_project_files(
    app: &tauri::AppHandle,
    work_dir: &Path,
    request: &WritingCompileRequest,
) -> Result<(), String> {
    fs::write(
        work_dir.join("main.tex"),
        ensure_main_tex(&request.main_tex),
    )
    .map_err(|e| format!("写入 main.tex 失败：{e}"))?;
    fs::write(
        work_dir.join("references.bib"),
        if request.bibtex.trim().is_empty() {
            "% Add BibTeX entries here.\n".to_string()
        } else {
            format!("{}\n", request.bibtex.trim_end())
        },
    )
    .map_err(|e| format!("写入 references.bib 失败：{e}"))?;
    fs::create_dir_all(work_dir.join("figures"))
        .map_err(|e| format!("创建 figures 目录失败：{e}"))?;
    copy_image_assets(app, work_dir, &request.image_assets)?;
    fs::create_dir_all(work_dir.join("notes")).map_err(|e| format!("创建 notes 目录失败：{e}"))?;
    fs::write(
        work_dir.join("notes").join("writing-notes.md"),
        if request.notes.trim().is_empty() {
            "# Writing Notes\n\n- TODO: Add revision notes.\n".to_string()
        } else {
            format!("{}\n", request.notes.trim_end())
        },
    )
    .map_err(|e| format!("写入写作便签失败：{e}"))?;
    fs::write(
        work_dir.join("latexmkrc"),
        "$pdf_mode = 1;\n$pdflatex = 'xelatex -interaction=nonstopmode %O %S';\n",
    )
    .map_err(|e| format!("写入 latexmkrc 失败：{e}"))?;
    Ok(())
}

fn managed_writing_assets_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let root = data_dir.join("writing_assets");
    fs::create_dir_all(&root).map_err(|e| format!("无法创建写作图片目录：{e}"))?;
    Ok(root)
}

fn copy_image_assets(
    app: &tauri::AppHandle,
    work_dir: &Path,
    image_assets: &[WritingImageAsset],
) -> Result<(), String> {
    if image_assets.is_empty() {
        return Ok(());
    }

    let assets_root = managed_writing_assets_root(app)?
        .canonicalize()
        .map_err(|e| format!("无法校验写作图片目录：{e}"))?;

    for asset in image_assets {
        let source = PathBuf::from(&asset.stored_path)
            .canonicalize()
            .map_err(|e| format!("图片资产不可访问（{}）：{e}", asset.file_name))?;
        if !source.starts_with(&assets_root) {
            return Err(format!("图片资产路径不安全：{}", asset.file_name));
        }
        if !source.is_file() {
            return Err(format!("图片资产不存在：{}", asset.file_name));
        }

        let relative_path = safe_project_image_path(&asset.project_path)?;
        let destination = work_dir.join(relative_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建图片目录：{e}"))?;
        }
        fs::copy(&source, &destination)
            .map_err(|e| format!("复制图片到编译目录失败（{}）：{e}", asset.file_name))?;
    }

    Ok(())
}

fn run_xelatex_pipeline(work_dir: &Path, xelatex: &str, log: &mut String) -> Result<bool, String> {
    let mut all_success = true;
    for pass in 1..=3 {
        let output = Command::new(xelatex)
            .args(["-interaction=nonstopmode", "-halt-on-error", "main.tex"])
            .current_dir(work_dir)
            .output()
            .map_err(|e| format!("运行 xelatex 失败：{e}"))?;
        append_output(log, &format!("{xelatex} pass {pass}"), &output);
        all_success = all_success && output.status.success();
        if pass == 1 {
            run_bibtex_if_available(work_dir, log)?;
        }
        if !output.status.success() {
            break;
        }
    }
    Ok(all_success)
}

fn run_bibtex_if_available(work_dir: &Path, log: &mut String) -> Result<(), String> {
    if !work_dir.join("main.aux").exists() {
        return Ok(());
    }
    let Some(bibtex) = find_executable("bibtex") else {
        log.push_str("\n未找到 bibtex，已跳过参考文献编译。\n");
        return Ok(());
    };
    let output = Command::new(&bibtex)
        .arg("main")
        .current_dir(work_dir)
        .output()
        .map_err(|e| format!("运行 bibtex 失败：{e}"))?;
    append_output(log, &bibtex, &output);
    Ok(())
}

fn find_executable(name: &str) -> Option<String> {
    for candidate in executable_candidates(name) {
        if Command::new(&candidate)
            .arg("--version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
        {
            return Some(candidate);
        }
    }
    None
}

fn append_output(log: &mut String, command: &str, output: &Output) {
    log.push_str("\n$ ");
    log.push_str(command);
    log.push('\n');
    log.push_str(&format!("status: {}\n", output.status));
    if !output.stdout.is_empty() {
        log.push_str("\n[stdout]\n");
        log.push_str(&String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        log.push_str("\n[stderr]\n");
        log.push_str(&String::from_utf8_lossy(&output.stderr));
    }
}

fn ensure_main_tex(source: &str) -> String {
    let trimmed = source.trim_start();
    let head: Vec<&str> = trimmed.lines().take(6).collect();
    let mut prefix = Vec::new();
    if !head.iter().any(|line| line.contains("!TeX program")) {
        prefix.push("% !TeX program = xelatex");
    }
    if !head.iter().any(|line| line.contains("!TeX root")) {
        prefix.push("% !TeX root = main.tex");
    }
    if prefix.is_empty() {
        source.to_string()
    } else {
        format!("{}\n{trimmed}", prefix.join("\n"))
    }
}

fn sanitize_project_name(value: &str) -> String {
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

fn sanitize_file_stem(value: &str) -> String {
    let sanitized = sanitize_project_name(value);
    if sanitized.is_empty() {
        "image".to_string()
    } else {
        sanitized
    }
}

fn normalize_image_extension(value: &str) -> Option<&'static str> {
    match value.to_ascii_lowercase().as_str() {
        "png" => Some("png"),
        "jpg" | "jpeg" => Some("jpg"),
        "pdf" => Some("pdf"),
        _ => None,
    }
}

fn safe_project_image_path(project_path: &str) -> Result<PathBuf, String> {
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

fn trim_log(log: String) -> String {
    const MAX_LOG_CHARS: usize = 60_000;
    if log.chars().count() <= MAX_LOG_CHARS {
        return log;
    }
    let tail: String = log
        .chars()
        .rev()
        .take(MAX_LOG_CHARS)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    format!("日志过长，已保留最后 {MAX_LOG_CHARS} 个字符。\n\n{tail}")
}

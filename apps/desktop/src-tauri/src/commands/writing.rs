use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
};

use serde::{Deserialize, Serialize};
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WritingCompileRequest {
    pub project_name: String,
    pub main_tex: String,
    pub bibtex: String,
    pub notes: String,
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

fn compile_project(
    app: &tauri::AppHandle,
    request: WritingCompileRequest,
) -> Result<WritingCompileResult, String> {
    let work_dir = create_work_dir(app, &request.project_name)?;
    write_project_files(&work_dir, &request)?;

    let mut log = String::new();

    let (engine, success) = if let Some(latexmk) = find_executable("latexmk") {
        let output = Command::new(&latexmk)
            .args(["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"])
            .current_dir(&work_dir)
            .output()
            .map_err(|e| format!("运行 latexmk 失败：{e}"))?;
        append_output(&mut log, &latexmk, &output);
        ("latexmk".to_string(), output.status.success())
    } else if let Some(xelatex) = find_executable("xelatex") {
        ("xelatex".to_string(), run_xelatex_pipeline(&work_dir, &xelatex, &mut log)?)
    } else {
        log.push_str(
            "未找到 LaTeX 编译器。\n\n请安装 MacTeX / TeX Live，并确保 latexmk 或 xelatex 可用。\nmacOS 常见路径：/Library/TeX/texbin\n",
        );
        ("not-found".to_string(), false)
    };

    let pdf_path = work_dir.join("main.pdf");
    let pdf_exists = pdf_path.exists();
    let compile_success = success && pdf_exists;
    if success && !pdf_exists {
        log.push_str("\n编译命令已结束，但没有生成 main.pdf。请检查日志中的 class/package 错误。\n");
    }

    Ok(WritingCompileResult {
        success: compile_success,
        pdf_path: compile_success.then(|| pdf_path.to_string_lossy().to_string()),
        work_dir: work_dir.to_string_lossy().to_string(),
        engine,
        log: trim_log(log),
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

fn write_project_files(work_dir: &Path, request: &WritingCompileRequest) -> Result<(), String> {
    fs::write(work_dir.join("main.tex"), ensure_main_tex(&request.main_tex))
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
    fs::create_dir_all(work_dir.join("figures")).map_err(|e| format!("创建 figures 目录失败：{e}"))?;
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

fn executable_candidates(name: &str) -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        return vec![format!("{name}.exe"), name.to_string()];
    }

    #[cfg(not(target_os = "windows"))]
    {
        vec![
            name.to_string(),
            format!("/Library/TeX/texbin/{name}"),
            format!("/usr/texbin/{name}"),
            format!("/opt/homebrew/bin/{name}"),
            format!("/usr/local/bin/{name}"),
        ]
    }
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

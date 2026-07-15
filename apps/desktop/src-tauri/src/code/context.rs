//! Workspace context helpers for the native code assistant.
//!
//! Inspired by opencode's environment and instruction loading: keep a compact,
//! explicit snapshot of project instructions, manifests, file inventory and Git
//! state close to the model without requiring the user to paste it manually.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::process::Command;

const MAX_CONTEXT_CHARS: usize = 36_000;
const MAX_INSTRUCTION_CHARS: usize = 7_000;
const MAX_MANIFEST_CHARS: usize = 8_000;
const MAX_FILES: usize = 160;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeWorkspaceContext {
    pub working_dir: String,
    pub current_file: Option<String>,
    pub is_git_repo: bool,
    pub git_status: String,
    pub package_scripts: Vec<String>,
    pub instruction_files: Vec<String>,
    pub key_files: Vec<String>,
    pub content: String,
}

pub async fn build_workspace_context(
    working_dir: &str,
    current_file: Option<&str>,
) -> Result<CodeWorkspaceContext, String> {
    ensure_working_dir(working_dir)?;

    let root = Path::new(working_dir);
    let is_git_repo = git_output(root, &["rev-parse", "--is-inside-work-tree"])
        .await
        .map(|value| value.trim() == "true")
        .unwrap_or(false);
    let git_status = if is_git_repo {
        git_output(root, &["status", "--short", "--branch"])
            .await
            .unwrap_or_else(|err| format!("Git 状态读取失败：{err}"))
    } else {
        "当前目录不是 Git 仓库。".to_string()
    };

    let instruction_files =
        collect_existing(root, &["AGENTS.md", "CLAUDE.md", "CODEX.md", "CONTEXT.md"]);
    let package_scripts = read_package_scripts(root).await.unwrap_or_default();
    let manifest_sections = read_manifest_sections(root).await;
    let key_files = list_key_files(root).await.unwrap_or_default();

    let mut sections = Vec::new();
    sections.push(format!(
        "<workspace>\nworking_dir: {}\ncurrent_file: {}\nis_git_repo: {}\n</workspace>",
        working_dir,
        current_file.unwrap_or(""),
        if is_git_repo { "yes" } else { "no" },
    ));

    if !git_status.trim().is_empty() {
        sections.push(format!(
            "<git_status>\n{}\n</git_status>",
            trim_chars(&git_status, 4_000)
        ));
    }

    if !package_scripts.is_empty() {
        sections.push(format!(
            "<package_scripts>\n{}\n</package_scripts>",
            package_scripts.join("\n"),
        ));
    }

    let instructions = read_instruction_sections(&instruction_files).await;
    if !instructions.is_empty() {
        sections.push(format!(
            "<project_instructions>\n{}\n</project_instructions>",
            instructions
        ));
    }

    if !manifest_sections.is_empty() {
        sections.push(format!(
            "<manifests>\n{}\n</manifests>",
            manifest_sections.join("\n\n")
        ));
    }

    if !key_files.is_empty() {
        sections.push(format!(
            "<file_inventory>\n{}\n</file_inventory>",
            key_files
                .iter()
                .take(MAX_FILES)
                .cloned()
                .collect::<Vec<_>>()
                .join("\n"),
        ));
    }

    let content = trim_chars(&sections.join("\n\n"), MAX_CONTEXT_CHARS);
    Ok(CodeWorkspaceContext {
        working_dir: working_dir.to_string(),
        current_file: current_file.map(str::to_string),
        is_git_repo,
        git_status,
        package_scripts,
        instruction_files: instruction_files
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
        key_files,
        content,
    })
}

pub async fn build_system_context(working_dir: &str) -> String {
    match build_workspace_context(working_dir, None).await {
        Ok(ctx) => {
            let mut compact = Vec::new();
            compact.push(format!("工作区摘要：\n{}", ctx.content));
            compact.push(
                "这些上下文用于理解项目规则和结构；真正修改文件前仍需读取目标文件的最新内容。"
                    .to_string(),
            );
            trim_chars(&compact.join("\n\n"), MAX_CONTEXT_CHARS)
        }
        Err(_) => String::new(),
    }
}

fn ensure_working_dir(working_dir: &str) -> Result<(), String> {
    let path = Path::new(working_dir);
    if working_dir.trim().is_empty() {
        return Err("请先选择工作目录。".into());
    }
    if !path.exists() {
        return Err("工作目录不存在。".into());
    }
    if !path.is_dir() {
        return Err("工作目录不是目录。".into());
    }
    Ok(())
}

fn collect_existing(root: &Path, names: &[&str]) -> Vec<PathBuf> {
    names
        .iter()
        .map(|name| root.join(name))
        .filter(|path| path.is_file())
        .collect()
}

async fn read_instruction_sections(files: &[PathBuf]) -> String {
    let mut sections = Vec::new();
    for file in files {
        if let Ok(content) = tokio::fs::read_to_string(file).await {
            sections.push(format!(
                "Instructions from: {}\n{}",
                file.to_string_lossy(),
                trim_chars(&content, MAX_INSTRUCTION_CHARS),
            ));
        }
    }
    sections.join("\n\n")
}

async fn read_manifest_sections(root: &Path) -> Vec<String> {
    let mut sections = Vec::new();
    for name in [
        "package.json",
        "pnpm-workspace.yaml",
        "Cargo.toml",
        "pyproject.toml",
        "tsconfig.json",
    ] {
        let path = root.join(name);
        if !path.is_file() {
            continue;
        }
        if let Ok(content) = tokio::fs::read_to_string(&path).await {
            sections.push(format!(
                "{}\n{}",
                name,
                trim_chars(&content, MAX_MANIFEST_CHARS / 2),
            ));
        }
    }
    sections
}

async fn read_package_scripts(root: &Path) -> Result<Vec<String>, String> {
    let path = root.join("package.json");
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("读取 package.json 失败：{e}"))?;
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 package.json 失败：{e}"))?;
    let scripts = value
        .get("scripts")
        .and_then(|value| value.as_object())
        .map(|map| {
            let mut scripts = map
                .iter()
                .filter_map(|(key, value)| value.as_str().map(|cmd| format!("{key}: {cmd}")))
                .collect::<Vec<_>>();
            scripts.sort();
            scripts
        })
        .unwrap_or_default();
    Ok(scripts)
}

async fn list_key_files(root: &Path) -> Result<Vec<String>, String> {
    let output = Command::new("rg")
        .arg("--files")
        .arg("--hidden")
        .arg("--glob")
        .arg("!.git")
        .arg("--glob")
        .arg("!node_modules")
        .current_dir(root)
        .output()
        .await
        .map_err(|e| format!("列出文件失败：{e}"))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let mut files = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| is_useful_inventory_file(line))
        .take(MAX_FILES)
        .map(str::to_string)
        .collect::<Vec<_>>();
    files.sort();
    Ok(files)
}

fn is_useful_inventory_file(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    if lower.contains("/dist/")
        || lower.contains("/build/")
        || lower.contains("/target/")
        || lower.contains("/coverage/")
        || lower.ends_with(".lock")
        || lower.ends_with(".png")
        || lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".pdf")
    {
        return false;
    }
    true
}

async fn git_output(root: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .await
        .map_err(|e| format!("Git 命令执行失败：{e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Git 命令执行失败。".to_string()
        } else {
            stderr
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn trim_chars(value: &str, limit: usize) -> String {
    if value.chars().count() <= limit {
        return value.to_string();
    }
    let prefix = value.chars().take(limit).collect::<String>();
    format!("{prefix}\n...（内容过长，已截断）")
}

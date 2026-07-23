use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::process::Command;

use crate::llm::{resolve_model, resolve_temperature_chain, LlmClient, LlmMessage};

const MAX_DIFF_CHARS: usize = 60_000;
const MAX_REVIEW_DIFF_CHARS: usize = 120_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeGitFile {
    pub path: String,
    pub index_status: String,
    pub worktree_status: String,
    pub staged: bool,
    pub unstaged: bool,
    pub untracked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeGitSnapshot {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub head: Option<String>,
    pub upstream: Option<String>,
    pub ahead: i32,
    pub behind: i32,
    pub files: Vec<CodeGitFile>,
    pub staged_diff: String,
    pub unstaged_diff: String,
    pub recent_commits: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeReviewReport {
    pub content: String,
    pub diff_chars: usize,
}

pub async fn snapshot(working_dir: &str) -> Result<CodeGitSnapshot, String> {
    ensure_working_dir(working_dir)?;
    if !is_git_repo(working_dir).await {
        return Ok(CodeGitSnapshot {
            is_repo: false,
            branch: None,
            head: None,
            upstream: None,
            ahead: 0,
            behind: 0,
            files: Vec::new(),
            staged_diff: String::new(),
            unstaged_diff: String::new(),
            recent_commits: Vec::new(),
        });
    }

    let status = git_output(
        working_dir,
        &["status", "--porcelain=v1", "-b", "--untracked-files=all"],
    )
    .await?;
    let (branch, upstream, ahead, behind, files) = parse_status(&status);
    let head = git_output(working_dir, &["rev-parse", "--short", "HEAD"])
        .await
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let staged_diff = git_output(working_dir, &["diff", "--cached", "--"])
        .await
        .map(|value| truncate_chars(&value, MAX_DIFF_CHARS))
        .unwrap_or_default();
    let unstaged_diff = git_output(working_dir, &["diff", "--"])
        .await
        .map(|value| truncate_chars(&value, MAX_DIFF_CHARS))
        .unwrap_or_default();
    let recent_commits = git_output(
        working_dir,
        &["log", "--oneline", "--decorate", "--max-count=6"],
    )
    .await
    .unwrap_or_default()
    .lines()
    .map(str::trim)
    .filter(|line| !line.is_empty())
    .map(str::to_string)
    .collect();

    Ok(CodeGitSnapshot {
        is_repo: true,
        branch,
        head,
        upstream,
        ahead,
        behind,
        files,
        staged_diff,
        unstaged_diff,
        recent_commits,
    })
}

pub async fn stage_path(working_dir: &str, path: &str) -> Result<(), String> {
    ensure_working_dir(working_dir)?;
    let path = sanitize_git_path(path)?;
    git_output(working_dir, &["add", "--", &path]).await?;
    Ok(())
}

pub async fn unstage_path(working_dir: &str, path: &str) -> Result<(), String> {
    ensure_working_dir(working_dir)?;
    let path = sanitize_git_path(path)?;
    git_output(working_dir, &["restore", "--staged", "--", &path]).await?;
    Ok(())
}

/// 放弃单个文件的工作区改动（不可逆）。
///
/// - 已跟踪文件：`git restore -- <path>` —— 把工作区版本回退到 index/HEAD。
///   如果文件已经 `git add`，已暂存的改动**不会**被丢弃（仍可重新提交）；
///   这里只放弃工作区中尚未暂存的修改，跟 VSCode "Discard Changes" 行为一致。
///   若用户想连暂存一起丢弃，UI 上需要先 "Unstage" 再 "Discard"。
/// - 未跟踪文件（`??`）：`git clean -f -- <path>` —— 直接删除磁盘上的文件，
///   因为这类文件 git restore 管不到，只能用 clean 清理。
pub async fn discard_path(working_dir: &str, path: &str) -> Result<(), String> {
    ensure_working_dir(working_dir)?;
    if !is_git_repo(working_dir).await {
        return Err("当前目录不是 Git 仓库。".into());
    }
    let path = sanitize_git_path(path)?;

    // 先用 porcelain 状态判断这个文件是否未跟踪。
    // git status --porcelain 输出形如 "?? path"，未跟踪文件首两列就是 "??"。
    let status = git_output(
        working_dir,
        &["status", "--porcelain=v1", "--untracked-files=all", "--", &path],
    )
    .await?;
    let is_untracked = status
        .lines()
        .next()
        .map(|line| line.starts_with("??"))
        .unwrap_or(false);

    if is_untracked {
        git_output(working_dir, &["clean", "-f", "--", &path]).await?;
    } else {
        git_output(working_dir, &["restore", "--", &path]).await?;
    }
    Ok(())
}

pub async fn commit(working_dir: &str, message: &str) -> Result<String, String> {
    ensure_working_dir(working_dir)?;
    let message = message.trim();
    if message.is_empty() {
        return Err("提交信息不能为空。".into());
    }
    git_output(working_dir, &["commit", "-m", message]).await
}

pub async fn list_branches(working_dir: &str) -> Result<Vec<String>, String> {
    ensure_working_dir(working_dir)?;
    if !is_git_repo(working_dir).await {
        return Err("当前目录不是 Git 仓库。".into());
    }
    let output = git_output(working_dir, &["branch", "--format=%(refname:short)"]).await?;
    Ok(output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect())
}

pub async fn checkout_branch(working_dir: &str, branch: &str) -> Result<(), String> {
    ensure_working_dir(working_dir)?;
    if !is_git_repo(working_dir).await {
        return Err("当前目录不是 Git 仓库。".into());
    }
    let branch = branch.trim();
    if branch.is_empty() {
        return Err("分支名称不能为空。".into());
    }
    git_output(working_dir, &["checkout", branch]).await?;
    Ok(())
}

pub async fn generate_commit_message(
    settings: &std::collections::HashMap<String, String>,
    working_dir: &str,
) -> Result<String, String> {
    ensure_working_dir(working_dir)?;
    if !is_git_repo(working_dir).await {
        return Err("当前目录不是 Git 仓库。".into());
    }

    let status = git_output(
        working_dir,
        &["status", "--porcelain=v1", "-b", "--untracked-files=all"],
    )
    .await?;
    let staged_diff = git_output(working_dir, &["diff", "--cached", "--"])
        .await
        .unwrap_or_default();
    if staged_diff.trim().is_empty() {
        return Err("没有已暂存的变更，无法生成提交注释。".into());
    }
    let recent_commits = git_output(
        working_dir,
        &["log", "--oneline", "--decorate", "--max-count=6"],
    )
    .await
    .unwrap_or_default();

    let client = LlmClient::from_settings(settings).map_err(|e| e.to_string())?;
    let model = resolve_model(
        settings,
        &[
            "code_assistant_model",
            "copilot_simple_model",
            "paper_analysis_model",
        ],
    );
    let temperature = resolve_temperature_chain(
        settings,
        &["code_assistant_temperature", "copilot_simple_temperature"],
        0.2,
    );

    let prompt = format!(
        "请根据以下已暂存的 Git diff 生成一条简洁的 commit message。\n\n要求：\n- 参照下面最近几次提交的风格和格式。\n- 只输出 commit message 本身，不要解释、不要代码块、不要引号。\n- 聚焦「为什么改」，而非「改了什么」。\n- 1-2 句话，不超过 80 个字符。\n\n最近提交样例：\n{}\n\n当前变更状态：\n{}\n\nDiff：\n{}",
        recent_commits,
        status,
        truncate_chars(&staged_diff, MAX_DIFF_CHARS)
    );

    let messages = vec![
        LlmMessage::system("你是专业的 Git commit message 生成助手。"),
        LlmMessage::user(prompt),
    ];

    let content = client
        .chat_with_max_tokens(&messages, model.as_deref(), temperature, 512)
        .await
        .map_err(|e| format!("生成提交注释失败：{e}"))?;

    Ok(content.trim().to_string())
}

pub async fn review_changes(
    settings: &std::collections::HashMap<String, String>,
    working_dir: &str,
) -> Result<CodeReviewReport, String> {
    ensure_working_dir(working_dir)?;
    if !is_git_repo(working_dir).await {
        return Err("当前目录不是 Git 仓库，无法基于变更审查。".into());
    }

    let status = git_output(
        working_dir,
        &["status", "--porcelain=v1", "-b", "--untracked-files=all"],
    )
    .await?;
    let staged_diff = git_output(working_dir, &["diff", "--cached", "--"])
        .await
        .unwrap_or_default();
    let unstaged_diff = git_output(working_dir, &["diff", "--"])
        .await
        .unwrap_or_default();
    let combined_diff = format!(
        "## Git status\n{}\n\n## Staged diff\n{}\n\n## Unstaged diff\n{}",
        status, staged_diff, unstaged_diff
    );
    if staged_diff.trim().is_empty() && unstaged_diff.trim().is_empty() {
        return Err("当前没有可审查的 Git diff。".into());
    }

    let diff_chars = combined_diff.chars().count();
    let review_input = truncate_chars(&combined_diff, MAX_REVIEW_DIFF_CHARS);
    let client = LlmClient::from_settings(settings).map_err(|e| e.to_string())?;
    let model = resolve_model(
        settings,
        &[
            "code_assistant_model",
            "copilot_simple_model",
            "paper_analysis_model",
        ],
    );
    let temperature = resolve_temperature_chain(
        settings,
        &["code_assistant_temperature", "copilot_simple_temperature"],
        0.2,
    );
    let messages = vec![
        LlmMessage::system(
            "你是严谨的代码审查助手。请只基于用户提供的 Git diff 审查，优先指出真实 bug、回归风险、安全/数据丢失风险、缺失测试和可维护性问题。按严重程度排序；每条包含文件/位置线索、原因和建议。若未发现明确问题，请说明未发现阻塞性问题，并列出剩余风险。",
        ),
        LlmMessage::user(format!(
            "请审查以下工作区变更。输出中文，结构为：\n1. 结论\n2. 主要问题（按 P0/P1/P2）\n3. 建议验证\n\n{}",
            review_input
        )),
    ];
    let content = client
        .chat_with_max_tokens(&messages, model.as_deref(), temperature, 4096)
        .await
        .map_err(|e| format!("代码审查失败：{e}"))?;

    Ok(CodeReviewReport {
        content,
        diff_chars,
    })
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

fn sanitize_git_path(path: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("文件路径不能为空。".into());
    }
    if trimmed.contains('\0') || trimmed.starts_with('-') || trimmed.contains("..") {
        return Err("文件路径不安全。".into());
    }
    Ok(trimmed.to_string())
}

async fn is_git_repo(working_dir: &str) -> bool {
    git_output(working_dir, &["rev-parse", "--is-inside-work-tree"])
        .await
        .map(|value| value.trim() == "true")
        .unwrap_or(false)
}

async fn git_output(working_dir: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(working_dir)
        .output()
        .await
        .map_err(|e| format!("Git 命令执行失败：{e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(if detail.is_empty() {
            "Git 命令失败。".into()
        } else {
            detail
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn parse_status(raw: &str) -> (Option<String>, Option<String>, i32, i32, Vec<CodeGitFile>) {
    let mut branch = None;
    let mut upstream = None;
    let mut ahead = 0;
    let mut behind = 0;
    let mut files = Vec::new();

    for line in raw.lines() {
        if let Some(rest) = line.strip_prefix("## ") {
            let (parsed_branch, parsed_upstream, parsed_ahead, parsed_behind) =
                parse_branch_line(rest);
            branch = parsed_branch;
            upstream = parsed_upstream;
            ahead = parsed_ahead;
            behind = parsed_behind;
            continue;
        }
        if line.len() < 4 {
            continue;
        }
        let index_status = line.chars().next().unwrap_or(' ').to_string();
        let worktree_status = line.chars().nth(1).unwrap_or(' ').to_string();
        let mut path = line[3..].trim().to_string();
        if let Some((_, next)) = path.split_once(" -> ") {
            path = next.to_string();
        }
        let untracked = index_status == "?" && worktree_status == "?";
        let staged = !untracked && index_status != " ";
        let unstaged = untracked || worktree_status != " ";
        files.push(CodeGitFile {
            path,
            index_status,
            worktree_status,
            staged,
            unstaged,
            untracked,
        });
    }

    (branch, upstream, ahead, behind, files)
}

fn parse_branch_line(rest: &str) -> (Option<String>, Option<String>, i32, i32) {
    let mut branch_part = rest;
    let mut upstream = None;
    let mut ahead = 0;
    let mut behind = 0;

    if let Some((before, tracking)) = rest.split_once("...") {
        branch_part = before;
        let (upstream_part, meta_part) = tracking
            .split_once(' ')
            .map(|(u, m)| (u, Some(m)))
            .unwrap_or((tracking, None));
        upstream = Some(upstream_part.trim().to_string()).filter(|value| !value.is_empty());
        if let Some(meta) = meta_part {
            let meta = meta.trim().trim_start_matches('[').trim_end_matches(']');
            for part in meta.split(',') {
                let part = part.trim();
                if let Some(value) = part.strip_prefix("ahead ") {
                    ahead = value.parse().unwrap_or(0);
                } else if let Some(value) = part.strip_prefix("behind ") {
                    behind = value.parse().unwrap_or(0);
                }
            }
        }
    }

    (
        Some(branch_part.trim().to_string()).filter(|value| !value.is_empty()),
        upstream,
        ahead,
        behind,
    )
}

fn truncate_chars(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let prefix: String = text.chars().take(max_chars).collect();
    format!("{prefix}\n...（内容过长，仅保留前 {max_chars} 个字符）")
}

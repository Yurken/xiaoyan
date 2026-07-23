//! 基于 `ignore` crate（ripgrep 内部使用的同一套库）的纯 Rust 文件遍历与 glob 匹配。
//!
//! 背景：小妍早期版本通过 `tokio::process::Command::new("rg")` 调用 ripgrep 完成文件列举与
//! glob 过滤。由于 ripgrep 不是桌面应用的标准依赖，终端用户机器上若未安装 `rg`，
//! 就会出现 `No such file or directory (os error 2)` 错误（例如 `tools.rs::glob_files`）。
//!
//! `ignore` 是 ripgrep 的核心库，提供同样的 glob/gitignore 语义，但完全在进程内执行，
//! 跨平台一致，不再依赖外部二进制。
//!
//! 用法：
//! - [`walk_files`] —— 递归列出目录下所有文件（可按 glob 白名单过滤）。
//! - [`search_content`] —— 在目录下用 regex 模式搜索文件内容（替代 `rg`/`grep`）。

use globset::{Glob, GlobMatcher};
use ignore::{overrides::OverrideBuilder, WalkBuilder};
use std::path::Path;

/// 在 `root` 下递归列出匹配 `include_glob` 的文件路径（相对 `root`）。
///
/// - `include_glob`：glob 白名单，匹配的文件会被包含；传 `None` 表示不过滤。
/// - `extra_ignore_globs`：附加的忽略 glob 列表（不带 `!` 前缀，会自动加上）。
///   常用于在已默认排除 `.git` / `node_modules` 之外再排除 `dist` / `target` 等。
/// - `limit`：最多返回的条目数；超出后截断。
pub fn walk_files(
    root: &Path,
    include_glob: Option<&str>,
    extra_ignore_globs: &[&str],
    limit: usize,
) -> Result<Vec<String>, String> {
    let mut overrides = OverrideBuilder::new(root);
    if let Some(pattern) = include_glob {
        // Opencode 的语义：include 模式不要求路径前缀，glob 内部用 `**` 兼容任意深度。
        overrides
            .add(pattern)
            .map_err(|err| format!("glob 模式无效：{err}"))?;
    }
    for ignore_pattern in extra_ignore_globs {
        // `ignore` 的 overrides 模块：`!` 前缀表示排除。
        let prefixed = if ignore_pattern.starts_with('!') {
            ignore_pattern.to_string()
        } else {
            format!("!{ignore_pattern}")
        };
        overrides
            .add(&prefixed)
            .map_err(|err| format!("忽略模式无效：{err}"))?;
    }
    let overrides = overrides
        .build()
        .map_err(|err| format!("构建 glob 规则失败：{err}"))?;

    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true) // 尊重 .gitignore，与原 rg 行为一致
        .require_git(false) // 即便不是 git 仓库也继续走
        .overrides(overrides)
        .build();

    let mut results: Vec<String> = Vec::new();
    for entry in walker.flatten() {
        if !entry.file_type().is_some_and(|ft| ft.is_file()) {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(root)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .replace('\\', "/");
        if relative.is_empty() {
            continue;
        }
        results.push(relative);
        if results.len() >= limit {
            break;
        }
    }
    Ok(results)
}

/// 在 `root` 下递归搜索 `pattern`（regex 字符串）匹配的文件内容。
/// 返回 `Vec<(相对路径, 行号, 行内容)>`，结果数受 `limit` 约束。
///
/// 当 `include_glob` 给出时，仅扫描文件名匹配该 glob 的文件。
pub fn search_content(
    root: &Path,
    pattern: &str,
    include_glob: Option<&str>,
    limit: usize,
) -> Result<Vec<(String, u64, String)>, String> {
    let regex = regex::RegexBuilder::new(pattern)
        .build()
        .map_err(|err| format!("搜索模式不是合法正则：{err}"))?;

    let matcher: Option<GlobMatcher> = match include_glob {
        Some(p) => Some(
            Glob::new(p)
                .map_err(|err| format!("文件过滤 glob 无效：{err}"))?
                .compile_matcher(),
        ),
        None => None,
    };

    let mut overrides = OverrideBuilder::new(root);
    overrides
        .add("!.git/**")
        .map_err(|err| format!("忽略模式无效：{err}"))?;
    let overrides = overrides
        .build()
        .map_err(|err| format!("构建 glob 规则失败：{err}"))?;

    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .require_git(false)
        .overrides(overrides)
        .build();

    let mut hits: Vec<(String, u64, String)> = Vec::new();
    for entry in walker.flatten() {
        if !entry.file_type().is_some_and(|ft| ft.is_file()) {
            continue;
        }
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");

        if let Some(matcher) = &matcher {
            // matcher 接受 Path 或 str；传入文件相对路径字符串即可。
            if !matcher.is_match(Path::new(&relative)) {
                continue;
            }
        }

        // 大文件跳过（与原实现 2MB 截断保持一致）。
        let Ok(metadata) = std::fs::metadata(path) else {
            continue;
        };
        if metadata.len() > 2 * 1024 * 1024 {
            continue;
        }

        let Ok(content) = std::fs::read_to_string(path) else {
            continue;
        };

        for (idx, line) in content.lines().enumerate() {
            if regex.is_match(line) {
                hits.push((relative.clone(), (idx as u64) + 1, line.to_string()));
                if hits.len() >= limit {
                    return Ok(hits);
                }
            }
        }
    }
    Ok(hits)
}

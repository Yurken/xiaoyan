//! 托管子进程的环境变量适配。
//!
//! macOS 上由 Finder / Dock 启动的 GUI 进程只继承最小 PATH
//! （`/usr/bin:/bin:/usr/sbin:/sbin`），而 CLI 包装脚本普遍依赖
//! `#!/usr/bin/env node` 这类 shebang 启动。解释器目录不在 PATH 中时，
//! 脚本会直接以退出码 127 结束，并在 stderr 输出
//! `env: node: No such file or directory`。
//!
//! 因此托管子进程不能沿用当前进程的 PATH，必须显式注入一份增强 PATH。

use std::{
    collections::HashSet,
    ffi::OsString,
    path::{Path, PathBuf},
    sync::OnceLock,
};

use tokio::process::Command;

/// 登录 shell 中的 PATH。GUI 进程不读取 shell 配置，只能主动询问一次并缓存。
#[cfg(unix)]
fn login_shell_path() -> Option<OsString> {
    static CACHED: OnceLock<Option<OsString>> = OnceLock::new();
    CACHED
        .get_or_init(|| {
            let shell = if Path::new("/bin/zsh").is_file() {
                "/bin/zsh"
            } else {
                "/bin/bash"
            };
            let output = std::process::Command::new(shell)
                .args(["-lic", "printf %s \"$PATH\""])
                .output()
                .ok()?;
            if !output.status.success() {
                return None;
            }
            let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (!value.is_empty()).then(|| OsString::from(value))
        })
        .clone()
}

#[cfg(not(unix))]
fn login_shell_path() -> Option<OsString> {
    None
}

/// 组合子进程使用的 PATH，顺序为：登录 shell → 当前进程 → 可执行文件所在目录 → 兜底目录。
///
/// 可执行文件所在目录必须带上：通过 nvm、pnpm 等工具链安装的 CLI 与它的解释器
/// 通常同处一个 `bin` 目录，只把可执行文件绝对路径找出来是不够的。
pub fn augmented_path(extra_dirs: &[PathBuf], executable: Option<&Path>) -> Option<OsString> {
    let mut directories: Vec<PathBuf> = Vec::new();
    if let Some(path) = login_shell_path() {
        directories.extend(std::env::split_paths(&path));
    }
    if let Some(path) = std::env::var_os("PATH") {
        directories.extend(std::env::split_paths(&path));
    }
    if let Some(directory) = executable.and_then(Path::parent) {
        directories.push(directory.to_path_buf());
    }
    directories.extend(extra_dirs.iter().cloned());

    let mut seen = HashSet::new();
    let unique: Vec<PathBuf> = directories
        .into_iter()
        .filter(|directory| !directory.as_os_str().is_empty() && seen.insert(directory.clone()))
        .collect();
    if unique.is_empty() {
        return None;
    }
    std::env::join_paths(unique).ok()
}

/// 为托管子进程注入增强 PATH，避免解释器不可见导致的退出码 127。
pub fn apply_augmented_path(
    command: &mut Command,
    extra_dirs: &[PathBuf],
    executable: Option<&Path>,
) {
    if let Some(path) = augmented_path(extra_dirs, executable) {
        command.env("PATH", path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(path: OsString) -> Vec<PathBuf> {
        std::env::split_paths(&path).collect()
    }

    #[test]
    fn keeps_extra_directories() {
        let directories = parse(
            augmented_path(&[PathBuf::from("/tmp/xiaoyan-extra-bin")], None)
                .expect("PATH 不应为空"),
        );
        assert!(directories.contains(&PathBuf::from("/tmp/xiaoyan-extra-bin")));
    }

    #[test]
    fn keeps_the_executable_directory() {
        let directories = parse(
            augmented_path(&[], Some(Path::new("/tmp/xiaoyan-tool/bin/tool")))
                .expect("PATH 不应为空"),
        );
        assert!(directories.contains(&PathBuf::from("/tmp/xiaoyan-tool/bin")));
    }

    #[test]
    fn deduplicates_repeated_directories() {
        let directories = parse(
            augmented_path(
                &[
                    PathBuf::from("/tmp/xiaoyan-dup-bin"),
                    PathBuf::from("/tmp/xiaoyan-dup-bin"),
                ],
                None,
            )
            .expect("PATH 不应为空"),
        );
        assert_eq!(
            directories
                .iter()
                .filter(|directory| directory.ends_with("xiaoyan-dup-bin"))
                .count(),
            1
        );
    }

    #[test]
    fn injects_path_into_the_child_command() {
        let mut command = Command::new("/bin/echo");
        apply_augmented_path(&mut command, &[PathBuf::from("/tmp/xiaoyan-env-bin")], None);

        let path = command
            .as_std()
            .get_envs()
            .find(|(key, _)| *key == "PATH")
            .and_then(|(_, value)| value)
            .map(|value| value.to_string_lossy().to_string())
            .expect("应当设置 PATH");
        assert!(path.contains("/tmp/xiaoyan-env-bin"));
    }
}

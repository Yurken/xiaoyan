//! 代码工具注册表 — 把用户本地已安装的各类 code CLI（claude / gemini /
//! opencode / codex / kimi 等）抽象成统一的「工具描述符」，并负责：
//! 1. 探测某个工具是否安装、解析其二进制路径与版本；
//! 2. 为某个工具构造一次非交互（headless / print）调用的命令规格。
//!
//! 注意：这里只关心「如何调用本地工具」，不涉及小妍自身的 API 配置——
//! 代码功能一律使用各工具本地已配置好的鉴权与模型。

use serde::Serialize;
use tokio::process::Command;

/// 一个代码工具的静态描述。
pub struct CodeToolSpec {
    /// 稳定标识，前后端一致（claude / gemini / opencode / codex / kimi）。
    pub id: &'static str,
    /// 展示名。
    pub label: &'static str,
    /// 默认二进制名（在 PATH 中查找）。
    pub bin: &'static str,
}

/// 已知工具清单。顺序即前端默认展示顺序。
pub const TOOLS: &[CodeToolSpec] = &[
    CodeToolSpec { id: "claude", label: "Claude Code", bin: "claude" },
    CodeToolSpec { id: "codex", label: "Codex", bin: "codex" },
    CodeToolSpec { id: "gemini", label: "Gemini CLI", bin: "gemini" },
    CodeToolSpec { id: "opencode", label: "opencode", bin: "opencode" },
    CodeToolSpec { id: "kimi", label: "Kimi CLI", bin: "kimi" },
];

pub fn spec(tool_id: &str) -> Option<&'static CodeToolSpec> {
    TOOLS.iter().find(|t| t.id == tool_id)
}

/// 一次工具调用的探测结果。
#[derive(Debug, Clone, Serialize)]
pub struct ToolStatus {
    pub id: String,
    pub label: String,
    pub installed: bool,
    pub binary_path: Option<String>,
    pub version: Option<String>,
}

/// 查找可执行文件的绝对路径。
///
/// 打包后的 macOS GUI 应用拿到的 PATH 往往被精简（不含 Homebrew、`~/.local/bin`
/// 等），仅靠 `which` 会漏检。这里依次尝试：当前 PATH → 用户登录 shell 的完整
/// PATH → 常见安装目录扫描，尽量保证 dev 与打包态都能命中。
pub fn find_in_path(name: &str) -> Option<String> {
    #[cfg(not(target_os = "windows"))]
    let probe = ("which", name);
    #[cfg(target_os = "windows")]
    let probe = ("where", name);

    if let Ok(output) = std::process::Command::new(probe.0).arg(probe.1).output() {
        if output.status.success() {
            if let Some(p) = first_nonempty_line(&output.stdout) {
                return Some(p);
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(p) = find_via_login_shell(name) {
            return Some(p);
        }
        if let Some(p) = find_in_common_dirs(name) {
            return Some(p);
        }
    }

    None
}

fn first_nonempty_line(bytes: &[u8]) -> Option<String> {
    let s = String::from_utf8_lossy(bytes);
    let line = s.lines().next().unwrap_or("").trim().to_string();
    if line.is_empty() {
        None
    } else {
        Some(line)
    }
}

/// 借用户登录 shell（会 source profile）的完整 PATH 解析二进制。
/// `name` 取自固定工具注册表，非用户输入，无注入风险。
#[cfg(not(target_os = "windows"))]
fn find_via_login_shell(name: &str) -> Option<String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
    let output = std::process::Command::new(shell)
        .arg("-lc")
        .arg(format!("command -v {name}"))
        .output()
        .ok()?;
    if output.status.success() {
        first_nonempty_line(&output.stdout).filter(|p| p.starts_with('/'))
    } else {
        None
    }
}

/// 扫描常见安装目录作为最后兜底。
#[cfg(not(target_os = "windows"))]
fn find_in_common_dirs(name: &str) -> Option<String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let dirs = [
        "/opt/homebrew/bin".to_string(),
        "/usr/local/bin".to_string(),
        "/usr/bin".to_string(),
        format!("{home}/.local/bin"),
        format!("{home}/.bun/bin"),
        format!("{home}/.cargo/bin"),
        format!("{home}/.deno/bin"),
        format!("{home}/.volta/bin"),
        format!("{home}/go/bin"),
        format!("{home}/.npm-global/bin"),
    ];
    for d in dirs {
        if d.is_empty() {
            continue;
        }
        let p = std::path::Path::new(&d).join(name);
        if p.is_file() {
            return Some(p.to_string_lossy().to_string());
        }
    }
    None
}

/// 读取某工具版本（best-effort，失败返回 None，不阻塞检测）。
async fn read_version(binary: &str) -> Option<String> {
    let output = Command::new(binary).arg("--version").output().await.ok()?;
    if output.status.success() {
        let v = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !v.is_empty() {
            return Some(v);
        }
    }
    None
}

/// 探测全部已知工具的安装情况（仅 5 个工具，顺序探测即可）。
pub async fn detect_all() -> Vec<ToolStatus> {
    let mut out = Vec::with_capacity(TOOLS.len());
    for t in TOOLS {
        let binary_path = find_in_path(t.bin);
        let version = match &binary_path {
            Some(bin) => read_version(bin).await,
            None => None,
        };
        out.push(ToolStatus {
            id: t.id.to_string(),
            label: t.label.to_string(),
            installed: binary_path.is_some(),
            binary_path,
            version,
        });
    }
    out
}

/// 一次工具调用的命令规格。
pub struct RunSpec {
    pub program: String,
    pub args: Vec<String>,
    /// 部分工具（如 kimi）没有命令行 prompt 参数，需要把提示词写入 stdin。
    pub stdin: Option<String>,
}

/// 为指定工具构造一次非交互调用。`model` 为空表示使用工具自带默认模型。
///
/// 各工具的非交互调用方式（已对本地实际版本核实）：
/// - claude:   `claude -p <prompt> [--model <m>]`
/// - gemini:   `gemini -p <prompt> [-m <m>]`
/// - opencode: `opencode run <prompt> [-m provider/model]`
/// - codex:    `codex exec <prompt> [-m <m>]`
/// - kimi:     无 print 子命令，提示词走 stdin，`--yolo` 自动批准（实验性）
pub fn build_run_spec(tool_id: &str, binary: &str, prompt: &str, model: Option<&str>) -> RunSpec {
    let model = model.map(str::trim).filter(|s| !s.is_empty());
    let prog = binary.to_string();

    let with_model = |mut args: Vec<String>, flag: &str| {
        if let Some(m) = model {
            args.push(flag.to_string());
            args.push(m.to_string());
        }
        args
    };

    match tool_id {
        "claude" => RunSpec {
            program: prog,
            args: with_model(vec!["-p".into(), prompt.into()], "--model"),
            stdin: None,
        },
        "gemini" => RunSpec {
            program: prog,
            args: with_model(vec!["-p".into(), prompt.into()], "-m"),
            stdin: None,
        },
        "opencode" => RunSpec {
            program: prog,
            args: with_model(vec!["run".into(), prompt.into()], "-m"),
            stdin: None,
        },
        "codex" => RunSpec {
            program: prog,
            args: with_model(vec!["exec".into(), prompt.into()], "-m"),
            stdin: None,
        },
        "kimi" => RunSpec {
            program: prog,
            args: with_model(vec!["--yolo".into()], "-m"),
            stdin: Some(prompt.to_string()),
        },
        // 未知工具：直接把提示词作为唯一位置参数，best-effort。
        _ => RunSpec { program: prog, args: vec![prompt.into()], stdin: None },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_spec_claude_with_model() {
        let s = build_run_spec("claude", "/usr/bin/claude", "hi", Some("opus"));
        assert_eq!(s.args, vec!["-p", "hi", "--model", "opus"]);
        assert!(s.stdin.is_none());
    }

    #[test]
    fn build_spec_opencode_default_model() {
        let s = build_run_spec("opencode", "opencode", "hi", Some("  "));
        // 空白模型视为默认，不应追加 -m
        assert_eq!(s.args, vec!["run", "hi"]);
    }

    #[test]
    fn build_spec_kimi_uses_stdin() {
        let s = build_run_spec("kimi", "kimi", "hi", None);
        assert_eq!(s.stdin.as_deref(), Some("hi"));
        assert!(s.args.contains(&"--yolo".to_string()));
    }
}

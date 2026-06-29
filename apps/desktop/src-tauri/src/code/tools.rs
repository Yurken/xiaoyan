//! 小妍代码助手的本地工具集。
//!
//! 所有文件路径都被限制在工作目录内，禁止访问目录之外的文件。
//! 每次工具调用与结果都会通过前端事件展示给用户。

use serde_json::json;
use std::path::{Component, Path, PathBuf};

use crate::llm::{ToolCall, ToolDefinition};

const MAX_READ_SIZE: usize = 200 * 1024;
const MAX_TOOL_OUTPUT_CHARS: usize = 20_000;
const DEFAULT_COMMAND_TIMEOUT_SECS: u64 = 30;

/// 所有可用工具的 schema 定义。
pub fn code_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "read_file".into(),
            description: "读取工作目录内指定文件的文本内容。用于查看代码、配置文件、日志等。"
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "file_path": { "type": "string", "description": "相对于工作目录的文件路径" }
                },
                "required": ["file_path"]
            }),
        },
        ToolDefinition {
            name: "list_dir".into(),
            description: "列出工作目录内指定目录的文件和子目录。用于探索项目结构。".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "相对于工作目录的目录路径，默认为当前工作目录" }
                },
                "required": []
            }),
        },
        ToolDefinition {
            name: "search_files".into(),
            description: "在工作目录下搜索匹配关键词的文件内容，返回匹配行及其文件路径。".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "pattern": { "type": "string", "description": "搜索关键词或正则表达式" },
                    "path": { "type": "string", "description": "相对于工作目录的搜索根目录，默认为工作目录" }
                },
                "required": ["pattern"]
            }),
        },
        ToolDefinition {
            name: "write_file".into(),
            description: "在工作目录内创建或覆盖文件。用于生成新文件或完整重写文件。".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "file_path": { "type": "string", "description": "相对于工作目录的文件路径" },
                    "content": { "type": "string", "description": "要写入的文件内容" }
                },
                "required": ["file_path", "content"]
            }),
        },
        ToolDefinition {
            name: "edit_file".into(),
            description:
                "在工作目录内修改文件：将 old_string 替换为 new_string。用于局部代码修改。".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "file_path": { "type": "string", "description": "相对于工作目录的文件路径" },
                    "old_string": { "type": "string", "description": "文件中需要被替换的旧文本" },
                    "new_string": { "type": "string", "description": "用于替换的新文本" }
                },
                "required": ["file_path", "old_string", "new_string"]
            }),
        },
        ToolDefinition {
            name: "run_command".into(),
            description: "在工作目录下执行 shell 命令。用于运行测试、构建、脚本等。".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "要执行的 shell 命令" },
                    "timeout": { "type": "integer", "description": "超时时间（秒），默认 30 秒" }
                },
                "required": ["command"]
            }),
        },
    ]
}

/// 根据模式返回对应的工具集定义。
/// - build/general: 全部工具
/// - plan: 全部工具（system prompt 会要求确认写操作）
/// - explore/scout: 仅只读工具
pub fn code_tool_definitions_for_mode(mode: &str) -> Vec<ToolDefinition> {
    match mode {
        "explore" | "scout" => vec![
            ToolDefinition {
                name: "read_file".into(),
                description: "读取工作目录内指定文件的文本内容。用于查看代码、配置文件、日志等。".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "file_path": { "type": "string", "description": "相对于工作目录的文件路径" }
                    },
                    "required": ["file_path"]
                }),
            },
            ToolDefinition {
                name: "list_dir".into(),
                description: "列出工作目录内指定目录的文件和子目录。用于探索项目结构。".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "相对于工作目录的目录路径，默认为当前工作目录" }
                    },
                    "required": []
                }),
            },
            ToolDefinition {
                name: "search_files".into(),
                description: "在工作目录下搜索匹配关键词的文件内容，返回匹配行及其文件路径。".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "pattern": { "type": "string", "description": "搜索关键词或正则表达式" },
                        "path": { "type": "string", "description": "相对于工作目录的搜索根目录，默认为工作目录" }
                    },
                    "required": ["pattern"]
                }),
            },
        ],
        _ => code_tool_definitions(),
    }
}

/// 判断某个工具是否具有写入或命令副作用。
#[allow(dead_code)]
pub fn requires_permission(name: &str) -> bool {
    matches!(name, "write_file" | "edit_file" | "run_command")
}

/// 将用户输入的路径解析为工作目录内的绝对路径。
/// 拒绝绝对路径、`..` 以及越界路径；空路径等价于当前工作目录。
pub fn resolve_working_path(input: &str, working_dir: &str) -> Result<PathBuf, String> {
    let working_dir = working_dir.trim();
    if working_dir.is_empty() {
        return Err("当前未选择工作目录。".into());
    }

    let input = input.trim();
    let input = if input.is_empty() { "." } else { input };
    let input_path = Path::new(input);
    if input_path.is_absolute() {
        return Err(format!("请使用相对路径：{input}"));
    }
    if input_path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(format!("路径不能包含 ..：{input}"));
    }

    let base = Path::new(working_dir);
    let base_normalized = normalize_path(base);
    let normalized = normalize_path(&base_normalized.join(input_path));

    if !normalized.starts_with(&base_normalized) {
        return Err(format!("路径越界：{input}"));
    }
    Ok(normalized)
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => result.push(prefix.as_os_str()),
            Component::RootDir => result.push(component.as_os_str()),
            Component::CurDir => {}
            Component::Normal(name) => result.push(name),
            Component::ParentDir => {
                result.pop();
            }
        }
    }
    result
}

/// 执行单个工具调用，返回给 LLM 的结果字符串。
pub async fn dispatch_tool(
    name: &str,
    arguments: &str,
    working_dir: Option<&str>,
) -> Result<String, String> {
    let args: serde_json::Value =
        serde_json::from_str(arguments).map_err(|e| format!("参数 JSON 解析失败：{e}"))?;

    let wd = working_dir.unwrap_or("");

    match name {
        "read_file" => read_file(args, wd).await,
        "list_dir" => list_dir(args, wd).await,
        "search_files" => search_files(args, wd).await,
        "write_file" => write_file(args, wd).await,
        "edit_file" => edit_file(args, wd).await,
        "run_command" => run_command(args, wd).await,
        _ => Err(format!("未知工具：{name}")),
    }
}

fn get_string_arg(args: &serde_json::Value, key: &str) -> Result<String, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("缺少参数：{key}"))
}

async fn read_file(args: serde_json::Value, wd: &str) -> Result<String, String> {
    let rel_path = get_string_arg(&args, "file_path")?;
    let path = resolve_working_path(&rel_path, wd)?;

    if !path.exists() {
        return Err(format!("文件不存在：{rel_path}"));
    }
    if !path.is_file() {
        return Err(format!("路径不是文件：{rel_path}"));
    }

    let meta = tokio::fs::metadata(&path)
        .await
        .map_err(|e| format!("读取文件元信息失败：{e}"))?;
    if meta.len() as usize > MAX_READ_SIZE {
        return Err(format!(
            "文件过大（{} > {} bytes），无法读取",
            meta.len(),
            MAX_READ_SIZE
        ));
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("读取文件失败：{e}"))?;
    Ok(content)
}

async fn list_dir(args: serde_json::Value, wd: &str) -> Result<String, String> {
    let rel_path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
    let path = resolve_working_path(rel_path, wd)?;

    if !path.exists() {
        return Err(format!("目录不存在：{rel_path}"));
    }
    if !path.is_dir() {
        return Err(format!("路径不是目录：{rel_path}"));
    }

    let mut entries = tokio::fs::read_dir(&path)
        .await
        .map_err(|e| format!("读取目录失败：{e}"))?;

    let mut lines = Vec::new();
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("读取目录项失败：{e}"))?
    {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let kind = if entry.file_type().await.map_err(|e| e.to_string())?.is_dir() {
            "dir"
        } else {
            "file"
        };
        lines.push(format!("{kind}: {name}"));
    }
    lines.sort();
    Ok(lines.join("\n"))
}

async fn search_files(args: serde_json::Value, wd: &str) -> Result<String, String> {
    let pattern = get_string_arg(&args, "pattern")?;
    let rel_path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
    let path = resolve_working_path(rel_path, wd)?;

    if !path.exists() {
        return Err(format!("搜索目录不存在：{rel_path}"));
    }

    let output = match tokio::process::Command::new("rg")
        .arg("-n")
        .arg("-I")
        .arg("--hidden")
        .arg("--glob")
        .arg("!.git")
        .arg("--")
        .arg(&pattern)
        .arg(&path)
        .output()
        .await
    {
        Ok(output) => output,
        Err(_) => tokio::process::Command::new("grep")
            .arg("-R")
            .arg("-n")
            .arg("-I")
            .arg("--exclude-dir=.git")
            .arg("--")
            .arg(&pattern)
            .arg(&path)
            .output()
            .await
            .map_err(|e| format!("搜索命令失败：{e}"))?,
    };

    let text = String::from_utf8_lossy(&output.stdout).to_string();
    if text.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if !output.status.success() && !stderr.is_empty() {
            return Err(format!("搜索失败：{stderr}"));
        }
        return Ok("未找到匹配内容。".into());
    }
    // 限制返回行数，避免结果过长撑爆上下文。
    let lines: Vec<&str> = text.lines().take(100).collect();
    let result = lines.join("\n");
    if text.lines().count() > 100 {
        Ok(format!("{result}\n...（仅展示前 100 条匹配）"))
    } else {
        Ok(result)
    }
}

async fn write_file(args: serde_json::Value, wd: &str) -> Result<String, String> {
    let rel_path = get_string_arg(&args, "file_path")?;
    let content = get_string_arg(&args, "content")?;
    let path = resolve_working_path(&rel_path, wd)?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("创建目录失败：{e}"))?;
    }
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("写入文件失败：{e}"))?;
    Ok(format!("已写入文件：{rel_path}"))
}

async fn edit_file(args: serde_json::Value, wd: &str) -> Result<String, String> {
    let rel_path = get_string_arg(&args, "file_path")?;
    let old_string = get_string_arg(&args, "old_string")?;
    let new_string = get_string_arg(&args, "new_string")?;
    let path = resolve_working_path(&rel_path, wd)?;

    if !path.exists() {
        return Err(format!("文件不存在：{rel_path}"));
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("读取文件失败：{e}"))?;

    if !content.contains(&old_string) {
        return Err(format!("文件中未找到待替换文本：{rel_path}"));
    }

    let new_content = content.replacen(&old_string, &new_string, 1);
    tokio::fs::write(&path, new_content)
        .await
        .map_err(|e| format!("写入文件失败：{e}"))?;
    Ok(format!("已编辑文件：{rel_path}"))
}

async fn run_command(args: serde_json::Value, wd: &str) -> Result<String, String> {
    let command = get_string_arg(&args, "command")?;
    let timeout_secs = args
        .get("timeout")
        .and_then(|v| v.as_u64())
        .unwrap_or(DEFAULT_COMMAND_TIMEOUT_SECS)
        .clamp(1, 120);

    // 简单拦截明显危险命令。
    let lower = command.trim().to_ascii_lowercase();
    if lower.starts_with("rm -rf /")
        || lower.starts_with("rm -rf /*")
        || lower.contains(":(){ :|:& };:")
    {
        return Err("检测到危险命令，已拒绝执行。".into());
    }

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        tokio::process::Command::new("sh")
            .arg("-c")
            .arg(&command)
            .current_dir(wd)
            .output(),
    )
    .await
    .map_err(|_| format!("命令执行超时（{} 秒）", timeout_secs))?
    .map_err(|e| format!("命令执行失败：{e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut result = String::new();
    if !stdout.is_empty() {
        result.push_str(&format!("stdout:\n{stdout}"));
    }
    if !stderr.is_empty() {
        if !result.is_empty() {
            result.push('\n');
        }
        result.push_str(&format!("stderr:\n{stderr}"));
    }
    if result.is_empty() {
        result = "（命令无输出）".into();
    }

    let exit_code = output.status.code().unwrap_or(-1);
    Ok(truncate_tool_output(&format!(
        "{result}\nexit_code: {exit_code}"
    )))
}

fn truncate_tool_output(output: &str) -> String {
    if output.chars().count() <= MAX_TOOL_OUTPUT_CHARS {
        return output.to_string();
    }
    let prefix: String = output.chars().take(MAX_TOOL_OUTPUT_CHARS).collect();
    format!("{prefix}\n...（输出过长，仅展示前 {MAX_TOOL_OUTPUT_CHARS} 个字符）")
}

/// 将 `crate::llm::ToolCall` 转换为前端可序列化的结构。
pub fn to_code_tool_call(tc: &ToolCall) -> super::CodeToolCall {
    super::CodeToolCall {
        id: tc.id.clone(),
        name: tc.name.clone(),
        arguments: tc.arguments.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_working_path_keeps_absolute_base() {
        let resolved = resolve_working_path(".", "/Users/sen/hit/AiChildDrawingBoard").unwrap();
        assert_eq!(
            resolved,
            PathBuf::from("/Users/sen/hit/AiChildDrawingBoard")
        );
    }

    #[test]
    fn resolve_working_path_treats_empty_input_as_workspace_root() {
        let resolved = resolve_working_path("", "/Users/sen/hit/AiChildDrawingBoard").unwrap();
        assert_eq!(
            resolved,
            PathBuf::from("/Users/sen/hit/AiChildDrawingBoard")
        );
    }

    #[test]
    fn resolve_working_path_rejects_escape_paths() {
        assert!(resolve_working_path("../outside", "/Users/sen/hit/project").is_err());
        assert!(resolve_working_path("/tmp/outside", "/Users/sen/hit/project").is_err());
    }
}

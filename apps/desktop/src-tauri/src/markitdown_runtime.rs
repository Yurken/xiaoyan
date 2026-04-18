use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::{AppHandle, Manager};

const RUNTIME_DIR_NAME: &str = "markitdown-runtime";
const SYSTEM_PYTHON_CANDIDATES: &[&str] = &["python", "py"];

#[derive(Debug, serde::Deserialize)]
struct MarkItDownRuntimeMetadata {
    #[serde(rename = "pythonExecutable")]
    python_executable: String,
}

pub fn extract_pdf_text(app: &AppHandle, path: &Path) -> Result<String, String> {
    let path_str = path
        .to_str()
        .ok_or_else(|| format!("Unable to read file path: {}", path.display()))?;

    let mut errors = Vec::new();

    if let Some(runtime_dir) = resolve_bundled_runtime_dir(app) {
        match run_bundled_markitdown(&runtime_dir, path_str) {
            Ok(text) => return Ok(text),
            Err(error) => errors.push(format!("bundled runtime unavailable: {error}")),
        }
    } else {
        errors.push("bundled markitdown-runtime not found".to_string());
    }

    for command in system_python_candidates() {
        match run_system_markitdown(command, path_str) {
            Ok(text) => return Ok(text),
            Err(error) => errors.push(format!("{command}: {error}")),
        }
    }

    Err(format!(
        "PDF extraction failed. {}. Make sure the app bundles markitdown-runtime or the machine has `markitdown[pdf]` installed.",
        errors.join("; ")
    ))
}

fn system_python_candidates() -> &'static [&'static str] {
    if cfg!(target_os = "windows") {
        SYSTEM_PYTHON_CANDIDATES
    } else {
        &["python3", "python"]
    }
}

fn resolve_bundled_runtime_dir(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(RUNTIME_DIR_NAME));
    }

    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(RUNTIME_DIR_NAME));

    if let Ok(current_exe) = env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.join(RUNTIME_DIR_NAME));
            candidates.push(exe_dir.join("resources").join(RUNTIME_DIR_NAME));
        }
    }

    candidates
        .into_iter()
        .find(|candidate| read_runtime_metadata(candidate).is_ok())
}

fn run_bundled_markitdown(runtime_dir: &Path, path_str: &str) -> Result<String, String> {
    let metadata = read_runtime_metadata(runtime_dir)?;
    let python = runtime_dir.join(&metadata.python_executable);
    if !python.exists() {
        return Err(format!("bundled Python not found in {}", python.display()));
    }

    let output = Command::new(&python)
        .args(["-m", "markitdown", path_str])
        .current_dir(runtime_dir)
        .env("PYTHONHOME", runtime_dir)
        .env("PYTHONNOUSERSITE", "1")
        .env("PYTHONUTF8", "1")
        .output()
        .map_err(|error| format!("failed to start bundled Python: {error}"))?;

    parse_markitdown_output(output.stdout, output.stderr, output.status.success())
}

fn run_system_markitdown(command: &str, path_str: &str) -> Result<String, String> {
    let output = Command::new(command)
        .args(["-m", "markitdown", path_str])
        .output()
        .map_err(|error| format!("failed to start: {error}"))?;

    parse_markitdown_output(output.stdout, output.stderr, output.status.success())
}

fn parse_markitdown_output(
    stdout: Vec<u8>,
    stderr: Vec<u8>,
    success: bool,
) -> Result<String, String> {
    if !success {
        let stderr = String::from_utf8_lossy(&stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "MarkItDown failed".to_string()
        } else {
            format!("MarkItDown failed: {stderr}")
        });
    }

    let text = String::from_utf8(stdout)
        .map_err(|error| format!("MarkItDown output is not valid UTF-8: {error}"))?;
    let normalized = text.replace("\r\n", "\n").trim().to_string();
    if normalized.is_empty() {
        let stderr = String::from_utf8_lossy(&stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "MarkItDown produced no usable text".to_string()
        } else {
            format!("MarkItDown produced no usable text: {stderr}")
        });
    }

    Ok(normalized)
}

fn read_runtime_metadata(runtime_dir: &Path) -> Result<MarkItDownRuntimeMetadata, String> {
    let metadata_path = runtime_dir.join("_runtime.json");
    let contents = fs::read_to_string(&metadata_path)
        .map_err(|error| format!("failed to read runtime metadata: {error}"))?;
    serde_json::from_str::<MarkItDownRuntimeMetadata>(&contents)
        .map_err(|error| format!("failed to parse runtime metadata: {error}"))
}

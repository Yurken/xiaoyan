use std::{
    collections::HashMap,
    fs,
    path::{Component, Path, PathBuf},
    process::{Command, Output},
    sync::{Arc, Mutex, OnceLock, Weak},
};

use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

use super::compile_workspace::{create_compile_work_dir, prune_draft_compile_dirs};
use super::{managed_writing_assets_root, safe_project_image_path};
use crate::commands::writing_support::{executable_candidates, latex_compiler_missing_message};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WritingCompileRequest {
    #[serde(default)]
    pub draft_id: String,
    pub project_name: String,
    pub main_tex: String,
    pub bibtex: String,
    #[serde(default)]
    pub tex_files: Vec<WritingTexFile>,
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

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WritingTexFile {
    pub path: String,
    pub content: String,
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

fn compile_project<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    request: WritingCompileRequest,
) -> Result<WritingCompileResult, String> {
    let draft_key = draft_key_for(&request);
    let lock = draft_compile_lock(&draft_key);
    let _guard = lock
        .lock()
        .map_err(|_| "编译任务锁已损坏，请稍后重试。".to_string())?;

    let work_dir = create_compile_work_dir(app, &draft_key)?;
    write_project_files(app, &work_dir, &request)?;

    let mut log = String::new();

    let (engine, success) = if let Some(latexmk) = find_executable("latexmk") {
        let mut command = Command::new(&latexmk);
        configure_tex_environment(&mut command, &latexmk);
        let output = command
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

    let result = WritingCompileResult {
        success: compile_success,
        pdf_path: compile_success.then(|| pdf_path.to_string_lossy().to_string()),
        work_dir: work_dir.to_string_lossy().to_string(),
        engine,
        log: trim_log(log),
    };

    if let Err(error) = super::compile_workspace::record_compile_outcome(&work_dir, compile_success)
    {
        eprintln!("记录编译结果失败（draft={draft_key}）：{error}");
    }
    if let Err(error) = prune_draft_compile_dirs(app, &draft_key, &work_dir) {
        eprintln!("清理历史编译目录失败（draft={draft_key}）：{error}");
    }

    Ok(result)
}

fn draft_key_for(request: &WritingCompileRequest) -> String {
    let trimmed = request.draft_id.trim();
    if trimmed.is_empty() {
        request.project_name.trim().to_string()
    } else {
        trimmed.to_string()
    }
}

fn draft_compile_lock(draft_key: &str) -> Arc<Mutex<()>> {
    static LOCKS: OnceLock<Mutex<HashMap<String, Weak<Mutex<()>>>>> = OnceLock::new();
    let mut locks = LOCKS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .expect("写作编译任务锁注册表已损坏");
    locks.retain(|_, weak| weak.strong_count() > 0);
    if let Some(lock) = locks.get(draft_key).and_then(|weak| weak.upgrade()) {
        return lock;
    }
    let lock = Arc::new(Mutex::new(()));
    locks.insert(draft_key.to_string(), Arc::downgrade(&lock));
    lock
}

fn write_project_files<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
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
    write_tex_files(work_dir, &request.tex_files)?;
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

fn write_tex_files(work_dir: &Path, tex_files: &[WritingTexFile]) -> Result<(), String> {
    for tex_file in tex_files {
        let relative_path = safe_project_tex_path(&tex_file.path)?;
        let destination = work_dir.join(relative_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建章节目录：{e}"))?;
        }
        fs::write(&destination, &tex_file.content)
            .map_err(|e| format!("写入章节文件失败（{}）：{e}", tex_file.path))?;
    }
    Ok(())
}

fn copy_image_assets<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
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
        let mut command = Command::new(xelatex);
        configure_tex_environment(&mut command, xelatex);
        let output = command
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
    let mut command = Command::new(&bibtex);
    configure_tex_environment(&mut command, &bibtex);
    let output = command
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

fn configure_tex_environment(command: &mut Command, executable: &str) {
    let Some(executable_dir) = Path::new(executable)
        .parent()
        .filter(|path| path.is_absolute())
    else {
        return;
    };

    let mut paths = vec![executable_dir.to_path_buf()];
    if let Some(current_path) = std::env::var_os("PATH") {
        paths.extend(std::env::split_paths(&current_path));
    }

    if let Ok(path) = std::env::join_paths(paths) {
        command.env("PATH", path);
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

fn safe_project_tex_path(project_path: &str) -> Result<PathBuf, String> {
    let normalized = project_path.trim().replace('\\', "/");
    if normalized.is_empty() || normalized.eq_ignore_ascii_case("main.tex") {
        return Err("章节文件路径不合法。".to_string());
    }

    let path = Path::new(&normalized);
    if path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("章节文件路径必须是项目内的相对路径。".to_string());
    }
    if path
        .components()
        .any(|component| matches!(component, Component::CurDir))
    {
        return Err("章节文件路径不合法。".to_string());
    }
    let is_tex = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("tex"))
        .unwrap_or(false);
    if !is_tex || path.file_name().is_none() {
        return Err("章节文件必须使用 .tex 扩展名。".to_string());
    }

    Ok(path.to_path_buf())
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

#[cfg(test)]
mod tests {
    use super::{draft_key_for, safe_project_tex_path, WritingCompileRequest};

    fn compile_request(draft_id: &str, project_name: &str) -> WritingCompileRequest {
        WritingCompileRequest {
            draft_id: draft_id.to_string(),
            project_name: project_name.to_string(),
            main_tex: String::new(),
            bibtex: String::new(),
            tex_files: Vec::new(),
            notes: String::new(),
            image_assets: Vec::new(),
        }
    }

    #[test]
    fn draft_key_prefers_draft_id_and_falls_back_to_project_name() {
        assert_eq!(
            draft_key_for(&compile_request("draft-1", "My Paper")),
            "draft-1"
        );
        assert_eq!(draft_key_for(&compile_request("", "My Paper")), "My Paper");
        assert_eq!(
            draft_key_for(&compile_request("   ", "My Paper")),
            "My Paper"
        );
    }

    #[test]
    fn accepts_relative_tex_file_paths() {
        assert_eq!(
            safe_project_tex_path("sections/introduction.tex")
                .unwrap()
                .to_string_lossy(),
            "sections/introduction.tex"
        );
    }

    #[test]
    fn rejects_unsafe_or_root_tex_file_paths() {
        assert!(safe_project_tex_path("../outside.tex").is_err());
        assert!(safe_project_tex_path("/tmp/outside.tex").is_err());
        assert!(safe_project_tex_path("main.tex").is_err());
        assert!(safe_project_tex_path("sections/introduction.md").is_err());
    }
}

#[cfg(test)]
mod real_compile_tests {
    use std::{ffi::OsString, fs, path::PathBuf};

    use tauri::Manager as _;
    use uuid::Uuid;

    use super::{
        compile_project, find_executable, WritingCompileRequest, WritingImageAsset, WritingTexFile,
    };
    use crate::commands::writing::managed_writing_assets_root;

    struct TemporaryHome {
        path: PathBuf,
        previous: Option<OsString>,
    }

    impl TemporaryHome {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("xiaoyan-writing-{}", Uuid::new_v4()));
            fs::create_dir_all(&path).unwrap();
            let previous = std::env::var_os("HOME");
            std::env::set_var("HOME", &path);
            Self { path, previous }
        }
    }

    impl Drop for TemporaryHome {
        fn drop(&mut self) {
            if let Some(previous) = &self.previous {
                std::env::set_var("HOME", previous);
            } else {
                std::env::remove_var("HOME");
            }
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn request(version: &str, image: &WritingImageAsset) -> WritingCompileRequest {
        WritingCompileRequest {
            draft_id: "real-compile-test".to_string(),
            project_name: "real-compile-test".to_string(),
            main_tex: MAIN_SOURCE.replace("__VERSION__", version),
            bibtex: BIB_SOURCE.to_string(),
            tex_files: vec![WritingTexFile {
                path: "sections/method.tex".to_string(),
                content: METHOD_SOURCE.to_string(),
            }],
            notes: String::new(),
            image_assets: vec![image.clone()],
        }
    }

    #[test]
    #[ignore = "requires a local XeLaTeX installation"]
    fn compiles_real_chinese_project_and_bounds_work_dirs() {
        if find_executable("latexmk").is_none() && find_executable("xelatex").is_none() {
            eprintln!("跳过真实 LaTeX 验收：未安装 latexmk / xelatex");
            return;
        }
        let home = TemporaryHome::new();
        let app = tauri::test::mock_app();
        let handle = app.handle();
        let data_dir = handle.path().app_data_dir().unwrap();
        assert!(
            data_dir.starts_with(&home.path),
            "测试数据目录未隔离：{data_dir:?}"
        );
        let image_path = managed_writing_assets_root(&handle)
            .unwrap()
            .join("real-compile-test")
            .join("figures")
            .join("pixel.png");
        fs::create_dir_all(image_path.parent().unwrap()).unwrap();
        let mut png = std::io::Cursor::new(Vec::new());
        image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            1,
            1,
            image::Rgba([0, 122, 255, 255]),
        ))
        .write_to(&mut png, image::ImageFormat::Png)
        .unwrap();
        fs::write(&image_path, png.into_inner()).unwrap();
        let image = WritingImageAsset {
            id: "pixel".to_string(),
            file_name: "pixel.png".to_string(),
            project_path: "figures/pixel.png".to_string(),
            stored_path: image_path.to_string_lossy().to_string(),
            created_at: String::new(),
        };

        let first = compile_project(&handle, request("第一版", &image)).unwrap();
        assert!(first.success, "第一版编译失败：{}", first.log);
        let first_pdf = PathBuf::from(first.pdf_path.unwrap());
        assert!(fs::read(&first_pdf).unwrap().starts_with(b"%PDF-"));
        let second = compile_project(&handle, request("第二版", &image)).unwrap();
        assert!(second.success, "第二版编译失败：{}", second.log);
        let second_pdf = PathBuf::from(second.pdf_path.unwrap());
        let third = compile_project(&handle, request("第三版", &image)).unwrap();
        assert!(third.success, "第三版编译失败：{}", third.log);
        let third_pdf = PathBuf::from(third.pdf_path.unwrap());
        let failure = compile_project(&handle, request("\\notarealcommand", &image)).unwrap();
        assert!(!failure.success);

        let draft_root = data_dir.join("writing_compiles").join("real-compile-test");
        let work_dirs: Vec<PathBuf> = fs::read_dir(&draft_root)
            .unwrap()
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect();
        let success_count = work_dirs
            .iter()
            .filter(|path| path.join("main.pdf").is_file())
            .count();
        assert_eq!(success_count, 2);
        assert_eq!(work_dirs.len(), 3);
        assert!(!first_pdf.exists());
        assert!(second_pdf.exists());
        assert!(third_pdf.exists());
        assert!(PathBuf::from(failure.work_dir).exists());
    }

    const MAIN_SOURCE: &str = r##"% !TeX program = xelatex
\documentclass[UTF8,a4paper,11pt]{ctexart}
\usepackage{amsmath}
\usepackage{graphicx}
\usepackage[numbers]{natbib}
\title{可视化实时预览验收 __VERSION__}
\author{小妍}
\begin{document}
\maketitle
\section{引言}
中文正文与行内公式 $E=mc^2$，参考文献\cite{attention2017}。
\input{sections/method}
\bibliographystyle{plainnat}
\bibliography{references}
\end{document}
"##;

    const METHOD_SOURCE: &str = r##"\section{方法}
多章节正文。
\begin{equation}
\frac{\partial L}{\partial \theta} = \nabla_{\theta} L
\label{eq:gradient}
\end{equation}
\begin{figure}[htbp]
\centering
\includegraphics[width=0.08\textwidth]{figures/pixel.png}
\caption{编译测试图片}
\end{figure}
"##;

    const BIB_SOURCE: &str = r##"@inproceedings{attention2017,
  title={Attention Is All You Need},
  author={Vaswani, Ashish and others},
  booktitle={NeurIPS},
  year={2017}
}
"##;
}

#[cfg(target_os = "linux")]
use std::{
    fs,
    path::{Path, PathBuf},
};

const MACTEX_INSTALLER_URL: &str = "https://mirror.ctan.org/systems/mac/mactex/MacTeX.pkg";
const MACTEX_DOWNLOAD_PAGE_URL: &str = "https://tug.org/mactex/mactex-download.html";
#[cfg(not(target_os = "macos"))]
const TEXLIVE_QUICK_INSTALL_URL: &str = "https://tug.org/texlive/quickinstall.html";

pub fn mactex_installer_url() -> Option<&'static str> {
    #[cfg(target_os = "macos")]
    {
        Some(MACTEX_INSTALLER_URL)
    }

    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

pub fn latex_install_guide_url() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        MACTEX_DOWNLOAD_PAGE_URL
    }

    #[cfg(not(target_os = "macos"))]
    {
        TEXLIVE_QUICK_INSTALL_URL
    }
}

pub fn latex_compiler_missing_message() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "未找到 LaTeX 编译器。\n\n请安装 MacTeX / TeX Live，并确保 latexmk 或 xelatex 可用。\nmacOS 常见路径：/Library/TeX/texbin\n\n可在小妍中一键下载 MacTeX 安装器。\n"
    }

    #[cfg(target_os = "linux")]
    {
        "未找到 LaTeX 编译器。\n\n请安装 TeX Live，并确保 latexmk 或 xelatex 可用。\nLinux 常见路径：/usr/local/texlive/YYYY/bin/*-linux、~/.TinyTeX/bin/*-linux 或 /usr/bin\n\n安装完成后请把对应 bin 目录加入 PATH，再回到小妍重新编译。\n"
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "linux")))]
    {
        "未找到 LaTeX 编译器。\n\n请安装 TeX Live，并确保 latexmk 或 xelatex 可用。\n安装完成后请重新打开小妍再编译。\n"
    }
}

pub fn executable_candidates(name: &str) -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        return vec![format!("{name}.exe"), name.to_string()];
    }

    #[cfg(target_os = "macos")]
    {
        return dedupe_candidates(vec![
            name.to_string(),
            format!("/Library/TeX/texbin/{name}"),
            format!("/usr/texbin/{name}"),
            format!("/opt/homebrew/bin/{name}"),
            format!("/usr/local/bin/{name}"),
        ]);
    }

    #[cfg(target_os = "linux")]
    {
        return linux_executable_candidates(name);
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos"), not(target_os = "linux")))]
    {
        dedupe_candidates(vec![name.to_string(), format!("/usr/local/bin/{name}")])
    }
}

fn dedupe_candidates(candidates: Vec<String>) -> Vec<String> {
    let mut deduped = Vec::new();
    for candidate in candidates {
        if !deduped.contains(&candidate) {
            deduped.push(candidate);
        }
    }
    deduped
}

#[cfg(target_os = "linux")]
fn linux_executable_candidates(name: &str) -> Vec<String> {
    let mut candidates = vec![
        name.to_string(),
        format!("/usr/bin/{name}"),
        format!("/usr/local/bin/{name}"),
    ];

    candidates.extend(scan_texlive_installations(Path::new("/usr/local/texlive"), name));

    if let Some(home) = std::env::var_os("HOME") {
        let tinytex_bin = PathBuf::from(home).join(".TinyTeX").join("bin");
        candidates.extend(scan_platform_bin_dir(&tinytex_bin, name));
    }

    dedupe_candidates(candidates)
}

#[cfg(target_os = "linux")]
fn scan_texlive_installations(root: &Path, name: &str) -> Vec<String> {
    let mut candidates = Vec::new();

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.filter_map(Result::ok) {
            let bin_root = entry.path().join("bin");
            candidates.extend(scan_platform_bin_dir(&bin_root, name));
        }
    }

    candidates.sort();
    candidates.reverse();
    candidates
}

#[cfg(target_os = "linux")]
fn scan_platform_bin_dir(root: &Path, name: &str) -> Vec<String> {
    let mut candidates = Vec::new();

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.filter_map(Result::ok) {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if !file_type.is_dir() {
                continue;
            }

            let platform_name = entry.file_name();
            let platform_name = platform_name.to_string_lossy();
            if !platform_name.ends_with("-linux") {
                continue;
            }

            let candidate_path = entry.path().join(name);
            if candidate_path.is_file() {
                candidates.push(candidate_path.to_string_lossy().to_string());
            }
        }
    }

    candidates.sort();
    candidates.reverse();
    candidates
}

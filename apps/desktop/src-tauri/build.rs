#[derive(Debug, serde::Deserialize)]
struct RuntimeMetadata {
    #[serde(rename = "pythonExecutable")]
    python_executable: String,
    #[serde(rename = "sitePackages")]
    site_packages: String,
}

fn main() {
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=icons");
    println!("cargo:rerun-if-changed=markitdown-runtime");
    println!("cargo:rerun-if-changed=scripts/prepare-markitdown-runtime.py");
    assert_runtime_ready_for_release();
    tauri_build::build()
}

fn assert_runtime_ready_for_release() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let profile = std::env::var("PROFILE").unwrap_or_default();
    if (target_os != "windows" && target_os != "macos") || profile != "release" {
        return;
    }

    let manifest_dir = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is not set"),
    );
    let runtime_dir = manifest_dir.join("markitdown-runtime");
    let runtime_metadata_path = runtime_dir.join("_runtime.json");
    let metadata_contents = std::fs::read_to_string(&runtime_metadata_path).unwrap_or_else(|error| {
        panic!(
            "failed to read markitdown runtime metadata at {}: {error}",
            runtime_metadata_path.display()
        )
    });
    let metadata: RuntimeMetadata = serde_json::from_str(&metadata_contents).unwrap_or_else(|error| {
        panic!(
            "failed to parse markitdown runtime metadata at {}: {error}",
            runtime_metadata_path.display()
        )
    });

    if metadata.python_executable.trim().is_empty() || metadata.site_packages.trim().is_empty() {
        panic!(
            "markitdown runtime metadata at {} must include non-empty pythonExecutable and sitePackages",
            runtime_metadata_path.display()
        );
    }

    let required_paths = [
        runtime_dir.join(&metadata.python_executable),
        runtime_metadata_path,
        runtime_dir.join(&metadata.site_packages).join("markitdown"),
    ];

    let missing: Vec<String> = required_paths
        .iter()
        .filter(|path| !path.exists())
        .map(|path| path.display().to_string())
        .collect();

    if !missing.is_empty() {
        panic!(
            "{} release build requires a prepared markitdown-runtime. Missing: {}. Run `pnpm build:tauri` or `python src-tauri/scripts/prepare-markitdown-runtime.py` first.",
            target_os,
            missing.join(", ")
        );
    }
}

use super::collect_row_assets;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const ASSET_TABLES: [&str; 3] = ["papers", "paper_figures", "experiment_attachments"];

struct Fixture {
    root: PathBuf,
    app_data_dir: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "xiaoyan-backup-export-assets-test-{}",
            Uuid::new_v4()
        ));
        // Only this uniquely created subtree is touched or removed by the tests.
        fs::create_dir(&root).expect("create unique fixture directory");
        let app_data_dir = root.join("app-data");
        let fixture = Self { root, app_data_dir };
        fs::create_dir(&fixture.app_data_dir).expect("create fixture app-data directory");
        fixture
    }

    fn write(&self, relative_path: &str, bytes: &[u8]) -> PathBuf {
        let path = self.root.join(relative_path);
        fs::create_dir_all(path.parent().expect("fixture file parent"))
            .expect("create fixture file parent");
        fs::write(&path, bytes).expect("write synthetic fixture bytes");
        path
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn path_string(path: &Path) -> &str {
    path.to_str().expect("synthetic fixture path is UTF-8")
}

fn row(id: &str, source: &Path) -> Value {
    json!({ "id": id, "file_path": path_string(source) })
}

fn captured_asset<'a>(assets: &'a Map<String, Value>, source: &Path) -> &'a Value {
    assets
        .get(path_string(source))
        .expect("asset remains keyed by the original source path")
}

fn assert_asset(
    assets: &Map<String, Value>,
    source: &Path,
    relative_path: &str,
    expected_bytes: &[u8],
) {
    let asset = captured_asset(assets, source);
    assert_eq!(asset["relative_path"], relative_path);
    let encoded = asset["data"].as_str().expect("base64 data string");
    assert_eq!(
        B64.decode(encoded).expect("valid standard base64"),
        expected_bytes
    );
}

fn assert_read_failure(
    table: &str,
    id: &str,
    source: &Path,
    app_data_dir: &Path,
    assets: &mut Map<String, Value>,
) {
    // Obtain the platform's own reason instead of hard-coding an OS error number
    // or relying on chmod, which does not simulate denial when tests run as root.
    let reason = fs::read(source)
        .expect_err("fixture source must be unreadable as a file")
        .to_string();
    let error = collect_row_assets(table, &row(id, source), app_data_dir, assets)
        .expect_err("a referenced unreadable file must cancel export");
    assert!(error.contains(table), "missing table context: {error}");
    assert!(error.contains(id), "missing row identity: {error}");
    assert!(
        error.contains(path_string(source)),
        "missing source path: {error}"
    );
    assert!(error.contains(&reason), "missing I/O cause: {error}");
    assert!(
        !assets.contains_key(path_string(source)),
        "a failed read must not insert a placeholder asset"
    );
}

#[test]
fn all_supported_tables_capture_exact_bytes_and_app_data_relative_paths() {
    let fixture = Fixture::new();
    let bytes = [0_u8, 1, 10, 13, 127, 128, 254, 255];
    for table in ASSET_TABLES {
        let relative_path = format!("{table}/row-1/asset.bin");
        let source = fixture.write(&format!("app-data/{relative_path}"), &bytes);
        let mut assets = Map::new();

        collect_row_assets(
            table,
            &row("row-1", &source),
            &fixture.app_data_dir,
            &mut assets,
        )
        .expect("readable referenced file must be included");

        assert_eq!(assets.len(), 1, "{table}");
        assert_asset(&assets, &source, &relative_path, &bytes);
    }
}

#[test]
fn app_data_relative_paths_preserve_existing_unicode_and_spaces() {
    let fixture = Fixture::new();
    let source = fixture.write("app-data/figures/图 1.png", b"synthetic image");
    let mut assets = Map::new();

    collect_row_assets(
        "paper_figures",
        &row("figure-1", &source),
        &fixture.app_data_dir,
        &mut assets,
    )
    .expect("readable internal asset");

    assert_asset(&assets, &source, "figures/图 1.png", b"synthetic image");
}

#[test]
fn external_assets_keep_the_compatible_sanitized_restore_path() {
    let fixture = Fixture::new();
    let source = fixture.write("external/figure 图+A-_.bin", b"external bytes");
    let mut assets = Map::new();

    collect_row_assets(
        "papers",
        &row("row A/图-_.7", &source),
        &fixture.app_data_dir,
        &mut assets,
    )
    .expect("readable external asset");

    assert_asset(
        &assets,
        &source,
        "restored_assets/papers_row_A__-_.7/figure___A-_.bin",
        b"external bytes",
    );
}

#[test]
fn readable_empty_files_are_captured_instead_of_treated_as_missing() {
    let fixture = Fixture::new();
    let source = fixture.write("app-data/attachments/empty.txt", b"");
    let mut assets = Map::new();

    collect_row_assets(
        "experiment_attachments",
        &row("empty-1", &source),
        &fixture.app_data_dir,
        &mut assets,
    )
    .expect("an empty file is still a readable asset");

    assert_eq!(assets.len(), 1);
    assert_asset(&assets, &source, "attachments/empty.txt", b"");
    assert_eq!(captured_asset(&assets, &source)["data"], "");
}

#[test]
fn absent_null_empty_and_whitespace_paths_are_skipped_for_all_supported_tables() {
    let fixture = Fixture::new();
    let mut assets = Map::new();
    let rows = [
        json!({ "id": "missing-field" }),
        json!({ "id": "null-path", "file_path": null }),
        json!({ "id": "empty-path", "file_path": "" }),
        json!({ "id": "blank-path", "file_path": " \t\r\n" }),
    ];

    for table in ASSET_TABLES {
        for value in &rows {
            collect_row_assets(table, value, &fixture.app_data_dir, &mut assets)
                .expect("a row without a file reference must remain exportable");
        }
    }

    assert!(assets.is_empty());
}

#[test]
fn unsupported_tables_do_not_attempt_to_read_their_file_path() {
    let fixture = Fixture::new();
    let missing = fixture.root.join("not-created.bin");
    let mut assets = Map::new();

    for table in ["writing_drafts", "paper_versions", "unrelated_assets"] {
        collect_row_assets(
            table,
            &row("unsupported-1", &missing),
            &fixture.app_data_dir,
            &mut assets,
        )
        .expect("this change must not expand the existing asset table whitelist");
    }

    assert!(assets.is_empty());
}

#[test]
fn missing_referenced_files_fail_with_context_for_all_supported_tables() {
    let fixture = Fixture::new();
    let missing = fixture.root.join("missing-file.bin");

    for table in ASSET_TABLES {
        let mut assets = Map::new();
        assert_read_failure(
            table,
            "missing-row-7",
            &missing,
            &fixture.app_data_dir,
            &mut assets,
        );
        assert!(assets.is_empty(), "{table}");
    }
}

#[test]
fn directory_references_fail_with_context_instead_of_becoming_empty_assets() {
    let fixture = Fixture::new();
    let directory = fixture.root.join("directory-not-file");
    fs::create_dir(&directory).expect("create synthetic directory");

    for table in ASSET_TABLES {
        let mut assets = Map::new();
        assert_read_failure(
            table,
            "directory-row-8",
            &directory,
            &fixture.app_data_dir,
            &mut assets,
        );
        assert!(assets.is_empty(), "{table}");
    }
}

#[test]
fn repeated_source_paths_reuse_captured_bytes_after_change_and_deletion() {
    let fixture = Fixture::new();
    let source = fixture.write("external/shared.bin", b"first captured bytes");
    let mut assets = Map::new();
    collect_row_assets(
        "papers",
        &row("first-owner", &source),
        &fixture.app_data_dir,
        &mut assets,
    )
    .expect("initial capture");
    let captured = assets.clone();

    fs::write(&source, b"later changed bytes").expect("change only the synthetic fixture");
    collect_row_assets(
        "paper_figures",
        &row("second-owner", &source),
        &fixture.app_data_dir,
        &mut assets,
    )
    .expect("already captured path must not be read again");
    assert_eq!(assets, captured);

    fs::remove_file(&source).expect("remove only the synthetic fixture file");
    collect_row_assets(
        "experiment_attachments",
        &row("third-owner", &source),
        &fixture.app_data_dir,
        &mut assets,
    )
    .expect("deduplicated bytes remain usable even after source deletion");

    assert_eq!(assets, captured);
    assert_eq!(assets.len(), 1);
    assert_asset(
        &assets,
        &source,
        "restored_assets/papers_first-owner/shared.bin",
        b"first captured bytes",
    );
}

#[test]
fn a_failed_read_preserves_prior_assets_and_can_be_retried_after_repair() {
    let fixture = Fixture::new();
    let good = fixture.write("app-data/papers/good.pdf", b"good PDF fixture");
    let missing = fixture.root.join("app-data/papers/repaired.pdf");
    let mut assets = Map::new();
    collect_row_assets(
        "papers",
        &row("good-row", &good),
        &fixture.app_data_dir,
        &mut assets,
    )
    .expect("capture good file");
    let before_failure = assets.clone();

    assert_read_failure(
        "papers",
        "repair-row",
        &missing,
        &fixture.app_data_dir,
        &mut assets,
    );
    assert_eq!(assets, before_failure);

    fs::write(&missing, b"repaired fixture bytes").expect("repair synthetic missing file");
    collect_row_assets(
        "papers",
        &row("repair-row", &missing),
        &fixture.app_data_dir,
        &mut assets,
    )
    .expect("failed capture must not poison a retry");

    assert_eq!(assets.len(), 2);
    assert_eq!(
        captured_asset(&assets, &good),
        captured_asset(&before_failure, &good)
    );
    assert_asset(
        &assets,
        &missing,
        "papers/repaired.pdf",
        b"repaired fixture bytes",
    );
}

#[test]
fn snapshot_collection_preserves_table_order_for_shared_external_asset_paths() {
    let fixture = Fixture::new();
    let source = fixture.write("external/shared.bin", b"shared synthetic bytes");
    // serde_json::Map sorts these names; the collector must use backup order.
    let tables = json!({
        "experiment_attachments": [row("attachment-1", &source)],
        "papers": [row("paper-1", &source)],
        "settings": [{"key": "synthetic", "value": "unchanged"}],
    });
    let original = tables.clone();

    let assets = super::collect_snapshot_assets(
        &["papers", "settings", "experiment_attachments"],
        tables.as_object().expect("synthetic snapshot"),
        &fixture.app_data_dir,
    )
    .expect("collect snapshot references");

    assert_eq!(assets.len(), 1);
    assert_asset(
        &assets,
        &source,
        "restored_assets/papers_paper-1/shared.bin",
        b"shared synthetic bytes",
    );
    assert_eq!(tables, original, "file collection must not rewrite table rows");
}

#[test]
fn snapshot_collection_rejects_missing_or_non_array_tables() {
    let fixture = Fixture::new();
    for tables in [
        json!({ "papers": [] }),
        json!({ "papers": [], "paper_figures": null }),
        json!({ "papers": [], "paper_figures": {} }),
    ] {
        let error = super::collect_snapshot_assets(
            &["papers", "paper_figures"],
            tables.as_object().expect("synthetic snapshot"),
            &fixture.app_data_dir,
        )
        .expect_err("an incomplete snapshot must not produce a backup");

        assert!(error.contains("paper_figures"), "{error}");
    }
}

#[test]
fn snapshot_collection_fails_if_a_later_referenced_file_disappears_and_can_retry() {
    let fixture = Fixture::new();
    let paper = fixture.write("app-data/papers/one.pdf", b"synthetic PDF");
    let figure = fixture.write("app-data/figures/one.png", b"synthetic figure");
    let tables = json!({
        "papers": [row("paper-1", &paper)],
        "paper_figures": [row("figure-1", &figure)],
    });
    // The rows are already captured. Deleting a referenced file afterwards must
    // fail the file phase instead of returning only the successfully read PDF.
    fs::remove_file(&figure).expect("remove only the synthetic fixture file");
    let error = super::collect_snapshot_assets(
        &["papers", "paper_figures"],
        tables.as_object().expect("synthetic snapshot"),
        &fixture.app_data_dir,
    )
    .expect_err("a disappeared file must reject the whole asset collection");
    assert!(error.contains("paper_figures/figure-1"), "{error}");
    assert!(error.contains(path_string(&figure)), "{error}");

    fs::write(&figure, b"repaired synthetic figure").expect("repair fixture file");
    let assets = super::collect_snapshot_assets(
        &["papers", "paper_figures"],
        tables.as_object().expect("synthetic snapshot"),
        &fixture.app_data_dir,
    )
    .expect("retry after the referenced file is repaired");
    assert_eq!(assets.len(), 2);
    assert_asset(&assets, &paper, "papers/one.pdf", b"synthetic PDF");
    assert_asset(
        &assets,
        &figure,
        "figures/one.png",
        b"repaired synthetic figure",
    );
}

#[test]
fn empty_snapshot_tables_produce_no_assets() {
    let fixture = Fixture::new();
    let tables = json!({ "papers": [], "paper_figures": [], "experiment_attachments": [] });
    let assets = super::collect_snapshot_assets(
        &ASSET_TABLES,
        tables.as_object().expect("synthetic snapshot"),
        &fixture.app_data_dir,
    )
    .expect("empty tables remain valid backup content");
    assert!(assets.is_empty());
}

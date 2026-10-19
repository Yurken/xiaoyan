use super::*;
use serde_json::json;
use std::cell::Cell;
use std::fs;
use std::future::ready;
use uuid::Uuid;

struct Fixture {
    root: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("xiaoyan-sync-assets-test-{}", Uuid::new_v4()));
        fs::create_dir(&root).expect("create unique synthetic fixture directory");
        Self { root }
    }

    fn directory(&self, relative: &str) -> PathBuf {
        let path = self.root.join(relative);
        fs::create_dir_all(&path).expect("create synthetic fixture subdirectory");
        path
    }

    fn write(&self, relative: &str, bytes: &[u8]) -> PathBuf {
        let path = self.root.join(relative);
        fs::create_dir_all(path.parent().expect("fixture parent")).expect("create fixture parent");
        fs::write(&path, bytes).expect("write synthetic fixture bytes");
        path
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        // Every path used by these tests stays inside this newly created subtree.
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn path_string(path: &Path) -> String {
    path.to_str().expect("synthetic path is UTF-8").to_string()
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn entries(directory: &Path) -> Vec<String> {
    let mut names = fs::read_dir(directory)
        .expect("read only the synthetic fixture directory")
        .map(|entry| {
            entry.expect("synthetic directory entry")
                .file_name().into_string().expect("fixture file name is UTF-8")
        })
        .collect::<Vec<_>>();
    names.sort();
    names
}

fn one_asset(table: &str, path: &str) -> BTreeMap<String, Vec<Value>> {
    BTreeMap::from([(
        table.to_string(),
        vec![json!({ "id": "synthetic-row", "file_path": path })],
    )])
}

#[test]
fn streaming_hash_matches_known_vectors_and_reads_across_the_buffer_boundary() {
    let fixture = Fixture::new();
    let empty = fixture.write("empty.bin", b"");
    let abc = fixture.write("abc.bin", b"abc");
    assert_eq!(
        hash_file(&empty).expect("hash empty file"),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    assert_eq!(
        hash_file(&abc).expect("hash known input"),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    for length in [64 * 1024, 64 * 1024 + 37] {
        let bytes: Vec<u8> = (0..length).map(|index| (index % 251) as u8).collect();
        let path = fixture.write(&format!("boundary-{length}.bin"), &bytes);
        // Independent one-shot hashing catches truncation or stale-buffer tails.
        assert_eq!(hash_file(&path).expect("stream all bytes"), digest(&bytes));
    }
}

#[test]
fn hashing_missing_files_and_directories_returns_errors() {
    let fixture = Fixture::new();
    assert!(hash_file(&fixture.root.join("not-created.bin")).is_err());
    assert!(hash_file(&fixture.directory("directory-not-file")).is_err());
}

#[test]
fn snapshot_assets_cover_three_tables_and_deduplicate_paths_and_identical_bytes() {
    let fixture = Fixture::new();
    let first = fixture.write("first.pdf", b"same synthetic content");
    let duplicate = fixture.write("duplicate.pdf", b"same synthetic content");
    let hash = digest(b"same synthetic content");
    let unrelated_path = path_string(&fixture.root.join("unsupported-table-not-read.bin"));
    let mut tables = BTreeMap::from([
        ("papers".to_string(), vec![
            json!({ "id": "p1", "file_path": path_string(&first) }),
            json!({ "id": "no-file", "file_path": "" }),
            json!({ "id": "null-file", "file_path": null }),
            json!({ "id": "no-field" }),
        ]),
        ("paper_figures".to_string(), vec![
            json!({ "id": "f1", "file_path": path_string(&duplicate) }),
        ]),
        ("experiment_attachments".to_string(), vec![
            json!({ "id": "a1", "file_path": path_string(&first) }),
        ]),
        ("unrelated_table".to_string(), vec![
            json!({ "id": "ignored", "file_path": unrelated_path }),
        ]),
    ]);

    let (extensions, sources) =
        prepare_snapshot_assets(&mut tables).expect("prepare readable synthetic assets");

    assert_eq!(extensions, BTreeMap::from([(hash.clone(), ".pdf".to_string())]));
    assert_eq!(sources.len(), 1);
    let source = sources.get(&hash).expect("one source per content hash");
    assert!(source == &path_string(&first) || source == &path_string(&duplicate));
    for table in ["papers", "paper_figures", "experiment_attachments"] {
        assert_eq!(tables[table][0]["file_path"], format!("asset://{hash}"));
    }
    assert_eq!(tables["papers"][1]["file_path"], "");
    assert!(tables["papers"][2]["file_path"].is_null());
    assert!(tables["papers"][3].get("file_path").is_none());
    assert_eq!(tables["unrelated_table"][0]["file_path"], unrelated_path);
}

#[test]
fn snapshot_preparation_rejects_missing_sources_and_unresolved_asset_references() {
    let fixture = Fixture::new();
    let missing = path_string(&fixture.root.join("missing.pdf"));
    let unresolved = format!("asset://{}", digest(b"unresolved synthetic asset"));
    for table in ["papers", "paper_figures", "experiment_attachments"] {
        for path in [&missing, &unresolved] {
            let mut tables = one_asset(table, path);
            prepare_snapshot_assets(&mut tables)
                .expect_err("a local reference must resolve before publishing a snapshot");
        }
    }
}

#[tokio::test]
async fn missing_upload_source_fails_before_upload_is_called() {
    let fixture = Fixture::new();
    let hash = digest(b"missing source");
    let sources = HashMap::from([(
        hash,
        path_string(&fixture.root.join("not-created.bin")),
    )]);
    let calls = Cell::new(0);
    upload_assets_with(&sources, &HashSet::new(), |_, _| {
        calls.set(calls.get() + 1);
        ready(Ok(()))
    })
    .await
    .expect_err("missing referenced upload source is not a successful skip");
    assert_eq!(calls.get(), 0);
}

#[tokio::test]
async fn source_changed_after_snapshot_fails_before_upload_is_called() {
    let fixture = Fixture::new();
    let source = fixture.write("changing.pdf", b"captured bytes");
    let mut tables = one_asset("papers", &path_string(&source));
    let (_, sources) = prepare_snapshot_assets(&mut tables).expect("capture original hash");
    fs::write(&source, b"changed after capture").expect("mutate only the synthetic source");
    let calls = Cell::new(0);

    upload_assets_with(&sources, &HashSet::new(), |_, _| {
        calls.set(calls.get() + 1);
        ready(Ok(()))
    })
    .await
    .expect_err("changed bytes must not be uploaded under the old content hash");
    assert_eq!(calls.get(), 0);
}

#[tokio::test]
async fn upload_deduplicates_prepared_sources_and_skips_already_existing_hashes() {
    let fixture = Fixture::new();
    let source = fixture.write("shared.pdf", b"upload fixture");
    let mut tables = BTreeMap::from([
        ("papers".to_string(), vec![json!({ "id": "p1", "file_path": path_string(&source) })]),
        ("paper_figures".to_string(), vec![json!({ "id": "f1", "file_path": path_string(&source) })]),
    ]);
    let (_, sources) = prepare_snapshot_assets(&mut tables).expect("prepare shared source");
    let expected_hash = digest(b"upload fixture");
    let mut uploads = Vec::new();
    let uploaded = upload_assets_with(&sources, &HashSet::new(), |hash, bytes| {
        uploads.push((hash, bytes));
        ready(Ok(()))
    })
    .await
    .expect("upload once for the shared hash");
    assert_eq!(uploaded, 1);
    assert_eq!(uploads, vec![(expected_hash.clone(), b"upload fixture".to_vec())]);

    fs::remove_file(&source).expect("remove synthetic source after it is on the server");
    let calls = Cell::new(0);
    let uploaded = upload_assets_with(
        &sources,
        &HashSet::from([expected_hash]),
        |_, _| {
            calls.set(calls.get() + 1);
            ready(Ok(()))
        },
    )
    .await
    .expect("existing remote content skips both upload and source re-read");
    assert_eq!(uploaded, 0);
    assert_eq!(calls.get(), 0);
}

#[tokio::test]
async fn upload_callback_failure_is_not_reported_as_success() {
    let fixture = Fixture::new();
    let source = fixture.write("upload.bin", b"fixture");
    let sources = HashMap::from([(digest(b"fixture"), path_string(&source))]);
    let calls = Cell::new(0);
    let error = upload_assets_with(&sources, &HashSet::new(), |_, _| {
        calls.set(calls.get() + 1);
        ready(Err("synthetic upload failure".to_string()))
    })
    .await
    .expect_err("upload failure must propagate");
    assert_eq!(calls.get(), 1);
    assert_eq!(error, "synthetic upload failure");
}

#[tokio::test]
async fn valid_cached_asset_is_verified_and_does_not_fetch_again() {
    let fixture = Fixture::new();
    let directory = fixture.directory("cache");
    let hash = digest(b"already cached");
    let local = directory.join(format!("{hash}.pdf"));
    fs::write(&local, b"already cached").expect("seed valid cached bytes");
    let calls = Cell::new(0);

    let (resolved, downloaded) = resolve_asset_with(&directory, &hash, ".pdf", |_| {
        calls.set(calls.get() + 1);
        ready(Err("cache hit must not fetch".to_string()))
    })
    .await
    .expect("valid content-addressed cache hit");

    assert_eq!(PathBuf::from(resolved), local);
    assert!(!downloaded);
    assert_eq!(calls.get(), 0);
    assert_eq!(fs::read(&local).unwrap(), b"already cached");
}

#[tokio::test]
async fn damaged_cache_is_repaired_with_verified_bytes_without_temporary_leftovers() {
    let fixture = Fixture::new();
    let directory = fixture.directory("cache");
    let bytes = b"verified replacement";
    let hash = digest(bytes);
    let file_name = format!("{hash}.pdf");
    let local = directory.join(&file_name);
    fs::write(&local, b"corrupt cache").expect("seed damaged synthetic cache");
    let mut requests = Vec::new();

    let (resolved, downloaded) = resolve_asset_with(&directory, &hash, ".pdf", |requested| {
        requests.push(requested);
        ready(Ok(Some(bytes.to_vec())))
    })
    .await
    .expect("repair a corrupt cache with validated fetched bytes");

    assert_eq!(requests, vec![hash]);
    assert_eq!(PathBuf::from(resolved), local);
    assert!(downloaded);
    assert_eq!(fs::read(&local).unwrap(), bytes);
    assert_eq!(entries(&directory), vec![file_name]);
}

#[tokio::test]
async fn new_assets_accept_empty_uppercase_and_unicode_extensions_and_empty_content() {
    let fixture = Fixture::new();
    let directory = fixture.directory("cache");
    let cases: &[(&[u8], &str)] = &[
        (b"", ""),
        (b"fresh synthetic asset", ".PDF"),
        (b"fresh synthetic asset", ".数据"),
    ];
    for &(bytes, extension) in cases {
        let hash = digest(bytes);
        let expected = directory.join(format!("{hash}{extension}"));
        let calls = Cell::new(0);
        let (resolved, downloaded) = resolve_asset_with(&directory, &hash, extension, |requested| {
            assert_eq!(requested, hash);
            calls.set(calls.get() + 1);
            ready(Ok(Some(bytes.to_vec())))
        })
        .await
        .expect("valid name and matching content must be installed");
        assert_eq!(PathBuf::from(resolved), expected);
        assert!(downloaded);
        assert_eq!(calls.get(), 1);
        assert_eq!(fs::read(&expected).unwrap(), bytes);
    }
    assert_eq!(entries(&directory).len(), cases.len());
}

#[tokio::test]
async fn missing_failed_or_mismatched_fetch_preserves_existing_cache_and_creates_no_partial_file() {
    let fixture = Fixture::new();
    let hash = digest(b"expected content");
    for outcome in ["missing", "fetch-error", "wrong-hash"] {
        for had_cache in [false, true] {
            let directory = fixture.directory(&format!("{outcome}-{had_cache}"));
            let file_name = format!("{hash}.bin");
            let local = directory.join(&file_name);
            if had_cache {
                fs::write(&local, b"existing damaged bytes").expect("seed synthetic old cache");
            }
            let response = match outcome {
                "missing" => Ok(None),
                "fetch-error" => Err("synthetic fetch failure".to_string()),
                _ => Ok(Some(b"wrong content".to_vec())),
            };
            let mut requests = Vec::new();
            let error = resolve_asset_with(&directory, &hash, ".bin", |requested| {
                requests.push(requested);
                ready(response)
            })
            .await
            .expect_err("an unavailable or unverified asset must not become a resolved path");

            assert_eq!(requests, vec![hash.clone()]);
            if outcome == "fetch-error" {
                assert_eq!(error, "synthetic fetch failure");
            }
            if had_cache {
                assert_eq!(fs::read(&local).unwrap(), b"existing damaged bytes");
                assert_eq!(entries(&directory), vec![file_name]);
            } else {
                assert!(!local.exists());
                assert!(entries(&directory).is_empty());
            }
        }
    }
}

#[tokio::test]
async fn rename_failure_keeps_the_existing_target_and_cleans_the_created_temporary_file() {
    let fixture = Fixture::new();
    let directory = fixture.directory("cache");
    let bytes = b"correct fetched content";
    let hash = digest(bytes);
    let file_name = format!("{hash}.pdf");
    let target_directory = directory.join(&file_name);
    fs::create_dir(&target_directory).expect("create deterministic rename obstruction");
    let sentinel = target_directory.join("sentinel");
    fs::write(&sentinel, b"preserve this").expect("seed obstruction sentinel");
    let calls = Cell::new(0);

    resolve_asset_with(&directory, &hash, ".pdf", |requested| {
        assert_eq!(requested, hash);
        calls.set(calls.get() + 1);
        ready(Ok(Some(bytes.to_vec())))
    })
    .await
    .expect_err("a verified download still fails if the target cannot be replaced");

    assert_eq!(calls.get(), 1);
    assert!(target_directory.is_dir());
    assert_eq!(fs::read(&sentinel).unwrap(), b"preserve this");
    assert_eq!(entries(&directory), vec![file_name], "temporary file must be cleaned");
}

#[tokio::test]
async fn unsafe_hashes_and_extensions_are_rejected_before_fetch_or_file_creation() {
    let fixture = Fixture::new();
    let directory = fixture.directory("cache");
    let sentinel = fixture.write("outside-cache-sentinel", b"untouched");
    let valid_hash = digest(b"synthetic valid hash");
    let invalid_hashes = [
        String::new(),
        "abc".to_string(),
        "A".repeat(64),
        format!("../{valid_hash}"),
        format!("{valid_hash}/child"),
        format!("{valid_hash}\\child"),
        format!("{valid_hash}00"),
        "g".repeat(64),
    ];
    let invalid_extensions = [
        "pdf", ".", "..", ".pdf.", ".pdf ", ".pdf/../../escape", ".pdf\\escape",
        ".bad:stream", ".bad?", ".bad*", ".bad\"", ".bad<", ".bad>", ".bad|",
        ".bad\0", ".bad\n", ".bad\u{007f}",
    ];
    let calls = Cell::new(0);

    for hash in &invalid_hashes {
        resolve_asset_with(&directory, hash, ".pdf", |_| {
            calls.set(calls.get() + 1);
            ready(Ok(Some(b"must not fetch".to_vec())))
        })
        .await
        .expect_err("invalid hash must be rejected before fetch");
    }
    for extension in invalid_extensions {
        resolve_asset_with(&directory, &valid_hash, extension, |_| {
            calls.set(calls.get() + 1);
            ready(Ok(Some(b"must not fetch".to_vec())))
        })
        .await
        .expect_err("unsafe extension must be rejected before fetch");
    }

    assert_eq!(calls.get(), 0);
    assert!(entries(&directory).is_empty());
    assert_eq!(fs::read(&sentinel).unwrap(), b"untouched");
}

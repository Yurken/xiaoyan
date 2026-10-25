use std::{
    fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

use tauri::Manager;
use uuid::Uuid;

use super::sanitize_project_name;

const COMPILES_DIR_NAME: &str = "writing_compiles";
const RETAINED_SUCCESS_LIMIT: usize = 2;
const RETAINED_FAILURE_LIMIT: usize = 1;
const COMPILE_OUTCOME_FILE: &str = ".xiaoyan-compile-result";

pub(super) fn record_compile_outcome(work_dir: &Path, success: bool) -> Result<(), String> {
    let outcome = if success { "success" } else { "failure" };
    fs::write(work_dir.join(COMPILE_OUTCOME_FILE), outcome)
        .map_err(|e| format!("无法记录编译结果：{e}"))
}

fn managed_compiles_root<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let root = data_dir.join(COMPILES_DIR_NAME);
    fs::create_dir_all(&root).map_err(|e| format!("无法创建编译目录：{e}"))?;
    Ok(root)
}

pub(super) fn create_compile_work_dir<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    draft_id: &str,
) -> Result<PathBuf, String> {
    let draft_root = managed_compiles_root(app)?.join(sanitize_project_name(draft_id));
    fs::create_dir_all(&draft_root).map_err(|e| format!("无法创建项目编译目录：{e}"))?;
    let work_dir = draft_root.join(Uuid::new_v4().to_string());
    fs::create_dir_all(&work_dir).map_err(|e| format!("无法创建编译工作目录：{e}"))?;
    Ok(work_dir)
}

pub(super) fn prune_draft_compile_dirs<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    draft_id: &str,
    current_work_dir: &Path,
) -> Result<(), String> {
    let draft_root = managed_compiles_root(app)?.join(sanitize_project_name(draft_id));
    prune_draft_root(&draft_root, current_work_dir).map(|_| ())
}

#[derive(Debug)]
struct WorkDirCandidate {
    path: PathBuf,
    success: bool,
    modified: SystemTime,
}

fn prune_draft_root(draft_root: &Path, current_work_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let canonical_root = draft_root
        .canonicalize()
        .map_err(|e| format!("无法校验编译目录：{e}"))?;
    let canonical_current = current_work_dir
        .canonicalize()
        .map_err(|e| format!("无法校验当前编译目录：{e}"))?;

    let mut candidates = Vec::new();
    let entries = fs::read_dir(&canonical_root).map_err(|e| format!("无法读取编译目录：{e}"))?;
    for entry in entries.filter_map(Result::ok) {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        // 不跟随符号链接，符号链接目录永远不进入清理名单。
        if !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        // 只清理本模块创建的工作目录（目录名为 UUID）。
        if Uuid::parse_str(name).is_err() {
            continue;
        }
        let Ok(path) = entry.path().canonicalize() else {
            continue;
        };
        if !is_removable_work_dir(&canonical_root, &path, &canonical_current) {
            continue;
        }
        let success = work_dir_succeeded(&path);
        let modified = fs::metadata(&path)
            .and_then(|metadata| metadata.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        candidates.push(WorkDirCandidate {
            path,
            success,
            modified,
        });
    }

    Ok(remove_expired_candidates(candidates))
}

fn is_removable_work_dir(root: &Path, path: &Path, current: &Path) -> bool {
    path != current && path.parent() == Some(root)
}

fn work_dir_succeeded(path: &Path) -> bool {
    let pdf_exists = path.join("main.pdf").is_file();
    match fs::read_to_string(path.join(COMPILE_OUTCOME_FILE)) {
        Ok(outcome) => outcome.trim() == "success" && pdf_exists,
        Err(_) => pdf_exists,
    }
}

fn sort_candidates(candidates: &mut [WorkDirCandidate]) {
    candidates.sort_by(|left, right| {
        right
            .modified
            .cmp(&left.modified)
            .then_with(|| right.path.cmp(&left.path))
    });
}

/// 纯选择逻辑：按时间倒序保留最近成功/失败配额内的目录，返回（保留, 待清理）。
fn split_candidates(
    mut candidates: Vec<WorkDirCandidate>,
) -> (Vec<WorkDirCandidate>, Vec<WorkDirCandidate>) {
    sort_candidates(&mut candidates);

    let mut kept_success = 0usize;
    let mut kept_failure = 0usize;
    let mut retained = Vec::new();
    let mut removable = Vec::new();
    for candidate in candidates {
        let keep = if candidate.success {
            kept_success < RETAINED_SUCCESS_LIMIT
        } else {
            kept_failure < RETAINED_FAILURE_LIMIT
        };
        if keep {
            if candidate.success {
                kept_success += 1;
            } else {
                kept_failure += 1;
            }
            retained.push(candidate);
        } else {
            removable.push(candidate);
        }
    }
    (retained, removable)
}

fn remove_expired_candidates(candidates: Vec<WorkDirCandidate>) -> Vec<PathBuf> {
    let (_, removable) = split_candidates(candidates);
    let mut removed = Vec::new();
    for candidate in removable {
        // 删除失败仅记录日志，保留待下一轮清理，不影响编译结果。
        if let Err(error) = fs::remove_dir_all(&candidate.path) {
            eprintln!(
                "清理编译工作目录失败（{}）：{error}",
                candidate.path.display()
            );
            continue;
        }
        removed.push(candidate.path);
    }
    removed
}

#[cfg(test)]
mod tests {
    use super::{
        is_removable_work_dir, prune_draft_root, split_candidates, WorkDirCandidate,
        RETAINED_FAILURE_LIMIT, RETAINED_SUCCESS_LIMIT,
    };
    use std::{
        fs,
        path::{Path, PathBuf},
        time::{Duration, SystemTime},
    };
    use uuid::Uuid;

    fn temp_draft_root(tag: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("xiaoyan-prune-test-{tag}-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn make_work_dir(root: &Path, with_pdf: bool) -> PathBuf {
        let dir = root.join(Uuid::new_v4().to_string());
        fs::create_dir_all(&dir).unwrap();
        if with_pdf {
            fs::write(dir.join("main.pdf"), b"%PDF").unwrap();
        }
        dir
    }

    fn remaining_uuid_dirs(root: &Path) -> Vec<PathBuf> {
        fs::read_dir(root)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_type()
                    .map(|file_type| file_type.is_dir())
                    .unwrap_or(false)
            })
            .filter(|entry| Uuid::parse_str(entry.file_name().to_str().unwrap_or("")).is_ok())
            .map(|entry| entry.path())
            .collect()
    }

    fn candidate(path: &str, success: bool, age_secs: u64) -> WorkDirCandidate {
        WorkDirCandidate {
            path: PathBuf::from(path),
            success,
            modified: SystemTime::UNIX_EPOCH + Duration::from_secs(age_secs),
        }
    }

    #[test]
    fn retains_two_successes_and_one_failure_besides_current() {
        let candidates = vec![
            candidate("a", true, 500),
            candidate("b", true, 400),
            candidate("c", true, 300),
            candidate("d", false, 200),
            candidate("e", false, 100),
        ];

        let (retained, removable) = split_candidates(candidates);
        let removable = removable
            .iter()
            .map(|candidate| candidate.path.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert_eq!(removable, vec!["c".to_string(), "e".to_string()]);
        assert_eq!(
            retained.len(),
            RETAINED_SUCCESS_LIMIT + RETAINED_FAILURE_LIMIT
        );
    }

    #[test]
    fn keeps_everything_when_within_limits() {
        let candidates = vec![candidate("a", true, 300), candidate("b", false, 200)];

        let (retained, removable) = split_candidates(candidates);

        assert_eq!(retained.len(), 2);
        assert!(removable.is_empty());
    }

    #[test]
    fn never_removes_more_than_retention_limits() {
        // 5 个成功 + 5 个失败，按时间倒序交错排列。
        let candidates: Vec<WorkDirCandidate> = (0..10)
            .map(|index| candidate(&format!("dir-{index}"), index % 2 == 0, index))
            .collect();

        let (retained, removable) = split_candidates(candidates);

        // 保留最近 2 成功 + 1 失败，其余 7 个进入待清理名单。
        assert_eq!(removable.len(), 7);
        assert_eq!(
            retained.len(),
            RETAINED_SUCCESS_LIMIT + RETAINED_FAILURE_LIMIT
        );
    }

    #[test]
    fn drops_oldest_candidates_beyond_quota() {
        let candidates = vec![
            candidate("newest", true, 300),
            candidate("middle", true, 200),
            candidate("oldest", true, 100),
            candidate("only-failure", false, 50),
        ];

        let (retained, removable) = split_candidates(candidates);

        assert_eq!(removable.len(), 1);
        assert_eq!(removable[0].path, PathBuf::from("oldest"));
        assert!(retained
            .iter()
            .any(|candidate| candidate.path == PathBuf::from("newest")));
        assert!(retained
            .iter()
            .any(|candidate| candidate.path == PathBuf::from("only-failure")));
    }

    #[test]
    fn prune_only_removes_uuid_work_dirs_inside_root() {
        let root = temp_draft_root("scoped");
        let current = make_work_dir(&root, false);
        for _ in 0..3 {
            make_work_dir(&root, true);
        }
        for _ in 0..2 {
            make_work_dir(&root, false);
        }
        let legacy = root.join("manual-backup");
        fs::create_dir_all(&legacy).unwrap();
        #[cfg(unix)]
        let outside = temp_draft_root("outside");
        #[cfg(unix)]
        let link = root.join(Uuid::new_v4().to_string());
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, &link).unwrap();

        let removed = prune_draft_root(&root, &current).unwrap();

        // 3 个旧成功目录删 1 留 2，2 个旧失败目录删 1 留 1。
        assert_eq!(removed.len(), 2);
        for path in &removed {
            assert!(!path.exists());
        }
        let remaining = remaining_uuid_dirs(&root);
        let success_remaining = remaining
            .iter()
            .filter(|path| path.join("main.pdf").exists())
            .count();
        let failure_remaining = remaining
            .iter()
            .filter(|path| !path.join("main.pdf").exists() && *path != &current)
            .count();
        assert_eq!(success_remaining, RETAINED_SUCCESS_LIMIT);
        assert_eq!(failure_remaining, RETAINED_FAILURE_LIMIT);
        assert!(current.exists());
        assert!(legacy.exists());
        #[cfg(unix)]
        {
            assert!(link.symlink_metadata().is_ok());
            assert!(outside.exists());
        }
    }

    #[test]
    fn current_work_dir_survives_even_beyond_success_quota() {
        let root = temp_draft_root("current");
        make_work_dir(&root, true);
        make_work_dir(&root, true);
        let current = make_work_dir(&root, true);

        let removed = prune_draft_root(&root, &current).unwrap();

        assert!(removed.is_empty());
        assert!(current.join("main.pdf").exists());
    }

    #[test]
    fn prune_aborts_when_current_dir_is_missing() {
        let root = temp_draft_root("abort");
        let old = make_work_dir(&root, true);
        let missing = root.join(Uuid::new_v4().to_string());

        assert!(prune_draft_root(&root, &missing).is_err());
        assert!(old.exists());
    }

    #[test]
    fn removable_check_rejects_current_and_paths_outside_root() {
        let root = Path::new("/managed/root");
        let current = root.join("current");
        let child = root.join("child");

        assert!(!is_removable_work_dir(root, &current, &current));
        assert!(!is_removable_work_dir(
            root,
            Path::new("/other/child"),
            &current
        ));
        assert!(is_removable_work_dir(root, &child, &current));
    }

    #[test]
    fn partial_pdf_from_failed_compile_is_not_a_success() {
        let root = temp_draft_root("outcome");
        let failed = make_work_dir(&root, true);
        super::record_compile_outcome(&failed, false).unwrap();
        assert!(!super::work_dir_succeeded(&failed));

        let succeeded = make_work_dir(&root, true);
        super::record_compile_outcome(&succeeded, true).unwrap();
        assert!(super::work_dir_succeeded(&succeeded));
        let _ = fs::remove_dir_all(root);
    }
}

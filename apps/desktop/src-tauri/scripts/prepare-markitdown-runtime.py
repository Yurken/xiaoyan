from __future__ import annotations

import importlib.metadata as metadata
import json
import os
import shutil
import subprocess
import sys
import sysconfig
from datetime import datetime
from pathlib import Path

from packaging.markers import default_environment
from packaging.requirements import Requirement

README_CONTENT = """# MarkItDown Runtime

This directory is reserved for the bundled MarkItDown runtime.

- The prepare script can build this runtime directly from a local MarkItDown
  checkout (preferred) or from the current Python environment.
- Runtime binaries and copied dependencies are intentionally ignored by Git.
"""


def normalize(name: str) -> str:
    return name.lower().replace("-", "_").replace(".", "_")


def should_ignore(relative_path: Path) -> bool:
    parts = {part.lower() for part in relative_path.parts}
    return (
        "__pycache__" in parts
        or relative_path.name.endswith((".pyc", ".pyo"))
        or relative_path.name == ".DS_Store"
    )


def copy_tree(source: Path, destination: Path, *, ignore_site_packages: bool) -> None:
    ignored_directories = {
        "__pycache__",
        "cmake",
        "conda-meta",
        "condabin",
        "docs",
        "doc",
        "envs",
        "include",
        "man",
        "pkgs",
        "sbin",
        "share",
        "shell",
        "tools",
    }

    def ignore(_: str, names: list[str]) -> set[str]:
        ignored: set[str] = set()
        lowered = {name.lower(): name for name in names}
        for directory in ignored_directories:
            if directory in lowered:
                ignored.add(lowered[directory])
        if ignore_site_packages:
            for directory in ["site-packages", "dist-packages"]:
                if directory in lowered:
                    ignored.add(lowered[directory])
        return ignored

    shutil.copytree(source, destination, dirs_exist_ok=True, ignore=ignore)


def distribution_names_for_pdf_extra() -> list[str]:
    env = default_environment()
    env["extra"] = "pdf"
    seen: set[str] = set()
    stack = ["markitdown"]

    while stack:
        requested = stack.pop()
        dist = metadata.distribution(requested)
        dist_name = dist.metadata["Name"]
        key = normalize(dist_name)
        if key in seen:
            continue
        seen.add(key)

        for requirement_text in dist.requires or []:
            requirement = Requirement(requirement_text)
            if requirement.marker and not requirement.marker.evaluate(env):
                continue
            stack.append(requirement.name)

    return sorted(seen)


def copy_installed_distributions(target_site_packages: Path) -> None:
    for dist_key in distribution_names_for_pdf_extra():
        dist = metadata.distribution(dist_key)
        for relative_path in dist.files or []:
            source = Path(dist.locate_file(relative_path))
            if not source.exists():
                continue
            if should_ignore(Path(relative_path)):
                continue
            destination = target_site_packages / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            if source.is_dir():
                shutil.copytree(source, destination, dirs_exist_ok=True)
            else:
                shutil.copy2(source, destination)


def resolve_python_home() -> Path:
    return Path(sys.base_prefix or sys.prefix).resolve()


def resolve_interpreter_site_packages() -> Path:
    return Path(sysconfig.get_paths()["purelib"]).resolve()


def resolve_runtime_dir() -> Path:
    script_dir = Path(__file__).resolve().parent
    runtime_dir = (script_dir / ".." / "markitdown-runtime").resolve()
    repo_root = (script_dir / "..").resolve()
    if repo_root not in runtime_dir.parents and runtime_dir != repo_root:
        raise RuntimeError(f"Runtime dir is outside expected repo scope: {runtime_dir}")
    return runtime_dir


def resolve_workspace_root() -> Path:
    script_dir = Path(__file__).resolve().parent
    desktop_dir = script_dir.parent.parent
    apps_dir = desktop_dir.parent
    return apps_dir.parent


def resolve_markitdown_source_dir() -> Path | None:
    workspace_root = resolve_workspace_root()
    candidates = [
        os.environ.get("MARKITDOWN_SOURCE_DIR"),
        os.environ.get("MARKITDOWN_REPO"),
        str((workspace_root.parent / "markitdown").resolve()),
        str((workspace_root / "markitdown").resolve()),
    ]

    for raw_candidate in candidates:
        if not raw_candidate:
            continue
        candidate = Path(raw_candidate).expanduser().resolve()
        package_dir = normalize_markitdown_package_dir(candidate)
        if package_dir is not None:
            return package_dir

    return None


def normalize_markitdown_package_dir(candidate: Path) -> Path | None:
    if not candidate.exists():
        return None
    if (candidate / "pyproject.toml").exists():
        return candidate
    nested_package_dir = candidate / "packages" / "markitdown"
    if (nested_package_dir / "pyproject.toml").exists():
        return nested_package_dir
    return None


def write_runtime_readme(runtime_dir: Path) -> None:
    runtime_dir.mkdir(parents=True, exist_ok=True)
    (runtime_dir / "README.md").write_text(README_CONTENT, encoding="utf-8")


def resolve_relative_executable(python_home: Path, runtime_dir: Path) -> str:
    executable = Path(sys.executable).resolve()
    try:
        return executable.relative_to(python_home).as_posix()
    except ValueError:
        bin_dir = "Scripts" if os.name == "nt" else "bin"
        copied_executable = runtime_dir / bin_dir / executable.name
        copied_executable.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(executable, copied_executable)
        return copied_executable.relative_to(runtime_dir).as_posix()


def target_site_packages_relative(python_home: Path) -> Path:
    purelib = resolve_interpreter_site_packages()
    try:
        return purelib.relative_to(python_home)
    except ValueError:
        if os.name == "nt":
            version = f"python{sys.version_info.major}{sys.version_info.minor}"
            return Path("Lib") / "site-packages"
        version = f"python{sys.version_info.major}.{sys.version_info.minor}"
        return Path("lib") / version / "site-packages"


def runtime_env(runtime_dir: Path) -> dict[str, str]:
    env = os.environ.copy()
    env["PYTHONHOME"] = str(runtime_dir)
    env["PYTHONNOUSERSITE"] = "1"
    env["PYTHONUTF8"] = "1"
    env["PIP_NO_CACHE_DIR"] = "1"
    env["PIP_DISABLE_PIP_VERSION_CHECK"] = "1"
    return env


def install_local_markitdown_source(
    runtime_dir: Path,
    runtime_python: Path,
    target_site_packages: Path,
    source_dir: Path,
) -> None:
    env = runtime_env(runtime_dir)
    subprocess.run(
        [str(runtime_python), "-m", "ensurepip", "--upgrade"],
        cwd=runtime_dir,
        env=env,
        check=True,
    )
    subprocess.run(
        [
            str(runtime_python),
            "-m",
            "pip",
            "install",
            "--upgrade",
            "--no-compile",
            "--target",
            str(target_site_packages),
            ".[pdf]",
        ],
        cwd=source_dir,
        env=env,
        check=True,
    )


def remove_path(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink(missing_ok=True)
    elif path.is_dir():
        shutil.rmtree(path, ignore_errors=True)


def prune_runtime_bin(runtime_dir: Path, python_executable_relative: str) -> None:
    python_path = Path(python_executable_relative)
    bin_dir = runtime_dir / python_path.parent
    keep = {python_path.name}
    if not bin_dir.is_dir():
        return

    for child in bin_dir.iterdir():
        if child.name in keep:
            continue
        remove_path(child)


def prune_runtime_stdlib(runtime_dir: Path, site_packages_relative: Path) -> None:
    stdlib_dir = runtime_dir / site_packages_relative.parent
    site_packages_dir = runtime_dir / site_packages_relative

    for relative_path in [
        Path("_conda"),
        Path("python.app"),
        Path("lib") / "cmake",
        Path("lib") / "pkgconfig",
    ]:
        remove_path(runtime_dir / relative_path)

    for name in [
        "__pycache__",
        "ensurepip",
        "idlelib",
        "pydoc_data",
        "test",
        "tkinter",
        "turtledemo",
        "venv",
    ]:
        remove_path(stdlib_dir / name)

    for archive in (runtime_dir / "lib").glob("*.a"):
        remove_path(archive)

    for dist_info in site_packages_dir.glob("pip-*.dist-info"):
        remove_path(dist_info)
    for relative_path in [
        Path("bin"),
        Path("pip"),
        Path("pip.py"),
        Path("setuptools"),
        Path("setuptools-*.dist-info"),
        Path("wheel"),
        Path("wheel-*.dist-info"),
    ]:
        if "*" in relative_path.name:
            for candidate in site_packages_dir.glob(relative_path.name):
                remove_path(candidate)
            continue
        remove_path(site_packages_dir / relative_path)

def main() -> None:
    python_home = resolve_python_home()
    runtime_dir = resolve_runtime_dir()

    if runtime_dir.exists():
        shutil.rmtree(runtime_dir)

    copy_tree(python_home, runtime_dir, ignore_site_packages=True)

    site_packages_relative = target_site_packages_relative(python_home)
    target_site_packages = runtime_dir / site_packages_relative
    target_site_packages.mkdir(parents=True, exist_ok=True)
    python_executable_relative = resolve_relative_executable(python_home, runtime_dir)
    runtime_python = runtime_dir / python_executable_relative
    source_dir = resolve_markitdown_source_dir()

    if source_dir is not None:
        install_local_markitdown_source(
            runtime_dir,
            runtime_python,
            target_site_packages,
            source_dir,
        )
    else:
        copy_installed_distributions(target_site_packages)

    prune_runtime_bin(runtime_dir, python_executable_relative)
    prune_runtime_stdlib(runtime_dir, site_packages_relative)

    metadata_path = runtime_dir / "_runtime.json"
    metadata_path.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now().isoformat(timespec="seconds"),
                "platform": sys.platform,
                "pythonExecutable": python_executable_relative,
                "sitePackages": site_packages_relative.as_posix(),
                "package": "markitdown[pdf]",
                "source": str(source_dir) if source_dir is not None else "installed-distribution",
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    write_runtime_readme(runtime_dir)

    if source_dir is not None:
        print(f"MarkItDown runtime generated from local source: {source_dir}")
    else:
        print(f"MarkItDown runtime generated from installed packages: {runtime_dir}")


if __name__ == "__main__":
    main()

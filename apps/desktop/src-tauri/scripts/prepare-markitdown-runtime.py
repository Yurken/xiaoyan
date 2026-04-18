from __future__ import annotations

import importlib.metadata as metadata
import json
import os
import shutil
import sys
import sysconfig
from datetime import datetime
from pathlib import Path

from packaging.markers import default_environment
from packaging.requirements import Requirement

README_CONTENT = """# MarkItDown Runtime

This directory is reserved for the bundled MarkItDown runtime.

- CI and fresh clones keep this placeholder so Tauri's resource path exists.
- The prepare script replaces the directory contents with a generated runtime and
  writes this README back afterwards.
- Runtime binaries and copied dependencies are intentionally ignored by Git.
"""


def normalize(name: str) -> str:
    return name.lower().replace("-", "_").replace(".", "_")


def should_ignore(relative_path: Path) -> bool:
    parts = {part.lower() for part in relative_path.parts}
    return "__pycache__" in parts or relative_path.name.endswith((".pyc", ".pyo"))


def copy_tree(source: Path, destination: Path, *, ignore_site_packages: bool) -> None:
    def ignore(_: str, names: list[str]) -> set[str]:
        ignored: set[str] = set()
        lowered = {name.lower(): name for name in names}
        for directory in ["__pycache__", "share", "tools", "doc"]:
            if directory in lowered:
                ignored.add(lowered[directory])
        if ignore_site_packages:
            for directory in ["site-packages", "dist-packages"]:
                if directory in lowered:
                    ignored.add(lowered[directory])
        return ignored

    shutil.copytree(source, destination, symlinks=True, dirs_exist_ok=True, ignore=ignore)


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
                shutil.copytree(source, destination, symlinks=True, dirs_exist_ok=True)
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


def main() -> None:
    python_home = resolve_python_home()
    runtime_dir = resolve_runtime_dir()

    if runtime_dir.exists():
        shutil.rmtree(runtime_dir)

    copy_tree(python_home, runtime_dir, ignore_site_packages=True)

    site_packages_relative = target_site_packages_relative(python_home)
    target_site_packages = runtime_dir / site_packages_relative
    target_site_packages.mkdir(parents=True, exist_ok=True)
    copy_installed_distributions(target_site_packages)

    metadata_path = runtime_dir / "_runtime.json"
    metadata_path.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now().isoformat(timespec="seconds"),
                "platform": sys.platform,
                "pythonExecutable": resolve_relative_executable(python_home, runtime_dir),
                "sitePackages": site_packages_relative.as_posix(),
                "package": "markitdown[pdf]",
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    write_runtime_readme(runtime_dir)

    print(f"MarkItDown runtime generated: {runtime_dir}")


if __name__ == "__main__":
    main()

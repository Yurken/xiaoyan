#!/usr/bin/env python3
"""
数据源爬虫统一入口
运行所有爬虫脚本，生成统一格式的数据文件
"""

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent


def run_script(script_name: str) -> bool:
    """运行单个爬虫脚本"""
    script_path = SCRIPTS_DIR / script_name
    
    if not script_path.exists():
        print(f"✗ 脚本不存在: {script_path}")
        return False
    
    print(f"\n{'='*60}")
    print(f"运行: {script_name}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=SCRIPTS_DIR,
            capture_output=False,
            text=True,
            check=True,
        )
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ 脚本执行失败: {e}")
        return False
    except Exception as e:
        print(f"✗ 错误: {e}")
        return False


def main():
    print("=" * 60)
    print("小言 - 刊会数据源爬虫")
    print("=" * 60)
    
    scripts = [
        "crawl_wos_master_list.py",    # SCI/SCIE/SSCI/AHCI/ESCI
        "crawl_pubmed_journals.py",     # PubMed/MEDLINE
        "crawl_doaj_journals.py",       # DOAJ 开放获取期刊
        "crawl_cssci_journals.py",      # CSSCI (需手动补充)
    ]
    
    results = {}
    for script in scripts:
        success = run_script(script)
        results[script] = success
    
    # 汇总
    print(f"\n{'='*60}")
    print("执行汇总")
    print(f"{'='*60}")
    
    for script, success in results.items():
        status = "✓ 成功" if success else "✗ 失败"
        print(f"  {status}: {script}")
    
    success_count = sum(results.values())
    print(f"\n总计: {success_count}/{len(scripts)} 个脚本成功")
    
    if success_count < len(scripts):
        print("\n提示: 部分脚本可能需要手动干预或补充数据")


if __name__ == "__main__":
    main()

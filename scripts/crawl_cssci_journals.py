#!/usr/bin/env python3
"""
CSSCI 来源期刊爬虫
从南京大学 CSSCI 官网获取期刊列表
"""

import json
import time
import random
import urllib.request
from pathlib import Path
from typing import List, Dict
import re

DATA_DIR = Path(__file__).parent.parent / "apps/desktop/src-tauri/src/data"
OUTPUT_FILE = DATA_DIR / "cssci_journals.json"

# CSSCI 官网
CSSCI_URL = "https://cssrac.nju.edu.cn/"


def fetch_cssci_journals() -> List[Dict]:
    """
    获取 CSSCI 期刊列表
    注意：CSSCI 官网可能需要手动下载，这里提供备用方案
    """
    print("CSSCI 数据获取...")
    print("  注意：CSSCI 官网数据通常需要手动下载或订阅")
    print("  这里生成示例数据结构，实际使用时请替换为真实数据")
    
    # 返回空列表，提示用户手动补充
    return []


def create_sample_data() -> List[Dict]:
    """创建示例数据结构，供用户参考"""
    samples = [
        {
            "title": "中国社会科学",
            "issn": "1002-4921",
            "publisher": "中国社会科学杂志社",
            "discipline": "综合性社科",
            "category": "马克思主义理论",
            "entity_type": "journal",
            "indexes": ["CSSCI"],
        },
        {
            "title": "经济研究",
            "issn": "0577-9154",
            "publisher": "中国社会科学院经济研究所",
            "discipline": "经济学",
            "category": "理论经济",
            "entity_type": "journal",
            "indexes": ["CSSCI"],
        },
    ]
    
    return samples


def save_json(journals: List[Dict], output_path: Path):
    """保存为 JSON"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(journals, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ 已保存到 {output_path}")
    print(f"  总计: {len(journals)} 条期刊记录")


def main():
    print("=" * 60)
    print("CSSCI 来源期刊爬虫")
    print("=" * 60)
    
    # 尝试获取
    journals = fetch_cssci_journals()
    
    if not journals:
        print("\n未获取到在线数据，生成示例结构...")
        journals = create_sample_data()
        print("  请手动替换为真实 CSSCI 数据")
    
    # 保存
    save_json(journals, OUTPUT_FILE)
    
    print("\n提示：")
    print("  1. CSSCI 数据通常需要从官网下载 Excel/CSV")
    print("  2. 下载地址：https://cssrac.nju.edu.cn/")
    print("  3. 将数据转换为 JSON 格式后替换此文件")
    
    print("\n✓ 完成!")


if __name__ == "__main__":
    main()

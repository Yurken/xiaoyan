#!/usr/bin/env python3
"""
PubMed / MEDLINE 期刊列表爬虫
从 NLM 下载完整的期刊目录
"""

import json
import csv
import time
import urllib.request
from pathlib import Path
from typing import List, Dict

DATA_DIR = Path(__file__).parent.parent / "apps/desktop/src-tauri/src/data"
OUTPUT_FILE = DATA_DIR / "pubmed_journals.json"

# NLM 期刊列表 FTP/HTTP 下载地址
PUBMED_JOURNAL_URL = "https://ftp.ncbi.nlm.nih.gov/pubmed/J_Medline.txt"


def download_pubmed_list() -> str:
    """下载 PubMed 期刊列表"""
    print("正在下载 PubMed 期刊列表...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; AcademicBot/1.0)",
    }
    
    req = urllib.request.Request(PUBMED_JOURNAL_URL, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            content = response.read().decode("utf-8", errors="replace")
        
        print(f"  ✓ 下载完成: {len(content)} 字符")
        return content
        
    except Exception as e:
        print(f"  ✗ 下载失败: {e}")
        return ""


def parse_medline_format(text: str) -> List[Dict]:
    """解析 MEDLINE 格式文本"""
    journals = []
    current = {}
    
    for line in text.split("\n"):
        line = line.strip()
        
        if not line:
            # 空行表示一条记录结束
            if current:
                journals.append(current)
                current = {}
            continue
        
        # MEDLINE 格式: "字段名: 值"
        if ":" in line:
            field, value = line.split(":", 1)
            field = field.strip()
            value = value.strip()
            
            if field == "JrId":
                if current:
                    journals.append(current)
                current = {"pubmed_id": value}
            elif field == "JournalTitle":
                current["title"] = value
            elif field == "MedAbbr":
                current["abbreviation"] = value
            elif field == "ISSN":
                current["issn"] = value
            elif field == "ESSN":
                current["eissn"] = value
            elif field == "IsoAbbr":
                current["iso_abbreviation"] = value
            elif field == "NlmId":
                current["nlm_id"] = value
            elif field == "Publisher":
                current["publisher"] = value
    
    # 添加最后一个
    if current:
        journals.append(current)
    
    return journals


def transform_to_unified(journals: List[Dict]) -> List[Dict]:
    """转换为统一格式"""
    unified = []
    
    for journal in journals:
        unified.append({
            "title": journal.get("title", ""),
            "abbreviation": journal.get("abbreviation", ""),
            "iso_abbreviation": journal.get("iso_abbreviation", ""),
            "issn": journal.get("issn", ""),
            "eissn": journal.get("eissn", ""),
            "publisher": journal.get("publisher", ""),
            "nlm_id": journal.get("nlm_id", ""),
            "pubmed_id": journal.get("pubmed_id", ""),
            "entity_type": "journal",
            "indexes": ["PubMed", "MEDLINE"],
            "disciplines": ["Biomedical", "Life Sciences"],
        })
    
    return unified


def save_json(journals: List[Dict], output_path: Path):
    """保存为 JSON"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(journals, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ 已保存到 {output_path}")
    print(f"  总计: {len(journals)} 条期刊记录")


def main():
    print("=" * 60)
    print("PubMed / MEDLINE 期刊列表爬虫")
    print("=" * 60)
    
    # 下载
    content = download_pubmed_list()
    if not content:
        print("下载失败，退出")
        return
    
    # 解析
    print("\n正在解析数据...")
    journals = parse_medline_format(content)
    print(f"  解析到 {len(journals)} 条期刊")
    
    # 转换
    unified = transform_to_unified(journals)
    
    # 保存
    save_json(unified, OUTPUT_FILE)
    
    # 统计
    print("\n数据统计:")
    print(f"  有 ISSN: {sum(1 for j in unified if j.get('issn'))} 条")
    print(f"  有 eISSN: {sum(1 for j in unified if j.get('eissn'))} 条")
    
    print("\n✓ 完成!")


if __name__ == "__main__":
    main()

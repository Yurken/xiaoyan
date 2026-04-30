#!/usr/bin/env python3
"""
DOAJ (Directory of Open Access Journals) 爬虫
使用 DOAJ API 获取开放获取期刊列表
"""

import json
import time
import urllib.request
import urllib.parse
from pathlib import Path
from typing import List, Dict, Optional

DATA_DIR = Path(__file__).parent.parent / "apps/desktop/src-tauri/src/data"
OUTPUT_FILE = DATA_DIR / "doaj_journals.json"

# DOAJ API
DOAJ_API_BASE = "https://doaj.org/api/v3"
DOAJ_SEARCH_URL = f"{DOAJ_API_BASE}/search/journals"


def fetch_doaj_journals(page_size: int = 100, max_pages: int = 50) -> List[Dict]:
    """通过 DOAJ API 获取期刊列表"""
    all_journals = []
    page = 1
    
    print("正在通过 DOAJ API 获取期刊...")
    
    while page <= max_pages:
        params = {
            "pageSize": page_size,
            "page": page,
        }
        
        query_string = urllib.parse.urlencode(params)
        url = f"{DOAJ_SEARCH_URL}?{query_string}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; AcademicBot/1.0)",
            "Accept": "application/json",
        }
        
        req = urllib.request.Request(url, headers=headers)
        
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
            
            results = data.get("results", [])
            if not results:
                break
            
            for result in results:
                bibjson = result.get("bibjson", {})
                
                journal = {
                    "title": bibjson.get("title", ""),
                    "issn": bibjson.get("eissn") or bibjson.get("pissn", ""),
                    "eissn": bibjson.get("eissn", ""),
                    "publisher": bibjson.get("publisher", {}).get("name", ""),
                    "license": bibjson.get("license", [{}])[0].get("type", ""),
                    "apc": bibjson.get("apc", {}).get("has_apc", False),
                    "subjects": [s.get("term", "") for s in bibjson.get("subject", [])],
                    "language": bibjson.get("language", []),
                    "country": bibjson.get("publisher", {}).get("country", ""),
                }
                
                all_journals.append(journal)
            
            print(f"  第 {page} 页: {len(results)} 条 (累计: {len(all_journals)})")
            
            # 检查是否还有更多
            total = data.get("total", 0)
            if len(all_journals) >= total:
                break
            
            page += 1
            time.sleep(1)  # 礼貌延迟
            
        except Exception as e:
            print(f"  第 {page} 页失败: {e}")
            break
    
    return all_journals


def transform_to_unified(journals: List[Dict]) -> List[Dict]:
    """转换为统一格式"""
    unified = []
    
    for journal in journals:
        unified.append({
            "title": journal.get("title", ""),
            "issn": journal.get("issn", ""),
            "eissn": journal.get("eissn", ""),
            "publisher": journal.get("publisher", ""),
            "country": journal.get("country", ""),
            "license": journal.get("license", ""),
            "apc": journal.get("apc", False),
            "subjects": journal.get("subjects", []),
            "languages": journal.get("language", []),
            "entity_type": "journal",
            "indexes": ["DOAJ"],
            "open_access": True,
            "oa_type": "gold",  # DOAJ 主要是 gold OA
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
    print("DOAJ 开放获取期刊爬虫")
    print("=" * 60)
    
    # 获取数据
    journals = fetch_doaj_journals(page_size=100, max_pages=30)
    
    if not journals:
        print("未获取到数据")
        return
    
    # 转换
    unified = transform_to_unified(journals)
    
    # 保存
    save_json(unified, OUTPUT_FILE)
    
    # 统计
    print("\n数据统计:")
    print(f"  有 APC: {sum(1 for j in unified if j.get('apc'))} 条")
    print(f"  有 License: {sum(1 for j in unified if j.get('license'))} 条")
    
    print("\n✓ 完成!")


if __name__ == "__main__":
    main()

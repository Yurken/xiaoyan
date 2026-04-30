#!/usr/bin/env python3
"""
Clarivate Web of Science Master Journal List 爬虫
自动下载 SCI/SCIE/SSCI/AHCI/ESCI 期刊列表
"""

import json
import csv
import time
import random
import urllib.request
import urllib.parse
from pathlib import Path
from typing import List, Dict, Optional

# 项目数据目录
DATA_DIR = Path(__file__).parent.parent / "apps/desktop/src-tauri/src/data"
OUTPUT_FILE = DATA_DIR / "wos_master_list.json"

# Clarivate Master Journal List 下载 URL
# 官网提供 CSV 下载，需要模拟表单提交
MASTER_JOURNAL_URL = "https://mjl.clarivate.com/cgi-bin/jrnlst/jlresults.cgi?PC=MASTER"

# 各版本（SCIE, SSCI, AHCI, ESCI）的下载链接模板
EDITION_URLS = {
    "SCIE": "https://mjl.clarivate.com/cgi-bin/jrnlst/jlresults.cgi?PC=D&mode=print",
    "SSCI": "https://mjl.clarivate.com/cgi-bin/jrnlst/jlresults.cgi?PC=SS&mode=print",
    "AHCI": "https://mjl.clarivate.com/cgi-bin/jrnlst/jlresults.cgi?PC=H&mode=print",
    "ESCI": "https://mjl.clarivate.com/cgi-bin/jrnlst/jlresults.cgi?PC=EX&mode=print",
}


def download_csv(edition: str, url: str) -> List[Dict]:
    """下载指定版本的期刊 CSV 数据"""
    print(f"正在下载 {edition} 期刊列表...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            content = response.read().decode("utf-8", errors="replace")
            
        # 解析 HTML 中的表格数据
        # Clarivate 的 print 模式会返回 HTML 表格
        journals = parse_html_table(content, edition)
        print(f"  ✓ {edition}: 解析到 {len(journals)} 条期刊")
        return journals
        
    except Exception as e:
        print(f"  ✗ {edition} 下载失败: {e}")
        return []


def parse_html_table(html: str, edition: str) -> List[Dict]:
    """解析 Clarivate HTML 表格，提取期刊信息"""
    journals = []
    
    # 简单 HTML 解析：按行提取
    # 每行格式: Full Journal Title | ISSN | eISSN | Edition | Category
    lines = html.split("\n")
    
    current_journal = {}
    
    for line in lines:
        line = line.strip()
        
        # 匹配期刊标题行
        if line.startswith("<P>") and "Full Journal Title:" in line:
            # 保存上一个期刊
            if current_journal and "title" in current_journal:
                journals.append(current_journal)
            
            # 开始新期刊
            title = extract_value(line, "Full Journal Title:")
            current_journal = {
                "title": title,
                "edition": edition,
                "issn": "",
                "eissn": "",
                "publisher": "",
                "categories": [],
            }
        
        # ISSN
        elif "ISSN:" in line and "eISSN" not in line:
            issn = extract_value(line, "ISSN:")
            if current_journal:
                current_journal["issn"] = issn
        
        # eISSN
        elif "eISSN:" in line:
            eissn = extract_value(line, "eISSN:")
            if current_journal:
                current_journal["eissn"] = eissn
        
        # 学科分类
        elif "Web of Science Categories:" in line:
            categories = extract_value(line, "Web of Science Categories:")
            if current_journal:
                current_journal["categories"] = [c.strip() for c in categories.split(";") if c.strip()]
    
    # 添加最后一个
    if current_journal and "title" in current_journal:
        journals.append(current_journal)
    
    return journals


def extract_value(html_line: str, label: str) -> str:
    """从 HTML 行中提取值"""
    try:
        # 移除 HTML 标签
        import re
        text = re.sub(r"<[^>]+>", "", html_line)
        # 提取标签后的值
        idx = text.find(label)
        if idx >= 0:
            value = text[idx + len(label):].strip()
            # 清理
            value = value.replace("&nbsp;", " ").strip()
            return value
        return ""
    except:
        return ""


def merge_journals(all_journals: Dict[str, List[Dict]]) -> List[Dict]:
    """合并多个版本的期刊数据，去重"""
    # 用 ISSN 作为主键去重
    journal_map = {}
    
    for edition, journals in all_journals.items():
        for journal in journals:
            key = journal.get("issn", "") or journal.get("eissn", "") or journal.get("title", "")
            
            if not key:
                continue
            
            if key in journal_map:
                # 已存在，合并版本信息
                existing = journal_map[key]
                if edition not in existing.get("editions", []):
                    existing.setdefault("editions", []).append(edition)
                # 合并分类
                for cat in journal.get("categories", []):
                    if cat not in existing.get("categories", []):
                        existing.setdefault("categories", []).append(cat)
            else:
                # 新期刊
                journal["editions"] = [edition]
                journal_map[key] = journal
    
    # 转换为列表
    merged = list(journal_map.values())
    
    # 添加统一字段
    for journal in merged:
        journal["entity_type"] = "journal"
        journal["indexes"] = journal.get("editions", [])
        journal["wos_categories"] = journal.get("categories", [])
        # 清理临时字段
        journal.pop("categories", None)
    
    return merged


def save_json(journals: List[Dict], output_path: Path):
    """保存为 JSON 文件"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(journals, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ 已保存到 {output_path}")
    print(f"  总计: {len(journals)} 条期刊记录")


def main():
    """主函数"""
    print("=" * 60)
    print("Clarivate Master Journal List 爬虫")
    print("=" * 60)
    
    all_journals = {}
    
    for edition, url in EDITION_URLS.items():
        journals = download_csv(edition, url)
        all_journals[edition] = journals
        
        # 礼貌延迟
        time.sleep(random.uniform(2, 4))
    
    # 合并数据
    print("\n正在合并数据...")
    merged = merge_journals(all_journals)
    
    # 保存
    save_json(merged, OUTPUT_FILE)
    
    # 打印统计
    print("\n数据统计:")
    for edition in EDITION_URLS.keys():
        count = sum(1 for j in merged if edition in j.get("editions", []))
        print(f"  {edition}: {count} 条")
    
    print("\n✓ 完成!")


if __name__ == "__main__":
    main()

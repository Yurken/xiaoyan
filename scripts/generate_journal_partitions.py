#!/usr/bin/env python3

import argparse
import csv
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile


def clean(value: object | None) -> str:
    if value is None:
        return ""
    text = str(value).replace("\u3000", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_title(value: str) -> str:
    text = clean(value).lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_issn(value: str) -> str:
    return re.sub(r"[^0-9Xx]", "", clean(value)).upper()


def parse_bool(value: str) -> bool:
    return clean(value) in {"是", "Yes", "YES", "true", "TRUE", "1"}


def choose_title(current: str, candidate: str) -> str:
    next_value = clean(candidate)
    if not next_value:
        return current
    if not current:
        return next_value
    if current.isupper() and not next_value.isupper():
        return next_value
    return current


class JournalCatalog:
    def __init__(self) -> None:
        self.records: dict[str, dict[str, object]] = {}
        self.issn_index: dict[str, str] = {}

    def _base_record(self, title: str, issn: str = "", eissn: str = "") -> dict[str, object]:
        return {
            "title": clean(title),
            "issn": clean(issn),
            "eissn": clean(eissn),
            "publisher": "",
            "indexes": [],
            "wos_categories": [],
            "jcr_quartile": "",
            "jcr_category": "",
            "jif": "",
            "jif_rank": "",
            "cas_quartile": "",
            "cas_top": False,
            "open_access": False,
        }

    def upsert(self, title: str, issn: str = "", eissn: str = "") -> dict[str, object]:
        title_key = normalize_title(title)
        key = title_key or normalize_issn(issn) or normalize_issn(eissn)
        if not key:
            raise ValueError("journal record requires a title or ISSN")

        record = self.records.get(key)
        if record is None:
            record = self._base_record(title, issn, eissn)
            self.records[key] = record

        if issn and not record["issn"]:
            record["issn"] = clean(issn)
        if eissn and not record["eissn"]:
            record["eissn"] = clean(eissn)
        record["title"] = choose_title(str(record["title"]), title)

        for token in (normalize_issn(issn), normalize_issn(eissn)):
            if token:
                self.issn_index[token] = key

        return record

    def resolve(self, title: str, issn: str = "", eissn: str = "") -> dict[str, object]:
        for token in (normalize_issn(issn), normalize_issn(eissn)):
            if token and token in self.issn_index:
                return self.records[self.issn_index[token]]

        title_key = normalize_title(title)
        if title_key in self.records:
            return self.records[title_key]

        return self.upsert(title, issn, eissn)

    def to_list(self) -> list[dict[str, object]]:
        return [record for _, record in sorted(self.records.items(), key=lambda item: str(item[1]["title"]).lower())]


def load_wos_directory(path: Path, index_name: str, catalog: JournalCatalog) -> None:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            record = catalog.resolve(
                row.get("Journal title", ""),
                row.get("ISSN", ""),
                row.get("eISSN", ""),
            )
            if not record["publisher"]:
                record["publisher"] = clean(row.get("Publisher name", ""))
            indexes = record["indexes"]
            if index_name not in indexes:
                indexes.append(index_name)
            categories = record["wos_categories"]
            for category in (clean(part) for part in clean(row.get("Web of Science Categories", "")).split("|")):
                if category and category not in categories:
                    categories.append(category)


def iter_xlsx_rows(path: Path, sheet_name: str) -> list[dict[str, str]]:
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    with ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}

        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for si in root:
                shared_strings.append(
                    "".join(text.text or "" for text in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"))
                )

        sheet_path = ""
        for sheet in workbook.find("a:sheets", ns):
            if sheet.attrib["name"] == sheet_name:
                rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
                sheet_path = "xl/" + rel_map[rid].lstrip("/")
                break

        if not sheet_path:
            raise ValueError(f"sheet not found: {sheet_name}")

        root = ET.fromstring(archive.read(sheet_path))
        sheet_data = root.find("a:sheetData", ns)
        if sheet_data is None:
            return []

        def cell_value(cell: ET.Element) -> str:
            cell_type = cell.attrib.get("t")
            value = cell.find("a:v", ns)
            if value is None:
                inline = cell.find("a:is", ns)
                if inline is not None:
                    return "".join(text.text or "" for text in inline.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"))
                return ""
            raw = value.text or ""
            if cell_type == "s":
                return shared_strings[int(raw)]
            return raw

        rows = []
        headers: list[str] | None = None
        for row in sheet_data:
            values = [clean(cell_value(cell)) for cell in row]
            if headers is None:
                headers = values
                continue
            if not any(values):
                continue
            padded = values + [""] * max(0, len(headers) - len(values))
            rows.append(dict(zip(headers, padded)))

        return rows


def load_jcr_sheet(path: Path, catalog: JournalCatalog) -> None:
    for row in iter_xlsx_rows(path, "2025JCRIF-分区"):
        record = catalog.resolve(row.get("期刊名", ""), row.get("ISSN", ""), row.get("eISSN", ""))
        record["jcr_quartile"] = clean(row.get("2024分区", "")) or clean(row.get("Quartile", "")) or record["jcr_quartile"]
        record["jcr_category"] = clean(row.get("Category", "")) or record["jcr_category"]
        record["jif"] = clean(row.get("2024JIF", "")) or record["jif"]
        record["jif_rank"] = clean(row.get("JIF rank", "")) or record["jif_rank"]


def load_cas_sheet(path: Path, catalog: JournalCatalog) -> None:
    for row in iter_xlsx_rows(path, "2025中科学院分区表"):
        record = catalog.resolve(row.get("期刊名称", ""))
        record["cas_quartile"] = clean(row.get("2025分区", "")) or record["cas_quartile"]
        record["cas_top"] = bool(record["cas_top"]) or parse_bool(row.get("Top", ""))
        record["open_access"] = bool(record["open_access"]) or parse_bool(row.get("Open Access", ""))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate merged journal partition catalog from WOS CSV + JCR/CAS XLSX.")
    parser.add_argument("--scie", type=Path, required=True)
    parser.add_argument("--ssci", type=Path, required=True)
    parser.add_argument("--esci", type=Path, required=True)
    parser.add_argument("--ahci", type=Path, required=True)
    parser.add_argument("--partitions", type=Path, required=True, help="2025年度中国科学院及科睿唯安JCR期刊分区表.xlsx")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    catalog = JournalCatalog()
    load_wos_directory(args.scie, "SCIE", catalog)
    load_wos_directory(args.ssci, "SSCI", catalog)
    load_wos_directory(args.esci, "ESCI", catalog)
    load_wos_directory(args.ahci, "AHCI", catalog)
    load_jcr_sheet(args.partitions, catalog)
    load_cas_sheet(args.partitions, catalog)

    data = catalog.to_list()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(data)} entries -> {args.output}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Export everyday Word records into static web data."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

from docx import Document


MODULES = [
    "BBY",
    "NATM",
    "电视购物",
    "Shokz",
    "分销",
    "CE（小组的）",
    "跨部门合作帮忙",
    "其他不相关的",
]

STATUSES = ["待处理", "等待回复", "已回复", "有风险", "已完成", "仅参考"]

FILE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-工作-信息与知识\.docx$")
TIME_RE = re.compile(r"^\d{1,2}:\d{2}$")


def normalize_text(value: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", (value or "").strip())


def infer_module(concise: str) -> str:
    prefix = concise.split("：", 1)[0]
    if " / " in prefix:
        first = prefix.split(" / ", 1)[0].strip()
        if first in MODULES:
            return first
    upper = concise.upper()
    nt_distribution_signals = ["按需推单", "产能", "300 台", "GTM", "分货排期", "全渠道"]
    if ("NT" in upper or "NT自" in concise) and any(signal in concise for signal in nt_distribution_signals):
        return "分销"
    if "BBY" in upper or "BEST BUY" in upper:
        return "BBY"
    if any(token in upper for token in ["NATM", "NFM", "ABT", "BSM", "RCW"]):
        return "NATM"
    if any(token in upper for token in ["GMA", "S803", "TV SHOPPING"]) or "电视购物" in concise:
        return "电视购物"
    if "分销" in concise or "NT " in upper or "NT全" in concise:
        return "分销"
    if "跨部门" in concise or "财务付款" in concise or "费用归属" in concise:
        return "跨部门合作帮忙"
    if "CE" in upper:
        return "CE（小组的）"
    if "SHOKZ" in upper or "美国办公室" in concise or "公司" in concise:
        return "Shokz"
    return "其他不相关的"


def infer_project(module: str, concise: str) -> str:
    prefix = concise.split("：", 1)[0]
    if " / " in prefix:
        parts = [part.strip() for part in prefix.split(" / ", 1)]
        if len(parts) == 2 and parts[1]:
            return parts[1]

    upper = concise.upper()
    if module == "BBY":
        if "35K 2FT" in upper or "2FT" in upper:
            return "35K 2ft new inline POP"
        if "6/7" in concise and "BEING" in upper:
            return "6/7 Being耳机替换包"
        if "8/23" in concise and "NCE" in upper:
            return "8/23 NCE"
        if "8/23" in concise and "SIDESTOCK" in upper:
            return "8/23 SideStock"
        if "ACTIONLINK" in upper:
            return "ActionLink/巡店执行"
        return "BBY 日常跟进"
    if module == "NATM":
        for project in ["Abt", "NFM", "BSM", "RCW", "Other NATM"]:
            if project.upper() in upper:
                return project
        return "Other NATM"
    if module == "电视购物":
        if "GMA" in upper:
            return "GMA"
        if "S803" in upper:
            return "S803"
        return "电视购物 日常跟进"
    if module == "Shokz":
        if "地址" in concise or "NICK" in upper:
            return "美国办公室地址/公司信息"
        if "口径" in concise or "充电线" in concise:
            return "产品对外口径"
        return "Shokz 日常跟进"
    if module == "分销":
        if "NT" in upper:
            return "NT 全渠道开放 / 推单"
        return "分销 日常跟进"
    if module == "跨部门合作帮忙":
        if "付款" in concise:
            return "财务付款规则"
        if "费用" in concise or "成本" in concise:
            return "费用归属/成本分摊"
        return "跨部门项目支持"
    return f"{module} 日常跟进"


def infer_status(concise: str) -> str:
    for status in STATUSES:
        if status in concise:
            return status
    if any(token in concise for token in ["风险", "无法", "未解决"]):
        return "有风险"
    if any(token in concise for token in ["需", "需要", "待", "确认", "跟进", "DDL", "安排", "沟通"]):
        return "待处理"
    return "仅参考"


def iter_records(records_root: Path) -> list[dict]:
    records: list[dict] = []
    for docx_path in sorted(records_root.glob("20*-工作-信息与知识.docx")):
        match = FILE_RE.match(docx_path.name)
        if not match:
            continue
        date = match.group(1)
        document = Document(docx_path)
        for table in document.tables:
            for row_index, row in enumerate(table.rows):
                cells = [normalize_text(cell.text) for cell in row.cells]
                if len(cells) < 3:
                    continue
                if row_index == 0 and "时间" in cells[0]:
                    continue
                time, original, concise = cells[:3]
                if not TIME_RE.match(time):
                    continue
                if not any([time, original, concise]):
                    continue
                module = infer_module(concise)
                project = infer_project(module, concise)
                records.append(
                    {
                        "id": f"{date}-{len(records) + 1:04d}",
                        "date": date,
                        "time": time,
                        "module": module,
                        "project": project,
                        "status": infer_status(concise),
                        "original": original,
                        "concise": concise,
                        "source_file": docx_path.name,
                    }
                )
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--records-root", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "records": iter_records(args.records_root),
    }

    json_path = args.output_dir / "records.json"
    js_path = args.output_dir / "records.js"
    json_text = json.dumps(payload, ensure_ascii=False, indent=2)
    json_path.write_text(json_text + "\n", encoding="utf-8")
    js_path.write_text("window.EVERYDAY_RECORDS = " + json_text + ";\n", encoding="utf-8")
    print(json.dumps({"records": len(payload["records"]), "json": str(json_path), "js": str(js_path)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

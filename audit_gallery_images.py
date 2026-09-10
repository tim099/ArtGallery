#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""唯讀稽核 ArtGallery 展品的圖片引用。

用法：
    python audit_gallery_images.py
    python audit_gallery_images.py --json
    python audit_gallery_images.py --fail-on-issues

掃描範圍跟 build_gallery.py 的展區列舉一致，但會額外掃到 Comic 內部的
章節、人設與道具卡，讓舊圖片路徑不會躲在漫畫子目錄裡。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from build_gallery import (
    FLAT_ONLY_SECTIONS,
    IMG_RE,
    ROOT,
    SECTIONS,
    SKIP_NAMES,
    parse_front_matter,
)


def _is_inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _clean_ref(value: str) -> str:
    return value.strip().strip("<>").strip('"').strip("'")


def _refs(text: str) -> list[tuple[str, str]]:
    refs = [(m.group(1), "inline") for m in IMG_RE.finditer(text)]
    fm_image = parse_front_matter(text).get("image")
    if fm_image:
        refs.append((fm_image, "frontmatter"))
    return refs


def _files() -> list[Path]:
    found: set[Path] = set()
    for sec_dir in SECTIONS:
        base = ROOT / sec_dir
        if not base.is_dir():
            continue
        globber = base.glob if sec_dir in FLAT_ONLY_SECTIONS else base.rglob
        for md in globber("*.md"):
            if md.name not in SKIP_NAMES:
                found.add(md)
    return sorted(found)


def _scope(md: Path) -> str:
    rel_parts = md.relative_to(ROOT).parts
    return "Comic 內部" if rel_parts and rel_parts[0] == "Comic" and len(rel_parts) > 2 else "畫廊展品"


def audit() -> tuple[list[dict], dict[str, int]]:
    issues: list[dict] = []
    summary = {
        "files": 0,
        "with_valid_image": 0,
        "missing_image": 0,
        "external_path": 0,
        "missing_file": 0,
        "frontmatter_only": 0,
    }

    for md in _files():
        summary["files"] += 1
        rel = md.relative_to(ROOT).as_posix()
        text = md.read_text(encoding="utf-8")
        refs = _refs(text)
        inline_refs = [ref for ref, kind in refs if kind == "inline"]

        if not refs:
            summary["missing_image"] += 1
            issues.append({"kind": "missing_image", "scope": _scope(md), "file": rel})
            continue

        valid_inline = False
        valid_frontmatter = False
        for raw_ref, source in refs:
            ref = _clean_ref(raw_ref)
            parsed = urlparse(ref)
            if parsed.scheme or ref.startswith("//"):
                summary["external_path"] += 1
                issues.append({
                    "kind": "external_path", "scope": _scope(md), "file": rel,
                    "source": source, "reference": raw_ref,
                })
                continue

            candidate = (md.parent / ref).resolve()
            if not _is_inside(candidate, ROOT):
                summary["external_path"] += 1
                issues.append({
                    "kind": "external_path", "scope": _scope(md), "file": rel,
                    "source": source, "reference": raw_ref,
                })
            elif not candidate.is_file():
                summary["missing_file"] += 1
                issues.append({
                    "kind": "missing_file", "scope": _scope(md), "file": rel,
                    "source": source, "reference": raw_ref,
                    "resolved": candidate.relative_to(ROOT).as_posix(),
                })
            elif source == "inline":
                valid_inline = True
            else:
                valid_frontmatter = True

        if valid_inline:
            summary["with_valid_image"] += 1
        elif valid_frontmatter:
            # build_gallery.py 目前只讀 Markdown inline image；這種展品在畫廊仍會沒有圖。
            summary["frontmatter_only"] += 1
            issues.append({
                "kind": "frontmatter_only", "scope": _scope(md), "file": rel,
                "reference": next(raw for raw, source in refs if source == "frontmatter"),
            })

    return issues, summary


def _report_rows(issues: list[dict]) -> list[dict]:
    """把單一展品的多個壞引用合併成一列，方便人工修復。"""
    grouped: dict[str, dict] = {}
    priority = {"missing_image": 0, "missing_file": 1, "external_path": 2, "frontmatter_only": 3}
    for issue in issues:
        row = grouped.setdefault(issue["file"], {
            "scope": issue["scope"], "file": issue["file"], "kinds": [], "details": []
        })
        kind = issue["kind"]
        if kind not in row["kinds"]:
            row["kinds"].append(kind)
        detail = issue.get("reference", "")
        if kind == "missing_file":
            detail = f"{detail} → {issue['resolved']}"
        if detail and detail not in row["details"]:
            row["details"].append(detail)

    rows = list(grouped.values())
    for row in rows:
        row["kinds"].sort(key=priority.get)
    return sorted(rows, key=lambda row: row["file"])


def write_report(path: Path, issues: list[dict], summary: dict[str, int]) -> None:
    rows = _report_rows(issues)
    lines = [
        "# ArtGallery 圖片稽核報告",
        "",
        f"> 產生時間：{datetime.now().astimezone().isoformat(timespec='seconds')}",
        "> 這是唯讀稽核結果；本報告不會自動修改展品。",
        "",
        "## 摘要",
        "",
        f"- 掃描 Markdown：{summary['files']} 件",
        f"- 可用 inline 圖片：{summary['with_valid_image']} 件",
        f"- 無可用圖片展品：{len(rows)} 件",
        f"- 無圖片引用：{summary['missing_image']} 件",
        f"- 圖片檔不存在：{summary['missing_file']} 件",
        f"- 外部圖片路徑：{summary['external_path']} 件",
        f"- 僅 frontmatter image：{summary['frontmatter_only']} 件",
        "",
        "## 無可用圖片的展品",
        "",
    ]
    if not rows:
        lines.append("✅ 目前沒有無可用圖片的展品。")
    else:
        lines.extend([
            "| 類型 | 展品檔案 | 原因 | 引用／解析結果 |",
            "|---|---|---|---|",
        ])
        for row in rows:
            kinds = ", ".join(row["kinds"])
            details = "<br>".join(row["details"])
            lines.append(f"| {row['scope']} | `{row['file']}` | `{kinds}` | `{details}` |")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="稽核 ArtGallery 展品圖片路徑")
    parser.add_argument("--json", action="store_true", help="輸出 JSON，方便後續修復腳本使用")
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "gallery_image_audit.md",
        help="輸出 Markdown 報告檔（預設：gallery_image_audit.md）",
    )
    parser.add_argument("--fail-on-issues", action="store_true", help="發現問題時以 exit code 1 結束")
    args = parser.parse_args()

    issues, summary = audit()
    write_report(args.output if args.output.is_absolute() else ROOT / args.output, issues, summary)
    if args.json:
        print(json.dumps({"summary": summary, "issues": issues}, ensure_ascii=False, indent=2))
    else:
        print(
            "掃描 {files} 個 Markdown｜有效 inline 圖片 {with_valid_image}｜"
            "無圖片 {missing_image}｜外部路徑 {external_path}｜"
            "檔案不存在 {missing_file}｜僅 frontmatter image {frontmatter_only}".format(**summary)
        )
        for issue in issues:
            detail = issue.get("reference", "")
            if issue["kind"] == "missing_file":
                detail = f"{detail} → {issue['resolved']}"
            print(f"[{issue['kind']}] [{issue['scope']}] {issue['file']} {detail}".rstrip())
        print(f"報告已寫入：{(args.output if args.output.is_absolute() else ROOT / args.output).as_posix()}")

    return 1 if args.fail_on_issues and issues else 0


if __name__ == "__main__":
    raise SystemExit(main())

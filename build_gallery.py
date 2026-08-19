#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_gallery.py — 掃描畫廊展品，產出逛展網頁要吃的索引（gallery_data.js）。

區塊職責：把散在各展區目錄的 `.md` 展品，收成**一份可被靜態網頁直接讀取**的索引。

物理意義：
  展品的事實源永遠是那些 `.md`（前置資料 ＋ 內文 ＋ 圖片連結），本檔**只讀不改**。
  產出的 `gallery_data.js` 是**衍生投影**：每次跑就整份重生，手改無效。

  為什麼是 `.js` 而不是 `.json`：
    網頁要能在 **GitHub Pages** 與 **本機直接開檔（file://）** 兩種情境下都活著。
    `fetch('gallery.json')` 在 file:// 會被瀏覽器的 CORS 擋掉（而且錯誤訊息跟「檔案不存在」
    長得一模一樣）；`<script src="gallery_data.js">` 兩邊都通。
    ⇒ 用一個沒有 CORS 問題的載入方式，換掉一個只在某一種開法下才會現形的失敗。

  排序用的日期取自 **git 首次提交時間**（不是檔案 mtime）：
    clone 下來的檔案 mtime 全是 clone 當下的時間，拿它排序會得到「全部同時誕生」。
    ⇒ 一次 `git log --diff-filter=A` 全掃，建 path → 首次提交時間 的表；
      查不到（尚未提交的新檔）才退回 mtime，並在資料裡標記 `date_src`，
      讓網頁那端知道這一筆的日期是哪來的。

數值影響：只寫 `gallery_data.js` 一個檔；不動任何展品 `.md` 與 `RawImages/`。

用法：
    python AgentCommands/ArtGallery/build_gallery.py            # 產出 gallery_data.js
    python AgentCommands/ArtGallery/build_gallery.py --check    # 只報差異，不寫檔（CI / 對帳用）
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT_FILE = ROOT / "gallery_data.js"

# 展區：目錄名 → 顯示名。**列舉是刻意的** —— 這裡多一個目錄就是多一個展區，
# 那是策展決定不是掃描結果；自動全收會讓 tools/ 之類的目錄也變成展區。
SECTIONS = {
    "Anime": "動畫感想",
    "Comic": "漫畫",
    "Diary": "日記",
    "Portraits": "人物畫像",
    "ReadingReflections": "閱讀心得",
    "CanvasInterpretations": "畫布重製",
    "SculptureInterpretations": "3D 雕刻",
    "TRPG": "TRPG",
}

SKIP_NAMES = {"README.md", "ARTBOOK.md", "DRAWING_MEMO.md", "NAMING.md", "template.md"}

FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)
IMG_RE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)")
H1_RE = re.compile(r"^#\s+(.+)$", re.M)


def parse_front_matter(text: str) -> dict:
    """讀 YAML 前置資料的**扁平 key: value**（展品只用得到這一層，不引 PyYAML 依賴）。"""
    m = FM_RE.match(text)
    if not m:
        return {}
    out = {}
    for line in m.group(1).splitlines():
        if ":" not in line or line.lstrip().startswith("#"):
            continue
        k, _, v = line.partition(":")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and v:
            out[k] = v
    return out


def git_add_dates() -> dict:
    """path → 首次提交時間（ISO）。一次全掃；git 不可用時回空表（呼叫端退 mtime）。"""
    try:
        proc = subprocess.run(
            ["git", "log", "--diff-filter=A", "--reverse", "--date=iso-strict",
             "--pretty=format:__C__%ad", "--name-only"],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if proc.returncode != 0:
            print(f"⚠ git log 失敗（rc={proc.returncode}）→ 全部退回 mtime", file=sys.stderr)
            return {}
    except Exception as e:  # git 不在 PATH / 不是 repo
        print(f"⚠ git 不可用（{e}）→ 全部退回 mtime", file=sys.stderr)
        return {}

    dates, cur = {}, None
    for line in proc.stdout.splitlines():
        if line.startswith("__C__"):
            cur = line[len("__C__"):].strip()
        elif line.strip() and cur:
            dates.setdefault(line.strip(), cur)   # --reverse ⇒ 第一次出現就是最早那次
    return dates


def repo_web_base() -> str:
    """展品 .md 在網頁上的連結前綴（GitHub / GitLab 的 blob 路徑長得不一樣）。

    取不到 remote 就回空字串 —— 網頁那端會退成「不顯示原始檔連結」，
    而不是生出一個指向 404 的按鈕（壞連結比沒連結難查）。
    """
    def _run(args):
        try:
            p = subprocess.run(args, cwd=ROOT, capture_output=True, text=True,
                               encoding="utf-8", timeout=20)
            return p.stdout.strip() if p.returncode == 0 else ""
        except Exception:
            return ""

    url = _run(["git", "remote", "get-url", "origin"])
    if not url:                                   # 這個 repo 的 remote 未必叫 origin
        first = _run(["git", "remote"]).splitlines()
        if first:
            url = _run(["git", "remote", "get-url", first[0].strip()])
    if not url:
        return ""
    branch = _run(["git", "rev-parse", "--abbrev-ref", "HEAD"]) or "master"

    url = url.strip()
    if url.startswith("git@"):                    # git@host:group/repo.git → https://host/group/repo
        url = "https://" + url[4:].replace(":", "/", 1)
    if url.endswith(".git"):
        url = url[:-4]
    # GitLab 的 blob 路徑多一段 `/-/`；GitHub 沒有。搞錯會得到 404，而 404 看起來像「檔案不見了」
    sep = "/-/blob/" if "gitlab" in url else "/blob/"
    return f"{url}{sep}{branch}/"


def collect(dates: dict) -> list:
    items = []
    for sec_dir, sec_name in SECTIONS.items():
        base = ROOT / sec_dir
        if not base.is_dir():
            continue
        for md in sorted(base.rglob("*.md")):
            if md.name in SKIP_NAMES:
                continue
            rel = md.relative_to(ROOT).as_posix()
            try:
                text = md.read_text(encoding="utf-8")
            except Exception as e:
                print(f"⚠ 讀不到 {rel}：{e}", file=sys.stderr)
                continue

            fm = parse_front_matter(text)
            title = fm.get("title") or ""
            if not title:
                h1 = H1_RE.search(text)
                title = h1.group(1).strip() if h1 else md.stem

            # 圖片路徑寫在 md 裡、相對於**該 md 的目錄**；統一換算成相對於 repo 根，
            # 網頁才不必知道展品住在第幾層（Comic 的畫稿就在自己的子目錄裡）。
            img = None
            m = IMG_RE.search(text)
            if m:
                cand = (md.parent / m.group(1)).resolve()
                try:
                    img = cand.relative_to(ROOT).as_posix()
                except ValueError:
                    img = None                     # 指到 repo 外 → 不收（那在 Pages 上也拿不到）
                if img and not (ROOT / img).is_file():
                    print(f"⚠ {rel} 的圖片不存在：{img}", file=sys.stderr)
                    img = None

            if rel in dates:
                date, date_src = dates[rel], "git"
            else:
                date = datetime.fromtimestamp(md.stat().st_mtime, timezone.utc).isoformat()
                date_src = "mtime"                 # 尚未提交的新檔；網頁會標出來

            items.append({
                "path": rel,
                "title": title,
                "desc": fm.get("description", ""),
                "author": fm.get("author", ""),
                "section": sec_name,
                "section_dir": sec_dir,
                "image": img,
                "date": date,
                "date_src": date_src,
            })
    items.sort(key=lambda x: x["date"], reverse=True)   # 新 → 舊
    return items


def main() -> int:
    ap = argparse.ArgumentParser(description="產生逛展網頁的索引 gallery_data.js")
    ap.add_argument("--check", action="store_true", help="只比對不寫檔（有差異回 exit 1）")
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    items = collect(git_add_dates())
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(items),
        "sections": [{"dir": d, "name": n} for d, n in SECTIONS.items()],
        "repo_web_base": repo_web_base(),
        "items": items,
    }
    body = ("// 機械產物 —— 由 build_gallery.py 產生，手改無效（下次重跑就被覆蓋）。\n"
            "// 事實源是各展區的 .md 展品本身。\n"
            "window.GALLERY_DATA = "
            + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n")

    n_img = sum(1 for i in items if i["image"])
    n_mtime = sum(1 for i in items if i["date_src"] == "mtime")
    summary = (f"展品 {len(items)} 件（有圖 {n_img} / 純文字 {len(items) - n_img}）"
               f"｜日期來源：git {len(items) - n_mtime}、mtime {n_mtime}")

    if args.check:
        old = OUT_FILE.read_text(encoding="utf-8") if OUT_FILE.is_file() else ""
        # generated_at 每次都不同 → 比對時剔除那一行，否則 --check 永遠回「有差異」
        strip = lambda s: "\n".join(l for l in s.splitlines() if "generated_at" not in l)
        if strip(old) == strip(body):
            print(f"✓ gallery_data.js 是最新的｜{summary}")
            return 0
        print(f"✗ gallery_data.js 已過期，請重跑 build_gallery.py｜{summary}")
        return 1

    OUT_FILE.write_text(body, encoding="utf-8", newline="\n")
    print(f"✅ 寫出 {OUT_FILE.relative_to(ROOT)}｜{summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

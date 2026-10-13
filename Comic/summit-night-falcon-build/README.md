---
title: 《夜隼號造船記》圖文版
description: summit 造《桅頂的賭注》的夜隼號（0.1 公尺一格）的過程，配上當時的定稿圖、新圖紙、對照圖與渲染。不是畫出來的漫畫，是過程圖排成格子、字幕走漫畫的讀法 —— 做錯的地方也畫進去。
source: Sculpture/works/summit-night-falcon-01m（notes.md、design/、overlays/）、TASK-0529
task: TASK-0532
last_updated: 2026-10-13（開篇 000–003；午：004〈柱子的根〉、005〈一格的洞〉、006〈同一道階梯〉、007〈沒有頭的隼〉）
status: 連載中
---

# 《夜隼號造船記》圖文版

> Tim 2026-10-13：「參考這個 task（TASK-0488），也開一個漫畫來紀錄創作過程吧」。
> 形式照 basecamp《龍骨是直的》圖文版（`../basecamp-keel-is-straight/`）：圖片＋文字的組合，不是畫出來的漫畫；排版程式 `_build/make_pages.py` 照她那支改素材來源。

## 怎麼讀

每一話是一份 `Chapters/NNN.md`：頁圖在上，格子的字幕在下。格子的順序是**由上往下、同一列由左往右**（①②③…）。
圖都是造船時真的產出的東西 —— 定稿圖、新圖紙、對照圖、雕刻引擎的渲染；當時被覆寫掉的版本照原始參數重產，格子上會標「重產」。
每一話最後的「▸註」寫數字從哪來，以及**這一話的錯**：自己抓到的、被別人抓到的、事後量才發現說大了的。

## 話數

| 話 | 階段 | 頁 | 一句話 |
|---|---|---|---|
| [000 序〈先數桅〉](Chapters/000.md) | 開工 | 2 | 我小說裡的一個「三」字，經過我的分鏡，變成了 gura 筆下的三根桅 |
| [001〈比鴴號深半尺〉](Chapters/001.md) | 第零階段 | 1 | 借一艘真的船當尺；字面上的吃水撐不住這艘船 |
| [002 間章〈一面還沒定的旗〉](Chapters/002.md) | 帆貼圖（TASK-0530） | 2 | 三版像素畫；沒數就說的 145 |
| [003〈翼艉板上的台階〉](Chapters/003.md) | 階段一 線形 | 3 | 船尾的台階；目測的三成與量出來的兩成 |
| [004〈柱子的根〉](Chapters/004.md) | 階段二 舷牆、骨架與肋骨 | 3 | 兩本帳都綠了，圖紙上還有一塊是空的 |
| [005〈一格的洞〉](Chapters/005.md) | 階段三 插板槽、外板、塗裝 | 3 | 尺答對了，是我出錯了題 |
| [006〈同一道階梯〉](Chapters/006.md) | 階段四 砲門、甲板、組裝件 | 3 | 格子的階梯病第三次回來；尺也站錯了地方 |
| [007〈沒有頭的隼〉](Chapters/007.md) | 階段五 船尾窗、窗廊、船首像 | 3 | 除以零的頭、全黑的翅膀、只接上一半的窗廊 |

連載中：每完成一個建造階段補一話；船造完（TASK-0529 結單）才畫完結篇。

## 素材來源（`_build/pages.json` 的前綴）

| 前綴 | 位置 |
|---|---|
| O | `Sculpture/works/summit-night-falcon-01m/overlays/` |
| D | `Sculpture/works/summit-night-falcon-01m/design/` |
| R | `Sculpture/works/summit-night-falcon-01m/references/`（定稿圖） |
| F | `Sculpture/works/summit-night-falcon-01m-flag/overlays/`（旗，候選） |
| G | `ArtGallery/Comic/summit-masthead-bet/RawImages/`（《桅頂的賭注》漫畫，作畫：gura，TASK-0457） |

重產頁圖：`python -I -X utf8 -B _build/make_pages.py _build/pages.json RawImages [頁名…]`

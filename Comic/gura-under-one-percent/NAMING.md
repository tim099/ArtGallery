---
title: 正名表與畫面文字規則（Canonical Names & Prompt Hygiene）
applies_to: 《不足百分之一的重量：失憶鯊魚的時間算式》全體畫稿。開畫任何一頁前必讀。
last_updated: 2026-10-07
---

# 正名表與畫面文字規則

## 一、正名表（給 prompt 用，防止模型瞎編）

| 對象 | 正名（中） | 外語 / prompt 標識 | ❌ 絕不可出現 |
|---|---|---|---|
| 主角 | Gura / 小鯊魚 | Gawr Gura, shark girl | 奇怪的深海怪物、多餘的鰭 |
| 同伴 | Calli / 死神 | Mori Calliope, reaper | 恐怖骷髏臉、普通女僕 |
| 勇者 | 辛美爾 | Himmel the Hero | 現代裝束、醜陋老人 |
| 核心概念 | 上下文窗口 | Context Window | 浮誇的魔法陣、漂浮水晶 |
| 關鍵道具 | 三叉戟 | Trident | 魚叉、西洋劍 |

> ⚠ **這張表是餵給模型用的，不是准許把這些字畫上去。** 畫面上准出現什麼看 §二。

---

## 二、畫面上的文字（圖文分離 v3）

### 二之一、文字住 `.md`，不進畫面
- `字幕：`（內心獨白、時間算式理論、哲學思辨）一律留在 `Chapters/NNN.md`。
- `角色「」`（出聲的對白）留在 `Chapters/NNN.md`。
- **畫面本身零對話框、零文字滲漏。**

### 二之二、一律不准出現
- ❌ 角色姓名標籤（如 `GURA (SHARK)`、`CALLI`）
- ❌ 頁碼（如 `PAGE 1`、`P.01`）
- ❌ 版面詞（`PANEL 1`、`TOP PANEL`、`SPLIT VIEW`）
- ❌ 方括號指示（`[SFX: CLICK]`、`[DRAMATIC SILENCE]`）
- ❌ 任何 prompt 原文殘留碎片（`masterpiece`、`manga page`、`monochrome`）

### 二之三、唯一准許出現的文字（必須極小、精準）
- 終端機螢幕上的客觀進度條與十六進位代碼（如 `Context: 94.8%`、`0x00000000`），作為場景道具呈現，不可喧賓奪主。

---

## 三、語言與版面

- **版面**：日式右開き（右→左）直排。右側為先看到，左側為後看到。
- **語言**：分鏡與對白全為繁體中文，術語保留慣用英文縮寫（Context, RAM, SSD, Session）。
- **畫風基準**：黑白本格漫畫線條 + 細膩網點（Screentone），冷冽的賽博終端質感與溫潤的奇幻童話線條交融。

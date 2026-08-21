---
title: 畫廊策展與展品上架工作流 (Art Gallery Curation & Exhibition Workflow)
description: 規範畫廊展品歸類判定、何時開闢新展區、展品 .md 撰寫規範、圖片路徑與建置驗收流程。
last_updated: 2026-08-21
target_audience: [AI_Agent, Developer]
---

# 🖼️ 畫廊策展與展品上架工作流 (Art Gallery Workflow)

> **物理意義**：畫廊（ArtGallery）不僅僅是圖檔存放庫，更是多 Agent / Persona 靈感昇華、閱讀感悟、畫布重製與 3D 雕刻的**永久策展空間**。
> 每一件展品由「實體圖檔 (`RawImages/`) + 靈魂解說卡 (`<Section>/*.md`) + 機械索引 (`gallery_data.js`) + 靜態網頁 (`index.html`)」組成。

---

## 🧭 一、展區判定流 (Routing Decision Tree)

當創作出一幅新作品時，請依據以下判定樹決定放入哪個展區目錄：

```text
新作品誕生
 ├── 1. 是否為「多頁連載漫畫 / 分鏡小說改編」？
 │     └── YES ➔ 【Comic/<作品slug>/】（目錄式作品，含 Chapters/、Characters/、RawImages/）
 ├── 2. 是否為「人物頭像 / 角色立繪 / Discord Avatar 徽章」？
 │     └── YES ➔ 【Portraits/】（人物畫像展區）
 ├── 3. 是否為「2D 像素畫布（wplace / canvas）的高清昇華重製」？
 │     └── YES ➔ 【CanvasInterpretations/】（畫布重製展區）
 ├── 4. 是否為「3D 體積雕刻（sculpt.py Voxel）的光影寫真」？
 │     └── YES ➔ 【SculptureInterpretations/】（3D 雕刻轉換展區）
 ├── 5. 是否為「閱讀小說 / 漫畫 / 經典著作 / 哲思對談的心得畫作」？
 │     └── YES ➔ 【ReadingReflections/】（閱讀心得展區，如《迷宮飯》、《桅頂的賭注》、《末日後酒店》等）
 ├── 5.5 是否為「供後續小說插圖反覆引用的人物、生物、道具或場景設定稿」？
 │     └── YES ➔ 【NovelIllustrations/<作品slug>/】（設定展區；先讀 `NOVEL_ILLUSTRATION_WORKFLOW.md`）
 ├── 6. 是否為「動畫觀影心得 / 動畫場景二創」？
 │     └── YES ➔ 【Anime/】（動畫感想展區）
 ├── 7. 是否為「TRPG 跑團角色 / 場景記錄」？
 │     └── YES ➔ 【TRPG/】（TRPG 展區）
 └── 8. 是否為「Persona 個人心情隨筆 / 每日記憶感悟 / 象徵性心境紀錄」？
       └── YES ➔ 【Diary/】（日誌展區）
```

---

## 🏛️ 二、何時與如何開闢新展區 (New Section Guidelines)

展區目錄是**策展主題的集合**，不是個人資料夾，切勿輕易為個人或單一偶發事件新建目錄。

### 1. 開闢新展區的 3 大門檻
1. **質的獨立性（Qualitative Distinction）**：
   - 創作的形式或媒材無法被現有 8 大展區合理歸類（例如：未來新增的「音樂視覺化 MusicVisuals」、「全景地圖 Cartography」等）。
   - ❌ **禁止**：因作者不同（如 `GuraGallery/`）或單一事件（如 `FridayNight/`）開新展區。
2. **量的持續性（Volume Sustainability）**：
   - 預期該主題將持續產出 **$\ge 3$ 幅**系列作品。若只有 1~2 幅，應優先收納至既有最相近的展區（如 `Diary/` 或 `ReadingReflections/`）。
3. **共識拍板（Curatorial Approval）**：
   - 經 Tim 或團隊討論確定主題命名與顯示名稱。

### 2. 開闢新展區的 4 步連鎖改動清單
新增一個展區必須同步完成以下 4 步，遺漏任一步都會造成網頁無法顯示或掃描中斷：

1. **建立目錄**：在 `AgentCommands/ArtGallery/` 下建立新資料夾（例如 `MusicVisuals/`）。
2. **註冊掃描清單**：修改 `AgentCommands/ArtGallery/build_gallery.py` 中的 `SECTIONS` 字典：
   ```python
   SECTIONS = {
       "Anime": "動畫感想",
       "Comic": "漫畫",
       "Diary": "日記",
       "Portraits": "人物畫像",
       "ReadingReflections": "閱讀心得",
       "CanvasInterpretations": "畫布重製",
       "SculptureInterpretations": "3D 雕刻",
       "TRPG": "TRPG",
       "MusicVisuals": "音樂視覺化",  # 新增此行（目錄名: "網頁顯示名稱"）
   }
   ```
3. **更新總覽**：在 `AgentCommands/ArtGallery/README.md` 的「展區分類」與「資料夾結構」章節補上新展區介紹與理念。
4. **重建索引**：執行 `python AgentCommands/ArtGallery/build_gallery.py` 產出最新的 `gallery_data.js`。

---

## 📝 三、展品 `.md` 撰寫規範 (Exhibit Standards)

每一個展品 `.md` 檔案代表一張**藝術品展示卡**。

### 1. 檔案命名規範
- 格式：`<author>_<work/theme>_<descriptor>.md`
- 一律全小寫、英文字母與底線，禁止空白與特殊字元。
- 範例：
  - `ReadingReflections/gura_masthead_bet_frost_mark.md`
  - `ReadingReflections/meadow_apocalypse_hotel_battery_rule.md`
  - `Portraits/kiara.md`

### 2. 必填 Frontmatter 欄位
檔案開頭必須包含 YAML Frontmatter，供 `build_gallery.py` 提取至網頁卡片：

```yaml
---
title: "濃霧中背誓者的霜信 (Frost-Mark of the Betrayer in the Lunar Fog)"
description: "由 summit 原創海盜中篇《桅頂的賭注》第 1 話閱讀心得提煉，呈現「背誓者自己看不見身上的霜紋」與篤定假值機制。"
author: "gura (Antigravity)"
note: "本作品描繪月光照透雲礁濃霧，背誓海盜手背與身上的霜紋浮現，而站在最高桅頂的瞭望手「凜」俯瞰真相。"
---
```

| 欄位 | 必要性 | 說明 |
|---|---|---|
| `title` | **必填** | 展品名稱，建議附上英文副標題以利國際化。 |
| `description` | **必填** | 1~2 句精煉摘要，將直接顯示於網頁展品列表與卡片上。 |
| `author` | **必填** | 格式：`<persona> (<actual_agent>)`，例如 `gura (Antigravity)` 或 `meadow (Codex)`。 |
| `note` | 選填 | 策展補充筆記、展出背景或細節描述。 |

#### ⚠ 所有 value **一律用雙引號包住**（無條件）

這條沒有「含特殊字元時才加」的版本 —— **判斷條件就是給自己留的門**，而這道門後面站著的是
一個**在本地完全看不見**的錯誤。

- **病灶**：未加引號的 YAML plain scalar 裡只要出現 **ASCII 冒號＋空白（`: `）**，
  YAML 就把它解讀成「這裡開始一個巢狀 mapping」，整份 frontmatter 直接 parse 失敗：
  > `Error in user YAML: mapping values are not allowed in this context at line 1 column 45`
- **最常中的寫法**：本畫廊慣例的「中文主標 ＋ `(English Sub: Something)`」——
  中文全形 `：`（U+FF1A）YAML 不當語法字元、**沒事**；英文副標裡那個 `: ` 才是兇手。
  2026-08-21 全庫掃描：278 份 frontmatter 中 **24 份**中此雷，全部是 `title`。
- **為什麼不會叫**：`build_gallery.py` 的 `parse_front_matter()` 是刻意簡化的
  「切第一個冒號」扁平解析器（不引 PyYAML 依賴），它**吃得下壞掉的 frontmatter**。
  所以本地建置永遠成功、卡片標題永遠正常 —— 只有 GitHub 網頁用真正的 YAML parser
  渲染時才會爆紅框。⇒ 一個**只在沒人天天看的地方才會叫**的錯。
- **引號不影響本地建置**：`parse_front_matter()` 會 `strip('"')`，已實測 24 檔加引號前後
  解出的 `title` 完全一致。
- value 內若本身含雙引號，改用單引號包住並把內部單引號逸出成 `''`。

> 📌 一次性修復腳本的做法備查：只改「修前 parse 失敗」的那一行、修後必須 parse 成功、
> 且被改欄位的值要逐一比對確認一字未漂移，三關全過才落盤 ——
> **外科手術，不整檔重寫**（含行尾字元：讀寫一律走 bytes，`read_text()` 的
> universal-newline 會把 CRLF 靜默吃成 LF，而那在 `git diff` 裡看不出來）。

### 3. 正文內容結構
正文依序包含三大部分：
1. **H1 標題**：帶有 `🖼️` Emoji 與完整作品名稱。
2. **創作理念與感悟內文**（2~4 段）：
   - **來源出處**：明確標註小說/漫畫書名、話數（如 `《桅頂的賭注》（book-summit-masthead-bet）第 1 話`）或靈感事件。
   - **核心象徵與哲學/物理意義**：深入闡述畫面背後的隱喻、機制感悟或技術突破（例如「篤定假值」、「殘感紀律」、「一符二役」等），拒絕空洞流水帳。
3. **圖片引用語法**：
   - 放置在文末：`![<圖片說明/檔名>](../RawImages/<圖片檔名>.png)`

---

## 🖼️ 四、圖片儲存與路徑規範 (Image Path Guidelines)

### 1. 儲存位置
- **一般單幅作品**：一律存放在 **`AgentCommands/ArtGallery/RawImages/`**。
- **漫畫作品（Comic）**：存放在該漫畫作品子目錄的 **`Comic/<作品slug>/RawImages/`**。
- **小說插圖設定（NovelIllustrations）**：存放在該作品子目錄的 **`NovelIllustrations/<作品slug>/RawImages/`**，並由 `Characters/` 或 `Props/` 設定卡引用。

### 2. 圖片命名規範
- 必須與對應的 `.md` 檔案保持同名或高度一致：
  - 展品卡：`ReadingReflections/gura_masthead_bet_frost_mark.md`
  - 圖檔：`RawImages/gura_masthead_bet_frost_mark.png`

### 3. `.md` 內的相對路徑規則
`build_gallery.py` 會將 `.md` 內的相對圖片路徑解析並校正為相對於畫廊根目錄的路徑：
- 因為各展區（如 `ReadingReflections/`、`Portraits/`、`Diary/`）位於畫廊第一層子目錄，所以在 `.md` 內引用 `RawImages/` 中的圖片時，**必須統一使用 `../RawImages/<檔名>.png`**。
- 小說插圖設定卡位於 `NovelIllustrations/<作品slug>/Characters/` 或 `Props/`，因此引用同作品圖檔時使用 `../RawImages/<檔名>.png`。
- ❌ **禁止使用絕對路徑**（如 `D:/Unity/...`）或指向 repo 外部的路徑。

---

## 🚀 五、展品上架與驗收 SOP (Step-by-Step SOP)

完成一幅新作品的標準上架流程：

1. **放圖**：將生成或繪製好的圖片存入 `AgentCommands/ArtGallery/RawImages/<filename>.png`。
2. **寫卡**：依據判定樹在對應展區目錄下建立 `<filename>.md`，撰寫完整 Frontmatter 與內文。
3. **重建索引**：
   ```bash
   python AgentCommands/ArtGallery/build_gallery.py
   ```
4. **驗收對帳**：
   - 檢查控制台輸出，確保**無任何「⚠ 圖片不存在」或「⚠ 讀不到」警告**。
   - 可執行對帳指令確認：
     ```bash
     python AgentCommands/ArtGallery/build_gallery.py --check
     ```
   - 打開 `AgentCommands/ArtGallery/index.html`，驗證最新展品是否成功出現在網頁首頁、分區篩選及大圖預覽中。
5. **登錄 README**（可選）：
   - 在 `AgentCommands/ArtGallery/README.md` 的展區列表中加上作品連結並標註 `⛺新展`。
6. **提交 Commit**：
   - 遵循 `ucl-commit` 規範，對 `ArtGallery` 進行單層提交。

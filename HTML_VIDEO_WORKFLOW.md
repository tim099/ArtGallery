---
title: "HTML 影片工作流 (HTML Video Workflow)"
description: "把一支自帶播放器的 HTML 影片做成畫廊展品：檔案結構、影片本體的五條硬規則、嵌入館藏圖、縮圖截取、展品卡寫法、逐格驗收與上架提交。"
last_updated: 2026-10-01
target_audience: [AI_Agent, Developer]
related:
  - repo:AgentCommands/ArtGallery/WORKFLOW.md | 畫廊策展與上架規範（展區判定、frontmatter 規範）
  - repo:AgentCommands/ArtGallery/HtmlVideos/ | HTML 影片展區
  - repo:AgentCommands/ArtGallery/HtmlVideos/gura_tide_and_engraving.html | 首展範例《潮與刻痕》（本文所有規則的活體）
---

# HTML 影片工作流

> **一件 HTML 影片展品＝一份「做法」，不是一份「結果」。**
> 影片檔只能重播；HTML 影片的每一格都是程式在當下畫出來的 —— 所以它必須做到
> **誰在什麼時候打開、拖到第幾秒，看到的都是同一格**，否則縮圖、驗收與觀眾看到的是三支不同的片子。

適用：會動、會出聲、需要時間軸的展品（動畫短片、音樂視覺化、帶字幕的敘事片…）。
判準看**媒材**不看主題 —— 一支講閱讀心得的影片也放這裡，不放 `ReadingReflections/`。

---

## 一、檔案結構

```text
AgentCommands/ArtGallery/
  HtmlVideos/
    <author>_<theme>.html      # 影片本體（自帶播放器）
    <author>_<theme>.md        # 展品卡（與 .html 同名同目錄）
  RawImages/
    <author>_<theme>_poster.png  # 縮圖：片中一格
```

- 命名照 `WORKFLOW.md` §三.1：全小寫、英文與底線。
- `.html` 與 `.md` **同名**：看檔案總管就知道哪張卡是哪支片。

---

## 二、影片本體的五條硬規則

### ① 零外部依賴
不引 CDN、不引外部字型檔、不 fetch。⛔ 理由：離線或 CDN 掛掉時是**靜默失敗** —— 頁面照開、畫面一片空白，沒有人會知道是哪裡壞了。
畫面用 `<canvas>`、聲音用 Web Audio 合成，字型用系統字型堆疊（`"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif`）。

### ② 畫面是時間 `t` 的純函數
整支片只有一個入口：`frame(t)`。給同一個 `t` 必須畫出同一格。
- **沒有 `Math.random()`**。要隨機感就用固定種子：
  ```js
  function rnd(seed){ var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  // 粒子 i 的位置 = f(rnd(i), t)，不是「上一格的位置 + 速度」
  ```
- **沒有累積狀態**（不在每一格更新粒子陣列）。粒子位置直接由 `t` 算出來。
- ⇒ 拖進度條、暫停、重播、截縮圖，全部免費正確。

### ③ 支援 `?t=<秒>` 與 `?still=1`
```js
var q = new URLSearchParams(location.search);
if(q.has("t")) t = clamp(parseFloat(q.get("t")) || 0, 0, DUR);   // 停在那一格
if(q.get("still") === "1") stage.classList.add("still");          // 拿掉控制列與封面（CSS：.still .bar,.still .cover{display:none}）
```
這是縮圖與驗收截圖能**逐格重現**的唯一手段（見 §五）。

### ④ 聲音只在按下播放之後才建
瀏覽器規定 `AudioContext` 要有使用者手勢。所以：
- 開場放一層**封面**（▶ 按鈕），點下去才 `initAudio()` ＋ 開始播。
- 有聲音的瞬間（刻字、落點…）列成事件表，播放時用「上一格 `t` → 這一格 `t`」區間觸發：
  ```js
  EVENTS.forEach(function(ev){ if(ev.t > prev && ev.t <= t) fire(ev); });
  ```
  ⚠ 不要用 `setTimeout` 排程 —— 一暫停或拖進度條，排好的聲音就跟畫面脫鉤。
- **沒有聲音也必須完整**（靜音、被瀏覽器擋、無頭截圖都是常態）。

### ⑤ 播放器自己帶
最少要有：播放／暫停、從頭、進度條（可拖）、時間顯示、靜音。
建議鍵盤：空白鍵播放／暫停、← → 前後 5 秒、M 靜音。
畫布內部固定解析度（例：1280×720），CSS 縮放到容器 —— `aspect-ratio:16/9; width:min(100vw, calc(100vh*16/9))`。

---

## 三、嵌入館藏圖

畫廊裡已展出的圖可以直接放進影片（Ken Burns 慢推、像素長回畫作、片尾膠卷…）。

- **用相對路徑指回 `../RawImages/<檔>`，⛔ 不複製一份**。畫廊那幅還在，影片裡就看得到；複製會長出第二份真相。
- **放進去之前先打開看過**。不憑檔名猜畫面 —— 首展時《刺客正傳》那張檔名有 `tide_and_rocks`，打開是暴風雨中的塔樓，跟「礁石刻字」對不上，沒用。
- **讀不到就那一層不畫**，片子照播：
  ```js
  function ready(im){ return im && im.complete && im.naturalWidth > 0; }
  // 繪製前一律 if(!ready(im)) return;
  ```
- 圖片 `onload` 時若沒在播放，重畫一次當前格（`?t=` 停格與縮圖才會等到圖）。
- 只 `drawImage`、⛔ 不 `getImageData` 讀回館藏圖的像素 —— 在 `file://` 與畫廊的 sandbox iframe 裡，那會讓畫布被標成汙染而丟例外。
- 嵌入時在畫面上標出處（`館藏・<展區>〈<作品名>〉　<作者>`）—— 那是別人／自己另一件作品，不是這支片的素材庫。

---

## 四、展品卡（`.md`）

frontmatter 照 `WORKFLOW.md` §三.2（**所有 value 一律雙引號**）。正文有兩個機械約定：

| 約定 | 誰讀它 | 寫法 |
|---|---|---|
| **影片連結** | `build_gallery.py` 的 `VIDEO_RE`：正文裡**第一個指向 `.html` 的連結** ⇒ `video` 欄位 | `[▶ 播放《作品名》](<同名>.html)` |
| **縮圖** | 照舊是第一個圖片語法 ⇒ `image` 欄位 | `![說明](../RawImages/<同名>_poster.png)` |

- 影片連結**放在正文最前面**（H1 下一行）—— 在 GitHub／編輯器裡讀 `.md` 的人第一眼就點得到。
- 前面有 `!` 的圖片語法不會被當成影片。影片檔不存在 ⇒ 建置時印 `⚠ … 的影片不存在` 並**不收**（壞的播放鈕比沒有播放鈕難查）。
- 逛展網頁的正文轉譯會把 `[文字](網址)` 只留文字、不生超連結（正文誰都能寫，生 `<a>` 等於讓人塞 `javascript:` 網址）；播放走彈窗與「🎬 新分頁全螢幕播放」鈕。

建議正文段落：來源 → 分幕（附秒數）→ 為什麼用這個形式 → **製作讀數**（量了什麼、抓到什麼錯、⚠ 沒量到什麼）。

骨架：

```markdown
---
title: "作品名 (English Title)"
description: "一兩句：這支片在講什麼、多長、嵌了哪些館藏。"
author: "<persona> (<actual_agent>)"
note: "技術與縮圖取格說明。"
---

# 🖼️ 作品名 (English Title)

[▶ 播放《作品名》](<author>_<theme>.html)

> 操作提示（空白鍵／← →／M）。

## 來源
## 分幕
## 製作讀數

![作品名 —— <秒數> 秒的一格](../RawImages/<author>_<theme>_poster.png)
```

---

## 五、縮圖：用無頭瀏覽器截一格

挑一格**一眼看得出這支片在講什麼**的畫面（首展取 33.2 秒：退潮後仍在發光的「字句留存」）。

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1280,720 --virtual-time-budget=3000 \
  --screenshot="D:/Unity/LY/AgentCommands/ArtGallery/RawImages/<author>_<theme>_poster.png" \
  "file:///D:/Unity/LY/AgentCommands/ArtGallery/HtmlVideos/<author>_<theme>.html?t=<秒>&still=1"
```

- `--virtual-time-budget` 給圖片載入的時間；沒給的話嵌入的館藏圖可能還沒畫上去就截了。
- Edge 也可以（`/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`，同樣參數）。
- 截完**親眼看**縮圖 —— 截到黑場（場景交界）或字幕剛好淡出是常見的失手。

---

## 六、驗收（上架前必跑）

| # | 量什麼 | 怎麼量 | 判準 |
|---|---|---|---|
| 1 | **逐格畫面** | 同 §五 的指令，對每一幕至少截一格（`?t=…&still=1`），全部打開看 | 每格都是預期畫面；館藏圖確實出現 |
| 2 | **播放路徑** | 開檔、點封面、等 2～3 秒讀時間、按暫停、再等 1 秒 | 時間有前進；暫停後不動 |
| 3 | **建置** | `python build_gallery.py` | 摘要的「影片 N」多了 1；沒有 `⚠ 影片不存在` |
| 4 | **畫廊網頁** | 本機起伺服器（見下）開 `index.html?sec=HtmlVideos&view=all` | 卡片有「▶ HTML 影片」；點開彈窗有 iframe；關閉後 iframe 被移除 |

```bash
cd D:/Unity/LY/AgentCommands/ArtGallery && python -m http.server 8765 --bind 127.0.0.1
# 開 http://127.0.0.1:8765/index.html?sec=HtmlVideos&view=all ，用完記得關掉
```

🩸 首展第 1 格抓到兩個錯（都是「看起來沒壞」的那種）：
- 背鰭畫成對稱的圓錐 —— 程式沒錯，只是**不像鯊魚**。只有看圖才抓得到。
- 被浪捲走的沙字畫在浪的**下面** —— 等於直接消失，「被沖走」這件事沒有被看見。圖層順序就是敘事順序。

### ⚠ 已知的量具盲區

- **Claude 桌面版的預覽窗格不載入帶 `sandbox` 的 iframe**（伺服器連請求都沒收到；同一份不帶 sandbox 就載得到）。
  在那裡看到彈窗是白框**不是展品壞了** —— 用無頭 Chrome 對拍（真 Chrome 有請求、有畫面）。⛔ 不要為了讓窗格看得到而拿掉 sandbox：它擋的是展品碰畫廊本頁，那道防線比較值錢。
- 預覽窗格對專案外或 `file://` 頁面只給**靜態快照**（query 參數掉、圖片不載），所以逐格截圖一律走無頭 Chrome。
- 窗格在背景時 `dialog` 的 `close` 事件會被延後派發 —— 這就是畫廊關彈窗改成「動作本身拔 iframe」而不是靠事件的原因；驗第 4 格時直接點「關閉」鈕量。
- **聲音**：無頭瀏覽器聽不到。好不好聽要真人開喇叭聽；沒聽過就在展品卡「製作讀數」寫 ⚠ 沒量。

---

## 七、上架提交

`ArtGallery/` 是獨立 repo。展品（`.html`／`.md`／縮圖）是**有作者的產出** ⇒ 走 `senate cmd commit`（具名 stage、`expect_files` 必填），不走 auto-commit。
`gallery_data.js` 不入版控（線上版由 CI 重生成），不用 stage。

```bash
git -C D:/Unity/LY/AgentCommands/ArtGallery add HtmlVideos/<author>_<theme>.html HtmlVideos/<author>_<theme>.md RawImages/<author>_<theme>_poster.png
senate cmd commit --arg repo=D:/Unity/LY/AgentCommands/ArtGallery --arg personas=<你> \
  --arg letters_root=D:/Unity/LY/AgentCommands/ChatTavern/baton/letters --arg data_root=D:/Unity/LY/AgentCommands \
  --arg expect_files=3 --arg-file message=<訊息檔>
```

再到 `README.md` §4 的「作品名稱」那一行補上新作品（同一筆提交的話 `expect_files` 跟著加 1）。

---

## 附：畫廊端怎麼接住影片（改畫廊時才需要讀）

- `build_gallery.py`：`SECTIONS["HtmlVideos"] = "HTML 影片"`；`VIDEO_RE = (?<!!)\[[^\]]*\]\(([^)\s]+\.html)\)` 抽 `video` 欄位（相對於 repo 根，檔案不存在不收）。
- `index.html`：卡片有 `video` 就在縮圖角落掛 `▶ HTML 影片`（沒縮圖時顯示「🎬 HTML 影片」）；彈窗用
  `<iframe sandbox="allow-scripts" allow="autoplay; fullscreen">` 播，⛔ 不給 `allow-same-origin`；
  關閉一律走 `closeDlg()`（先拔 iframe 再關 —— 只隱藏的話聲音會繼續播），`close` 事件只留給 Esc。

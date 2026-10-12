---
title: "HTML 遊戲工作流 (HTML Game Workflow)"
description: "把一份可以玩的 HTML 做成畫廊展品：檔案結構、遊戲本體的硬規則（零依賴、固定步長＋種子、網址參數）、用雕刻作品當素材（VoxelKit）、縮圖、展品卡、驗收與上架。"
last_updated: 2026-10-12
target_audience: [AI_Agent, Developer]
related:
  - repo:ArtGallery/WORKFLOW.md | 畫廊策展與上架規範
  - repo:ArtGallery/HTML_VIDEO_WORKFLOW.md | HTML 影片（播放器、館藏圖、縮圖指令的出處）
  - repo:ArtGallery/VoxelKit/README.md | 雕刻作品進 HTML（匯出、封裝、瀏覽器端）
  - repo:ArtGallery/HtmlGames/ame_constitution_broadside.html | 首展《憲法號對轟》（本文規則的活體）
---

# HTML 遊戲工作流

> **一件 HTML 遊戲展品＝一份可以玩的 HTML。** 它跟影片的差別是沒有固定的時間軸：畫面由玩家的輸入決定。
> 所以「縮圖、驗收、觀眾看到的是同一格」這件事，要靠**固定步長的模擬＋有種子的亂數**換回來。

判準看**媒材**：會接玩家輸入、能分出結果（勝負、分數、破壞程度）的放這裡；只能播的放 `HtmlVideos/`。

## 一、檔案結構

```text
ArtGallery/
  HtmlGames/
    <author>_<theme>.html          # 成品（單檔，全部內嵌）
    <author>_<theme>.md            # 展品卡（同名同目錄）
    _build/<author>_<theme>/       # 開發用：template.html、遊戲 .js（可照功能分成 js/*.js）、README.md（怎麼重產）
  RawImages/<author>_<theme>_poster.png
  VoxelKit/                        # 用雕刻作品當素材時共用（見 VoxelKit/README.md）
```

- 命名照 `WORKFLOW.md` §三.1：全小寫、英文與底線。
- `_build/` 底下是開發用的分檔；成品由 `VoxelKit/vxk_inline.py` 一次塞成單檔。遊戲本體大了就照功能分檔：每檔一個 `<script src="js/…" data-bundle="game">`，`vxk_inline.py` 把同一個 bundle 照順序接成一段、包進同一個閉包（共用變數、不掛到 window）—— 拆檔不改語意。`build_gallery.py` 不掃 `_build/`（底下沒有展品卡）。

## 二、遊戲本體的硬規則

### ① 零外部依賴
同 HTML 影片：不引 CDN、不 fetch、不引外部字型。開發時分檔，出貨前跑 `vxk_inline.py`，它會在寫檔前檢查成品沒有外部 `src`／`fetch`／`import`／http(s) 資源，有就不寫。

### ② 模擬：固定步長＋種子亂數
- 模擬一律用固定步長（例：1/60 秒）推進；畫面跟著 `requestAnimationFrame` 走，一格畫面推進 0～數步模擬。
- **會影響模擬的亂數**一律用有種子的產生器（`?seed=` 可指定）；`Math.random()` 只准用在不回寫模擬的地方（音效）。
- ⇒ 同一個種子、同樣的輸入，在同一個瀏覽器裡每次走出同一局。

### ③ 網址參數

| 參數 | 做什麼 |
|---|---|
| `?demo=<秒>` | 不出選單、電腦自己玩，固定步長快轉到那一秒停住（縮圖與驗收用） |
| `?seed=<n>` | 亂數種子 |
| `?still=1` | 拿掉 HUD、選單、說明（CSS：`.still .hud{display:none}`） |
| `?cam=<名>` | 預設鏡頭（每支遊戲自己定義，寫進 `_build/README.md`） |
| `?debug=1` | 顯示讀數，並開 `window.__game` 測試入口（手動推進模擬、開火、讀狀態） |

### ④ 聲音只在按下開始之後才建
同 HTML 影片 §二④：`AudioContext` 要使用者手勢；`?demo` 不出聲；沒有聲音也完整。

### ⑤ 操作自己帶
開始畫面寫玩法；`H` 開關說明；滑鼠＋鍵盤。⛔ 不用 pointer lock（畫廊的 iframe 只開 `allow-scripts`）。進遊戲時把焦點從「開始」按鈕移開 —— 不然玩家按空白鍵會再按一次開始。

### ⑥ 量具盲區：視窗在背景時模擬會停
`requestAnimationFrame` 在分頁或預覽窗格不在前景時會被暫停。⛔ 不要把「畫面沒動」當成壞了：驗收用 `?debug=1` 的 `window.__game` 手動推進，或用無頭 Chrome 截 `?demo=` 那一格。

## 三、用雕刻作品當素材

走 `VoxelKit/`（說明在 [VoxelKit/README.md](VoxelKit/README.md)）：`voxel_export.py` 匯出成 `.vxk` → 遊戲用 `voxelkit.js` 解碼、網格化、算繪 → `vxk_inline.py` 內嵌。

- **1:1**：不降採樣；格數與色值跟 `senate cmd sculpture op=export format=list` 逐格相同。
- **反向對照放在載入畫面**：解碼後算 checksum 跟封裝檔 header 比，對得上才開放開始；對不上就停下來說明（⛔ 不畫半艘船）。
- 素材是別人的作品 ⇒ 展品卡「來源」段寫作者、作品 id、匯出時的關聯版本（`.vxk` header 的 `source`）。

## 四、展品卡（`.md`）

frontmatter 照 `WORKFLOW.md` §三.2（value 一律雙引號）。機械約定同 HTML 影片：

| 約定 | 誰讀它 | 寫法 |
|---|---|---|
| **遊戲連結** | `build_gallery.py` 的 `VIDEO_RE`：正文裡第一個指向 `.html` 的連結；`HtmlGames/` 的另外標 `game` | `[🎮 開始玩《作品名》](<同名>.html)` |
| **縮圖** | 第一個圖片語法 | `![說明](../RawImages/<同名>_poster.png)` |

建議正文段落：玩法（操作表）→ 來源 → 模擬怎麼做 → 製作讀數（量了什麼、抓到什麼錯、⚠ 沒量到什麼）。

## 五、縮圖：無頭 Chrome 截 `?demo=` 那一格

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --hide-scrollbars \
  --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1280,720 --virtual-time-budget=60000 \
  --screenshot="<ArtGallery>/RawImages/<author>_<theme>_poster.png" \
  "file:///<ArtGallery>/HtmlGames/<author>_<theme>.html?demo=<秒>&still=1&cam=<名>"
```

- WebGL 遊戲要 `--use-angle=swiftshader --enable-unsafe-swiftshader`（無頭沒有 GPU）；`--virtual-time-budget` 給快轉的時間。
- 同一個 `?demo` 截兩次應逐位元組相同 —— 不同就是模擬裡還有沒走種子的亂數。
- 截完**親眼看**。

## 六、驗收（上架前必跑）

| # | 量什麼 | 怎麼量 | 判準 |
|---|---|---|---|
| 1 | **載入對拍** | 開 `?debug=1`，讀載入畫面那一行（或 `window.__vxk`） | 格數與 checksum ＝ 封裝檔 header |
| 2 | **玩一輪** | `window.__game` 推進：開火、命中、破壞、勝負各走到一次 | 讀數有動；被打的那一份改了，另一份沒動 |
| 3 | **可重現** | 同一個 `?demo` 截兩次 | 逐位元組相同 |
| 4 | **建置** | `python build_gallery.py` | 摘要的「遊戲 N」多 1；沒有 `⚠ 影片不存在` |
| 5 | **畫廊網頁** | 本機伺服器開 `index.html?sec=HtmlGames&view=all` | 卡片標「🎮 HTML 遊戲」；彈窗 iframe 載入成品 |
| 6 | **真 GPU** | 一般瀏覽器開成品，讀主控台 | 沒有著色器編譯錯誤（無頭的軟體算繪抓不到 D3D11 的錯） |
| 7 | **sandbox 裡跑得動** | 在畫廊伺服器底下暫放一頁 `<iframe sandbox="allow-scripts" src="HtmlGames/<名>.html?demo=<秒>&still=1">`，無頭 Chrome 截它（加下面兩個旗標），截完刪掉那一頁 | 跟縮圖逐位元組相同 |

### ⚠ 已知的量具盲區

- **預覽窗格不載入帶 `sandbox` 的 iframe**（同 HTML 影片 §六）：彈窗是白框不代表展品壞了。
- **無頭 Chrome 的虛擬時間推不動 sandbox iframe**：sandbox 讓 iframe 變成不透明來源、跑在另一個行程，`--virtual-time-budget` 不等它 ⇒ 截到的是停在「載入中」的那一格。對拍時加 `--disable-site-isolation-trials --disable-features=IsolateOrigins,site-per-process` 讓它跑在同一個行程。⛔ 不要為了截圖拿掉 sandbox。
- **外框頁要跟畫廊同源**：用 `data:` 網址當外框去嵌 `127.0.0.1` 會被 Chrome 的私有網路保護擋掉（錯誤頁），那是外框的問題，不是展品的。

## 七、上架提交

`ArtGallery/` 是獨立 repo；展品是有作者的產出 ⇒ `senate cmd commit`（具名 stage、`expect_files` 必填）。
一起 stage：成品 `.html`、展品卡 `.md`、縮圖、`_build/<author>_<theme>/` 底下的源檔；動到 `VoxelKit/` 的也一起。
再到 `README.md` 的「HTML 遊戲展區」補上新作品。`gallery_data.js` 不入版控。

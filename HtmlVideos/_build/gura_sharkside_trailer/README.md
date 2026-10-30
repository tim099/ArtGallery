# 方舷放置 Sharkside 宣傳片 — 建置框架

框架移植自 kaguya 的 Blockside 宣傳片（`../kaguya_blockside_trailer/`：splice.py、director.js、overlay.js、audio.js、shell.html）。
成品：`../../gura_sharkside_trailer.html`（單檔、零外部依賴：核心＋要用的船＋美術全部內嵌）。

## 建置

```bash
cd D:/Unity/Valhalla/ArtGallery/HtmlVideos/_build/gura_sharkside_trailer
python -I splice.py D:/GameDev/Blockside-wt/gura-idle/index.html D:/GameDev/Blockside-wt/gura-idle/ships art.json ../../gura_sharkside_trailer.html --hulls pinas,ember,flyingfish,labelle,constitution,swallow,dromon,reale,virginia,monitor,tridente,cosecha
```

- 核心：gura-idle worktree 的 `index.html`（拆檔成品，核心指紋 `3d482e859eb7c94b`）。⛔ 只讀：不在那裡建置、不跑 admin.py。
- 船：照 `scenes.js` 裡的 `hull: '<船型>'` 字樣內嵌 `ships/ship-<id>.js`（雜湊要跟成品的 vxk-ships 清單一致）；清單只留內嵌的那幾艘。
  用變數組出來的船型找不到 ⇒ 加 `--hulls a,b`。
- 美術：`art.json` 的 `img`（鍵 ⇒ `root` 底下的路徑；先找 .webp、沒有找 .png）⇒ `TR_IMG_SRC`，場景用 `trImg(鍵)`／`trPic(g, 鍵, …)` 畫。
- 每一步對不上就停（錨點不是剛好一次、雜湊不符、撞名、外部依賴…），不寫輸出檔；輸出先寫 `.tmp` 再換名。需要 `node`（語法檢查）。

## 網址參數

| 參數 | 作用 |
|---|---|
| `?t=<秒>&still=1` | 停在那一秒、不顯示播放器（截圖）；到了 ⇒ `document.title = 'READY <t>'` |
| `&debug=1` | `window.__tr`（seek／hash／state／scenes／placed／ships／imgs／load／ev）；READY 時標題帶戰局雜湊、寫 `<pre id="trDbg">` |
| `?res=1080` | 3D 畫面 1920×1080（預設 1280×720；字幕層一律 1920×1080） |
| `?gfx=low\|mid\|high\|ultra` | 畫質（預設 high） |

截圖、對拍：無頭 Chrome（`--use-angle=swiftshader --enable-unsafe-swiftshader`，或用顯示卡 `--use-angle=d3d11`）。
`--virtual-time-budget` 有時在船還沒載好就到時間 ⇒ 用 CDP 等 `window.__trReady` 比較穩。

## 跟 kaguya 那一版不一樣的地方

- 這份檔永遠是宣傳片（`var TRAILER = true`）：核心不是放置遊戲 ⇒ 沒有 `?play`；「▶ 立即遊玩」開線上的 https://tim099.github.io/Sharkside/（新分頁；畫廊彈窗裡改提示）。
- 擺位：核心的 `reset()` 走 `spawnSteps`（kaguya 覆寫的 `spawnFleet` 沒人叫 ⇒ 她那一版擺位沒生效）⇒ 包 `spawnSteps`＋`makeShipSteps`，`sc.fleet[].x/z/yaw` 從造船那一步就照它擺，並清掉畫面內插的上一步。
- 步長鎖 30 Hz（`PHX.step = 1`，開機與每一幕都鎖）；`BED_SLICE`、`CORE_JUDGE` 關；音效帶第四個參數；cues 照 `at` 排序、在 `trSeeded` 裡跑；配樂匯流排缺了就建；每格叫核心的 `sndGc`、`burnSndFrame`。
- 新增 `TR_API`（核心 `shapiMake()`）、`trRng`／`trSeeded`（Math.random 照每一幕的種子）、`trBite`／`trShot`／`trBlast`、`trImg`／`trPic`。
- 拿掉：城鎮、旱地行舟、金角灣巨鏈、海圖內嵌（`sc.map` 不支援；要海圖照 kaguya 的 `trBedOn`＋`trailer_maps()` 補回來，並處理樹的排隊）、科普插圖、年代軸、錄影（record.*，之後再移植）。

## 署名

- 宣傳片框架：kaguya（Blockside 宣傳片，2026-10-18～28）；Sharkside 版的移植：gura 的宣傳片工作。
- 海戰核心與船：Blockside（ame 與每一艘船的雕刻者；船的作者見核心 game-config 的 `ships[].author`，片中每位雕刻者署名一次）。
- 美術：Sirius（Codex）；吉祥物叫莎夏（Sasha）。
- 配樂：核心 02_music.js 的公有領域曲子（〈酒醉的水手〉：Terry, *The Shanty Book I*, 1921）。

## 分鏡與方舷放置的畫面（gura）

- `scenes.js`：十三幕（開場 → 片名 → 咬一口 → 放置 → 結算商店 → 軍火箱 → 海區三幕 → 黃金寶船 → 巨齒鯊 → 亞特蘭提斯 → 片尾），配樂表 `TR_SCORE`。船用 `ship()` 組 ⇒ 字面沒有 `hull: '…'` ⇒ 建置一定要帶上面的 `--hulls`。
  - 咬（`trScene` 的 `bites`）照「這一刻的鏡頭在哪一舷」挑那一舷（`trSideFor`），記下咬到的點給字幕層畫嘴；cue 照片長秒排（`trTauU`）。
  - 帆段：0 全收、1 收帆、2 戰鬥帆、3 滿帆（核心 31_sailing.js SAILSETS）⇒ 預設 3。鏈彈要從船頭前方縱射（方帆橫在船上，從側面打會貼著帆面滑過）。
- `sharkfx.js`：遊戲裡是 DOM／CSS 的那些（咬一口的上下顎、飄字、連咬、蓄力條、資源列、強化卡、莎夏的對話框、海區橫幅、巨齒鯊、漂流寶物）照同樣的樣子畫在字幕畫布上 —— 全是 u 的純函數、錄影錄得進去。
- 沒有「免費幕」⇒ 開機時十二艘全部載好、熱身完才出封面（約 26 秒；⛔ 只先載第一幕 ⇒ 播到軍火箱、海區要停下來等船）。

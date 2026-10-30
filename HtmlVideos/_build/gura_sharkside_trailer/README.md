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
- 拿掉：城鎮、旱地行舟、金角灣巨鏈、海圖內嵌（`sc.map` 不支援；要海圖照 kaguya 的 `trBedOn`＋`trailer_maps()` 補回來，並處理樹的排隊）、科普插圖、年代軸。

## 錄成影片（record.sh；Tim 2026-10-30「參考 trailer.sh 也加一個工具可以直接把宣傳片輸出成影片吧」）

```bash
./record.sh
```

⇒ `~/Videos/Sharkside/sharkside-trailer-1080p60-<日期>-<時間>.mp4`（H.264 High ＋ AAC-LC 192 kbps；YouTube、手機、噗浪都收）。**不要用螢幕錄影**（會掉格、載船時會停）。

- 參數：`--fps 60|30`、`--from 14 --to 20`（只錄那一段，片長秒）、`--ss 1.5`（3D 照幾倍算再縮成 1920×1080；1 ＝ 不超取樣、試錄快）、`--gfx ultra`（預設全開；畫廊播放是 high）、
  `--out <資料夾>`、`--name <檔名>`、`--vbr <bps>`（預設 寬×高×fps×0.17 ≈ 21 Mbps）、`--chrome <路徑>`、`--port 8871`、`--no-launch`（只印網址，自己開）、`--help`。
- 錄的是畫廊那一份成品（`../../gura_sharkside_trailer.html`）⇒ 改了 scenes.js 之類的，先照「建置」重建成品再錄。
- 會開一個 Chrome 視窗（暫時的設定檔、背景不降速）：可以蓋住，⛔ 別最小化、別關；進度每 5 秒片長印一行；Ctrl+C ⇒ 全部收掉。
- 檔案：`record.sh`（捷徑）→ `record.py`（把 `mp4.js` ＋ `record.js` 注入成品的一份複製、開本機伺服器、開 Chrome、收檔、讀回 MP4 的軌與時長）。
  `record.js` 移植自 kaguya 的 record.js；`mp4.js` 照抄 Blocksail 的 trailer/mp4.js（⛔ 注入在 strict 的核心閉包裡 ⇒ 結尾是 `})(window)`，`this` 會是 undefined）。畫廊那一份不帶錄影程式。
- 怎麼做到不掉格：片子是片長 t 的純函數 ⇒ 一格一格算到 t ＝ from ＋ k／fps、畫好、把 3D 畫布與字幕層疊成 1920×1080 交給 WebCodecs；一格算多久都沒關係。
  聲音：畫面那一遍只記事件（音效、雷聲：片長秒、種類、音量、離鏡頭多遠、第四個參數；環境音、延燒的火：每一格的參數），畫完把配樂、音效、環境音、火全部照時刻排進一個
  OfflineAudioContext（核心的 initAudio 建在它上面：同一個限制器）離線算完 ⇒ 軟限幅（膝點 0.81、上限 0.95：限制器是壓縮器，重拍的頭會衝過 1）⇒ AAC。
  ⛔ 不用 kaguya 那種即時 1 倍速重播：每格對環境音參數 setTargetAtTime 會跟音訊執行緒搶鎖（核心 02_ambient.js TASK-0905），主執行緒整個停 1～3.9 秒 ⇒ 音效晚排、配樂音符被跳過。
  ⛔ 排程的時候要把核心的 sndGc 停掉：sfxPlay 每一聲先叫它、照（代理成那一聲時刻的）AC.currentTime 拆「放完的」出口 ⇒ 還沒開始算就把前面的配樂拆光（第一版離線開場的 drone 整段不見）。
  美術第一次用到才解碼 ⇒ 那一格等解好、同一個 t 重畫（讀數「等美術解碼重畫 N 格」）。
- 量過（2026-10-30，這台機器、Chrome 視窗）：
  - 12 秒試錄（`--from 0 --to 12 --ss 1`，即時重播那一版）：畫面一秒約 47 格、51 秒錄完；720 格全解得出來、沒有重複格；配樂的重拍落在排的時刻。
  - 離線聲音 20 秒（`--to 20 --ss 1`）：離線算 8.6 秒；前 12 秒每 0.1 秒的 RMS 跟上面那支即時的並排，平均差 0.27 dB。
  - 整支（`./record.sh` 預設）：7 分 1 秒錄完（畫面 1.7 分、聲音離線算 4.7 分：火與雨滴的節點多，跟 kaguya 量的一樣不是線性）、252.8 MB；OpenCV 解出 5880 格、60 fps（同一份畫面在前一支量的：6 格重複 ＝ 古代海區的前導字卡、黑格都在淡入淡出）；Chrome decodeAudioData 98.0 秒、峰值 0.899、每秒 RMS −10～−13 dB 沒有空洞、削波 0。
- 驗：`python -I` ＋ OpenCV（`cv2.VideoCapture`）解格數、存幾格看；聲音用 Chrome `decodeAudioData` 量每 0.1 秒的 RMS。⛔ 內建瀏覽器的窗格藏著時 `<video>` 不會 seek（抽不到格子）。

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

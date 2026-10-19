# 路易十四的法蘭西（1694 皇家號 La Réale）—— 選曲與改編（TASK-0718）

選了一首：**夏龐蒂埃《感恩讚》H.146 的前奏曲**。照作曲者親筆手稿的掃描逐音轉，再拿一份公有領域的打譜版逐音對照（第 1–17 小節）。盧利的進行曲沒做，原因寫在最後「備案」。

## tedeum —— 感恩讚前奏曲

| 欄 | 內容 |
|---|---|
| id | `tedeum` |
| 中文名 | 感恩讚前奏曲 |
| 原名 | *Te Deum*, H.146 — *Prélude*（手稿寫「Te Deum」、樂章「Prelude」，旁註「Rondeau bis au commencement et à la fin」） |
| 作曲／年代 | 夏龐蒂埃（Marc-Antoine Charpentier，1643–1704），約 1688–1698（BnF 目錄說是 1691–1692 年抄進第 10 冊）。夏龐蒂埃當時在巴黎耶穌會的聖路易教堂當樂長。一般說這首是為路易十四打勝仗的慶典寫的，最常見的說法是 1692 年斯坦凱爾克之役，但這點沒有定論 |
| 公有領域 | 作曲者 1704 年過世。我們直接從 1690 年代的親筆手稿轉，沒有經過任何現代版本，所以不牽涉編者的權利。⚠ **跟 README 字面不一樣的地方**：這首當年沒有印，1953 年才被重新發現，1957 年起才有印刷版，所以不是「1900 年前出版」。旋律本身早就是公有領域：作曲者過世三百多年，歐盟「首次出版」那 25 年的權利 1980 年代也到期了。只是它的來源是手稿，不是 1900 年前的印刷版。要不要照字面嚴格執行，請 Tim 拍板（備案在最後） |
| 驗證用的來源 | 見下面「怎麼驗證的」 |
| 為什麼適合這一章 | ① 同一個年代、同一個宮廷：皇家號 1694 年下水的時候，這首正好是那幾年寫的路易十四慶功感恩讚。② 號角加定音鼓就是法國宮廷典禮的聲音，槳帆船的儀式也用號角和鼓。③ 前奏曲的 Rondeau 就是歐洲廣播聯盟（Eurovision）的片頭曲，觀眾一聽就知道是「太陽王的法國」。④ 拍號 2、四分音符一步一步走的進行曲步伐，配一整排槳一起划剛好 |

### 怎麼驗證的

- **主來源（照它轉）**：親筆手稿 BnF, Musique, **Rés. Vm1 259 (10)**（*Mélanges autographes* 第 10 冊）**p.154**（另一套編號是 ff.73v–85），Gallica `ark:/12148/btv1b550082275`。實際看的是 Wikimedia Commons 上同一份 Gallica 掃描的原尺寸圖（3224×5124）：
  `https://commons.wikimedia.org/wiki/File:Mélanges_autographes_-_volume_10_(manuscrit_autographe)_-_Marc-Antoine_Charpentier_-_btv1b550082275_(152_of_185).jpg`
  Gallica 網站本身要先過 Cloudflare 的真人驗證，IMSLP 的手稿 PDF（#440359）要先按免責聲明，這兩個我都沒點。
- **讀法**：號角和第一部提琴用法式小提琴譜號（G 譜號在第一線），低音和定音鼓用 F 譜號（第四線）。調號兩個升記號（F♯、C♯），D 大調，拍號「2」。音高靠譜號和五線的位置對準（例如已知的 D5 落在第三線、G2 落在第五線）。逐音讀過的範圍：
  - 第一行：號角（trompettes）弱起＋8 小節、定音鼓（Timballes et basse de trompette）弱起＋8 小節、低音（orgue et viol[on]s et bassons）弱起＋8 小節。
  - 第一段插曲（1er couplet）：第一行反覆記號後面那一小節（弱起＋第 1 小節），加上第二行第一部（viol[on]s et inst[rument]s à vent）7 小節，一直到「rondeau une fois comme au commencement」。第二行的低音（viol[on]s et orgue et bassons）也是這 8 小節。
- **對照（只拿來核對，沒有照抄）**：Wikimedia Commons 的 `File:Charpentier Te Deum Prélude.pdf`（Kickton 打譜、移到 C 大調，Commons 標公有領域）。把它的第 1–17 小節移高大二度後逐音對：號角第 1–9 小節、第一部提琴第 9–17 小節、通奏低音第 1–17 小節，**全部一樣，只有一處不同**：
  - 插曲第 1 小節第 2 拍，低音那兩個八分音符：手稿的音頭在 C4 加線上方，看起來是 E4–D4；Kickton 版是 D4–C♯4。那一拍旋律是 D5，內聲部是 D 和弦，用 E4 的話拍頭會跟 D5 撞成七度，所以取 D4–C♯4（八度加經過音）。這一點也寫進 src 了。
- 解讀手稿的反覆：Rondeau 結尾那一小節只有 3 拍（D 附點二分音符），第 4 拍是插曲的弱起（提琴 A–G、低音 C♯）。插曲最後一小節低音是 A 加 6 個八分音符，最後一拍的 F♯–E 跟號角回來的弱起 A 疊在一起，Kickton 版也是這樣寫。

### ABC（THEMES 格式，`abc` 一行一個字串）

```js
{ id: 'tedeum', name: '感恩讚前奏曲', en: 'Te Deum, H.146: Prélude',
  src: '夏龐蒂埃（Marc-Antoine Charpentier, 1643–1704）《感恩讚》H.146 前奏曲（約 1690 年代）—— 照作曲者親筆手稿（BnF Rés. Vm1 259（10），Mélanges autographes 第 10 冊 p.154；Gallica btv1b550082275）轉：旋律 ＝ 號角（Rondeau）／第一部提琴（第一段插曲），低音 ＝ orgue et violes et bassons，定音鼓 ＝ Timballes 那一行。改編：手稿的 Rondeau（頭尾各奏兩次）＋兩段插曲 ⇒ Rondeau 一次＋第一段插曲＋Rondeau 一次（刪 Rondeau 的反覆、第二段插曲）；最後一小節的 D 拉滿一整小節、漸慢收尾；顫音記號不奏；插曲第 1 小節第 2 拍低音取 D／C♯（手稿音頭看起來高一格；照和聲、跟 Kickton 版一樣）；配器：號角 trumpet、插曲提琴、低音管風琴（手稿寫 orgue）、定音鼓 timpani',
  abc: ['M:2/2', 'L:1/8', 'Q:1/4=112', 'K:D', 'V:1', 'V:2', 'V:3',
    '% 手稿：BnF Rés. Vm1 259（10）p.154；拍號 2（兩個二分音符）、D 大調',
    '% 照手稿的反覆：Rondeau（號角＋定音鼓＋全體）→ 第一段插曲（1er couplet：弦樂＋木管；號角、鼓休息）→ Rondeau；手稿的 Rondeau bis（頭尾各兩次）、第二段插曲刪掉',
    '% --- Rondeau：號角（弱起 A）---',
    '[V:1] [I:trumpet] !mf! A2 | d2 de f2 d2 | a4 f3 f | g2 ag fg a2 | edef e2 A2 | d2 de f2 d2 | a4 f3 f | gafg e3 d | d6 [I:fiddle] !mp! ag |',
    '[V:2] [I:organ] !mf! D,2 | D,4 D,2 D,2 | C,2 A,,2 D,3 D, | G,,2 G,,2 D,E, F,G, | A,4 A,G, F,E, | D,4 D,2 D,2 | C,2 A,,2 D,3 D, | G,2 D,2 A,2 A,,2 | D,6 C,2 |',
    '[V:3] [I:timpani] !mp! D,2 | D,2 D,D, D,2 D,2 | A,,2 A,,A,, D,2 D,D, | D,2 D,D, D,D,D,D, | A,,4 A,,2 D,2 | D,2 D,D, D,2 D,2 | A,,2 A,,A,, D,2 D,D, | D,D,D,D, A,,2 A,,A,, | D,6 z2 |',
    '% --- 1er couplet：提琴（手稿 violons et instruments à vent 的第一部）；最後一拍號角接回 Rondeau 的弱起 ---',
    '[V:1] f2 d2 g2 gf | e3 d c2 f2 | e2 de c2 f2 | d3 c B2 b2 | b2 a2 a3 g | f3 e de f^g | a3 b ^g3 a | a6 [I:trumpet] !mf! A2 |',
    '[V:2] D,2 DC B,2 G,2 | A,4 A,2 D,2 | E,2 E,2 F,2 F,,2 | B,,4 B,,2 G,,2 | A,,2 A,,B,, C,2 A,,2 | D,4 D,2 D,2 | C,2 D,2 E,2 E,,2 | A,,2 A,G, F,G, F,E, |',
    '[V:3] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z6 D,2 |',
    '% --- Rondeau（一次）；最後一小節 D 拉滿一整小節收尾 ---',
    '[V:1] d2 de f2 d2 | a4 f3 f | g2 ag fg a2 | edef e2 A2 | d2 de f2 d2 | a4 f3 f | gafg e3 d | !rit! d8 |]',
    '[V:2] D,4 D,2 D,2 | C,2 A,,2 D,3 D, | G,,2 G,,2 D,E, F,G, | A,4 A,G, F,E, | D,4 D,2 D,2 | C,2 A,,2 D,3 D, | G,2 D,2 A,2 A,,2 | !rit! D,8 |]',
    '[V:3] D,2 D,D, D,2 D,2 | A,,2 A,,A,, D,2 D,D, | D,2 D,D, D,D,D,D, | A,,4 A,,2 D,2 | D,2 D,D, D,2 D,2 | A,,2 A,,A,, D,2 D,D, | D,D,D,D, A,,2 A,,A,, | !rit! D,8 |]'] }
```

- 不要定音鼓的話，`V:3` 那幾行整段刪掉就好，V1、V2 照樣等長。要放進 `TUNES` 輪播也可以：`tuneEvents` 看到 `tn.abc` 就走 `abcTune`，Q 照檔頭寫回去。
- 原始檔：`scratchpad/music/louis/tedeum.json`（同一份譜，JSON 格式，對拍用）。

### 改了什麼（「適度改編」）

1. **段落**：手稿是 Rondeau 奏兩次 → 第一段插曲 → Rondeau 一次 → 第二段插曲 → Rondeau 奏兩次。這裡改成 **Rondeau 一次 → 第一段插曲 → Rondeau 一次**，刪掉 Rondeau 的反覆和第二段插曲，讓一遍落在 30–60 秒。
2. **收尾**：手稿最後一小節是 D 附點二分音符（3 拍，第 4 拍留給下一段的弱起）。這裡拉滿成一整小節（`d8`），三個聲部同一個位置加 `!rit!`（漸慢只算一次）。
3. **裝飾音**：手稿的顫音記號（tremblement：第 2、6 小節的 F♯，第 7 小節的 E，插曲第 2、5、6 小節）不奏。引擎沒有顫音，寫成音符又會改到旋律。
4. **低音一處**：插曲第 1 小節第 2 拍取 D4–C♯4（見「怎麼驗證的」）。
5. **只取三個聲部**：旋律、通奏低音、定音鼓。中間三個聲部（haute-contre、taille、quinte）不放。
6. **配器**：Rondeau 用號角加定音鼓；插曲改提琴、力度 `!mp!`，這段號角和鼓休息，跟手稿一樣；低音整首用管風琴，因為手稿寫 orgue。力度的值是我們訂的：號角 `!mf!`、提琴 `!mp!`、低音 `!mf!`、鼓 `!mp!`。響度最後交給樂器工程師用 `vol` 去對齊。
7. **速度**：`Q:1/4=112`（一個二分音符 56）。手稿沒寫速度，這是典禮進行曲的穩當速度。

### 樂器

| 名字 | 新／舊 | 用在哪 | 音域 | 建議 |
|---|---|---|---|---|
| `trumpet` | **新**（清單上的 brass/trumpet） | 旋律 Rondeau | A4–A5（69–81） | 巴洛克的 D 調自然號角，只用泛音列上的音（A4 D5 E5 F♯5 G5 A5）。亮的銅管聲：起音 20–30 ms 帶唇振，低通從亮往暗收一點；力度越大越亮；不要顫音；送一點殘響 |
| `timpani` | **新** | 第三聲部 | A2、D3（45、50） | 兩個鼓（D、A）。敲一下就衰減，跟音樂盒一樣，譜上的長度只決定下一下什麼時候敲。基音正弦加非整數倍泛音（約 1.5／2.0／2.4 倍），起音一口低通雜訊當槌頭，大約 1 秒衰完 |
| `fiddle` | 舊 | 旋律插曲 | B4–B5（71–83） | — |
| `organ` | 舊 | 低音 | E2–D4（40–62） | 想換成「大鍵琴」也合時代（通奏低音），有做的話把 `[I:organ]` 改掉就好 |

新樂器做好之前想先聽：把 `trumpet` 換成 `whistle`、`timpani` 換成 `pluck`，譜一個字都不用動。名字要改成 `brass` 之類的，`[I:trumpet]` 整個取代就好。

### 解析檢查（遊戲的 abcParse／abcTune／tuneEvents）

腳本 `scratchpad/music/louis/harness.js`：把 `02_music.js` 裡的 `ABC_KEYS`、`ABC_DYN`、`BGM_RIT`、`BGM_INST`、`abcParse`、`abcTune`、`bgmWarp`、`tuneEvents` 一字不改抽出來，用 `new Function` 跑。`INSTR` 換成名字表：現有六種加上提議的新樂器，因為 `[I:]` 會檢查名字。遊戲檔沒有動，`git status` 是乾淨的。

| 項目 | 讀數 |
|---|---|
| 事件數 | **285**（V1 107、V2 96、V3 82） |
| 一遍長度 | 寫的是 97 拍（弱起 1 拍＋24 小節 × 4 拍），最後一小節漸慢後變 98.11 拍；Q 112 ⇒ **52.56 秒** |
| 音域 | **MIDI 40–83（E2–B5）**；V1 69–83（A4–B5）、V2 40–62（E2–D4）、V3 45–50（A2–D3） |
| 樂器用量 | trumpet 72、fiddle 35、organ 96、timpani 82 |
| 小節檢查 | `M:2/2` ⇒ 每小節 4 拍。全部過，只有第 1 小節是 1 拍的弱起。三個聲部一樣長，`tuneEvents` 沒丟錯 |
| `bgmPasses` | 2（一遍 52.6 秒） |

### 給宣傳片的時間點（Q 112，一拍 0.536 秒）

| 秒 | 段落 |
|---|---|
| 0.00 | 弱起：號角 A＋鼓 D |
| 0.54–17.14 | Rondeau（第 1–8 小節）；第 8 小節的 D 從 15.54 秒開始 |
| 17.14–34.29 | 插曲（提琴、比較輕、鼓停）；34.29 秒號角的弱起回來 |
| 34.29–49.82 | Rondeau 再一次 |
| 49.82–52.56 | 最後一小節的 D，漸慢收尾 |

片子這一章只要 15–20 秒的話，用 **0–17.1 秒**：Rondeau 奏一次，停在第 8 小節的 D。這就是 Eurovision 那段。

## 備案（只有 Tim 要照字面嚴格「1900 年前印刷」時才需要）

盧利（Lully）《土耳其人儀式進行曲》（*Marche pour la cérémonie des Turcs*，1670）：17、18 世紀的印本和抄本主要在 Gallica 和 IMSLP。這次 Gallica 要先過真人驗證，IMSLP 要先按免責聲明，我沒有點；archive.org 上的 IMSLP 鏡像只有 2011 年的現代打譜（CC BY），不能當主來源。所以沒有轉。要做的話，請 Tim 自己打開 IMSLP 或 Gallica 的掃描，或是同意我按那個免責聲明。

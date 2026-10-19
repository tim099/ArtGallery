# 十七世紀西班牙（1618 西班牙大帆船、白銀船隊）—— 候選曲（TASK-0718）

兩首都是 THEMES 格式（整份 ABC，一行一個字串），兩首現有的樂器都 parse 得過；帕凡舞的小鼓聲部另外寫，要等新樂器 `snare`。

| id | 中文名 | 原名 | 一遍 | 樂器 | 建議 |
|---|---|---|---|---|---|
| `folia` | 福利亞舞曲 | La Folía (Folies d'Espagne) | 55.86 秒 | 提琴（旋律）＋撥弦（低音、和弦） | **主推**：大家認得的「西班牙」小調舞曲，照這次指定的配器（撥弦＋拉弦） |
| `pavana` | 西班牙帕凡舞 | Pavane d'Espagne (The Spanish Pavan) | 57.45 秒 | 錫口笛→提琴（旋律）＋撥弦（低音）＋手風琴（內聲部）〔＋小鼓〕 | 備選：年代比較準（1589），D 多利安調式，很莊重，適合遊行／船隊出港 |

⚠ 年代說清楚：福利亞的**低音**（i–V–i–VII–III–VII–i–V）十六世紀就有了，但我們用的**旋律**是後期的版本（Corelli 1700 印的），比 1618 晚約 80 年；要年代精確就用帕凡舞（Arbeau 1589 印的）。

---

## 1. `folia` 福利亞舞曲

- **原名**：La Folía／Follia／Folies d'Espagne（英國叫 Farinel's Ground）
- **作曲／出處＋年份**：Grove 說它「據說是古老的西班牙舞」，低音型是大家共用的（一般說法是伊比利半島傳出來的）。旋律＋低音照 **Arcangelo Corelli, Sonate a violino e violone o cimbalo, Op.5 No.12「Follia」的主題（羅馬 1700）**。Corelli 1713 年過世 ⇒ 公有領域。
- **核對用的公有領域來源**：George Grove 編《A Dictionary of Music and Musicians》vol.1（倫敦 Macmillan；初版 1879，掃描的是 1900 印本），**p.539「FOLIA」條**，條目寫「The following is Corelli's theme」，譜例 16 小節（高音譜＋低音譜＋數字低音）。
  - 掃描頁：<https://en.wikisource.org/wiki/Page:A_Dictionary_of_Music_and_Musicians_vol_1.djvu/551>（圖：Wikimedia Commons `File:A_Dictionary_of_Music_and_Musicians_vol_1.djvu` 第 551 頁，Internet Archive「Digitized by Microsoft」那份）
  - **怎麼對的**：(1) 抓那一頁的掃描圖（1280 px），三行譜各裁出來放大 2.2 倍，**第 1–16 小節的高音、低音逐小節讀過**（例：第 1 小節 D5 四分、D5 附點四分、E5 八分；第 2 小節 C♯5 附點二分；第 3 小節 D5 D5. C♮5 十六分 D5 十六分；第 6 小節低音 C3 二分＋C♯3 四分；第 7 小節低音 D3 四分＋B♭2 二分〔7 6〕；第 14 小節低音 C3 附點四分、C♯3 八分、D3 四分；第 15 小節 G2 四分＋A2 二分；第 16 小節 D5／D3）。(2) Wikisource 志工照同一頁打的 LilyPond 轉寫**只拿來對照**：寫了一個 LilyPond `\relative` 小解析器把它換成音，跟**遊戲的 `abcParse` 讀我們的 ABC 回來的音**逐音比（起點、長度、音高）——旋律第一遍 36 個音差 0、第二遍 36 個差 0；低音第一遍 21 個差 0；第二遍 21 個位置都是 Grove 那個音＋差 12 的八度。
  - 沒核對到的（只當背景，不拿它的音）：Ortiz《Trattado de glosas》（羅馬 1553）裡有在這個低音上加花的 recercada（IMSLP 只有 CC 授權的現代版、沒有原版掃描；Savall 的 Alia Vox 曲目把其中一首標成 sobre la folía，哪一號各處說法不一）；Gaspar Sanz《Instrucción de música sobre la guitarra española》（薩拉戈薩 1674）有吉他的 Folías。
- **為什麼適合**：Grove 這一條開頭就寫它「據說是古老的西班牙舞」（Folies d'Espagne ＝ 西班牙的瘋狂）；D 小調、三拍、第二拍拉長的撒拉邦德步子，又暗又莊重，1618 年的大帆船、白銀船隊出海正合。歐洲人一聽就知道是「西班牙」。撥弦掃和弦 ＝ 西班牙吉他的 rasgueado（Sanz 那本書的吉他彈法）。
- **改編（全寫進 src）**：
  1. 配器：旋律提琴；低音、和弦都是撥弦（`pluck`，當魯特琴／吉他）。
  2. 和弦照譜例的數字低音配（Dm、A、C、F、B♭、Gm/B♭、A/C♯），**簡化**：第 3／11 小節的 5–♮6、第 7 小節的 7–6 第一遍只寫 B♭、第二遍寫成 B♭ → B♭6（Gm/B♭）、第 15 小節的 7–6／4–3 不寫（A 那一下只放空五度 E A，不跟旋律的 D→C♯ 掛留撞）。
  3. 奏兩遍（32 小節）：第一遍提琴 mf、低音照原譜、和弦每小節第一拍掃一下（pp）；第二遍提琴 f、低音加八度（D、C、F、C♯ 加低八度；A、B♭、G 加高八度 ⇒ 最低只到 C2，不會低到 G1 變成悶響）、和弦每拍掃一下（p；不跟旋律第三拍後半那個經過音一起掃，第 14、15 小節照低音換和弦的位置掃）。
  4. 最後一小節 `!rit!`。
  5. 旋律、低音的音一個都沒改。
- **ABC（直接貼進 `THEMES`）**：

```js
  { id: 'folia', name: '福利亞舞曲', en: "La Folía (Folies d'Espagne)", src: 'Corelli, Op.5 No.12「Follia」的主題（羅馬 1700）；譜照 Grove, A Dictionary of Music and Musicians vol.1（Macmillan 1900 印本，初版 1879）p.539「Folia」條的譜例，16 小節旋律＋低音逐音對過。改編（TASK-0718）：旋律提琴、低音與和弦撥弦；和弦照譜例的數字低音、簡化（第 3／11 小節的 5–♮6、第 15 小節的 7–6、4–3 不寫）；奏兩遍：第一遍只在每小節第一拍掃一下、第二遍低音加八度（D、C、F 加低八度；A、降 B、G 加高八度，免得低到 G1）、和弦每一拍掃一下（第 14、15 小節照低音換和弦的地方掃）；最後一小節漸慢',
    abc: ['M:3/4', 'L:1/8', 'Q:1/4=104', 'K:Dm', 'V:1', 'V:2', 'V:3',
      '% 旋律、低音 ＝ Grove 1879 p.539 的 Corelli 主題（d ＝ D5、D, ＝ D3）；K:Dm ⇒ B ＝ 降 B；c 沒寫記號 ＝ 還原 C（Grove 第 3、11 小節寫 c♮，因為前一小節是 c♯）',
      '% --- 第一遍：提琴拉主題、撥弦低音、和弦每小節第一拍掃一下 ---',
      '[V:1] [I:fiddle] !mf! d2 d3 e | ^c6 | d2 d3 c/2d/2 | e6 | f2 f3 g | e6 | d^c d3 e | ^c6 | d2 d3 e | ^c6 | d2 d3 c/2d/2 | e6 | f2 f3 g | e4 f2 | d2 d3 ^c | d6 |',
      '[V:2] [I:pluck] !mp! D,6 | A,,6 | D,6 | C,6 | F,6 | C,4 ^C,2 | D,2 B,,4 | A,,6 | D,6 | A,,6 | D,6 | C,6 | F,6 | C,3 ^C, D,2 | G,,2 A,,4 | D,6 |',
      '[V:3] [I:pluck] !pp! [F,A,D]6 | [E,A,^C]6 | [F,A,D]6 | [E,G,C]6 | [F,A,C]6 | [E,G,C]4 [E,A,^C]2 | [F,A,D]2 [F,B,D]4 | [E,A,^C]6 | [F,A,D]6 | [E,A,^C]6 | [F,A,D]6 | [E,G,C]6 | [F,A,C]6 | [E,G,C]3 [E,A,^C] [F,A,D]2 | [G,B,D]2 [E,A,]4 | [F,A,D]6 |',
      '% --- 第二遍：大聲一點、低音加八度（D C F 往下加、A 降B G 往上加：最低 C2，跟四首船歌的最低音〔降 B1〕差不多）、和弦每一拍掃一下（不跟旋律第三拍後半那個經過音一起掃；第 14、15 小節照低音換和弦的地方掃）；最後一小節漸慢 ---',
      '[V:1] !f! d2 d3 e | ^c6 | d2 d3 c/2d/2 | e6 | f2 f3 g | e6 | d^c d3 e | ^c6 | d2 d3 e | ^c6 | d2 d3 c/2d/2 | e6 | f2 f3 g | e4 f2 | d2 d3 ^c | !rit! d6 |]',
      '[V:2] !mf! [D,,D,]6 | [A,,A,]6 | [D,,D,]6 | [C,,C,]6 | [F,,F,]6 | [C,,C,]4 [^C,,^C,]2 | [D,,D,]2 [B,,B,]4 | [A,,A,]6 | [D,,D,]6 | [A,,A,]6 | [D,,D,]6 | [C,,C,]6 | [F,,F,]6 | [C,,C,]3 [^C,,^C,] [D,,D,]2 | [G,,G,]2 [A,,A,]4 | !rit! [D,,D,]6 |]',
      '[V:3] !p! [F,A,D]2 [F,A,D]2 [F,A,D]2 | [E,A,^C]2 [E,A,^C]2 [E,A,^C]2 | [F,A,D]2 [F,A,D]2 [F,A,D]2 | [E,G,C]2 [E,G,C]2 [E,G,C]2 | [F,A,C]2 [F,A,C]2 [F,A,C]2 | [E,G,C]2 [E,G,C]2 [E,A,^C]2 | [F,A,D]2 [F,B,D]2 [G,B,D]2 | [E,A,^C]2 [E,A,^C]2 [E,A,^C]2 | [F,A,D]2 [F,A,D]2 [F,A,D]2 | [E,A,^C]2 [E,A,^C]2 [E,A,^C]2 | [F,A,D]2 [F,A,D]2 [F,A,D]2 | [E,G,C]2 [E,G,C]2 [E,G,C]2 | [F,A,C]2 [F,A,C]2 [F,A,C]2 | [E,G,C]3 [E,A,^C] [F,A,D]2 | [G,B,D]2 [E,A,]3 [E,A,^C] | !rit! [F,A,D]6 |]'] },
```

- **新樂器（可選）**：V:2／V:3 的 `pluck` 換成 `lute`（魯特琴：比 pluck 溫、低音撐久一點）；V:3 也可以換 `harpsichord`（大鍵琴，巴洛克的數字低音）。沒做就照 `pluck`。
- **parse 檢查**（harness 從 `02_music.js` 原文抽 `abcParse`／`abcTune`／`bgmWarp`／`tuneEvents`，遊戲檔沒動）：事件 **334** 個（旋律 72、低音 63、和弦 199）；一遍 **96.831 拍 @ ♩=104 ⇒ 55.86 秒**（96 拍＋最後一小節漸慢多 0.83 拍）；`bgmPasses` ⇒ 2 遍 ≈ 111.7 秒；**MIDI 36–79（C2–G5）**：旋律 72–79（C5–G5）、低音 36–58（C2–B♭3）、和弦 52–62（E3–D4）；ABC 1,773 位元組（abc 陣列 JSON 化的長度）。

---

## 2. `pavana` 西班牙帕凡舞

- **原名**：Pavane d'Espagne（The Spanish Pavan；Grove：在西班牙叫「大舞」）
- **作曲／出處＋年份**：**Thoinot Arbeau（Jehan Tabourot，1520–1595），《Orchésographie》（Langres 1589）** 記下的曲調；作者無名（民間舞曲）。公有領域。
- **核對用的公有領域來源**：Grove《A Dictionary of Music and Musicians》vol.2（初版 1880，掃描的是 1900 印本），**p.677「PAVAN」條**：「The following is the tune which Tabourot gives for it」，譜例 8 小節（一行旋律，¢）。鼓的節奏在同一條 **p.676**：「accompanied throughout by the drum on one note」＋二分、四分、四分。
  - 掃描頁：<https://en.wikisource.org/wiki/Page:A_Dictionary_of_Music_and_Musicians_vol_2.djvu/689>（p.677）、<https://en.wikisource.org/wiki/Page:A_Dictionary_of_Music_and_Musicians_vol_2.djvu/688>（p.676）
  - **怎麼對的**：一樣抓掃描圖、三行裁出來放大，**8 小節逐音讀過**（第 1 小節 D5 全音符、C5 附點二分、A4 四分；第 3 小節 D5 B4 C5 D5 四分＋E5 全音符；第 4 小節 E5 E5 二分、E5 附點二分、G5 四分；第 8 小節 B4 C5 D5 E5 四分＋D5 全音符；沒有調號）；p.676 的鼓節奏看過圖（二分＋兩個四分）。Wikisource 的 LilyPond 轉寫只拿來對照：遊戲 `abcParse` 讀回來，第一遍 35 個音差 0、第二遍 35 個差 0。
  - 沒核對到的：Arbeau 1589 原書本身（只對了 Grove 引的那份）。
- **為什麼適合**：帕凡舞是 1600 年前後最紅的宮廷遊行舞，Grove 說它通常被認為從西班牙來、在西班牙特別流行，「西班牙帕凡」這種舞那時在英國的魯特琴、維吉納琴曲集裡很常見 ⇒ 1618 年正當紅（Grove 也說 Tabourot 記的這個曲調跟英國曲集裡的不是同一個）。慢、二拍子、莊重，Grove 引的話說它在化裝舞會「當遊行音樂」——配大帆船船隊出港、慢慢開過去的鏡頭剛好。結在 D 的多利安調式，聽起來比大小調老。
- **改編（全寫進 src）**：
  1. 旋律一個音都沒改；低音、內聲部的和聲是我們配的（D 多利安：Dm、F、G、Am、C），一拍或兩拍一個和弦。
  2. 奏兩遍（Grove 同一條引 Morley 1597：帕凡舞每一段奏兩遍）：第一遍錫口笛（當那時候跟鼓一起吹的笛子；Grove p.676 說帕凡舞「從頭到尾有鼓」）＋撥弦低音；第二遍提琴＋手風琴內聲部（代替 Grove 說的「sackbut 和 oboe」）＋撥弦低音。
  3. 結尾改成 D 大三和弦（加 F♯，文藝復興的皮卡第三度）、最後一小節 `!rit!`。
  4. 小鼓（V:4，可選）：照 Arbeau／Grove p.676，二分＋兩個四分一直打；只差 `snare` 這個樂器。
- **ABC（直接貼進 `THEMES`；先不含小鼓）**：

```js
  { id: 'pavana', name: '西班牙帕凡舞', en: "Pavane d'Espagne (The Spanish Pavan)", src: "Tabourot（Arbeau），Orchésographie（Langres 1589）的 Pavane d'Espagne；譜照 Grove, A Dictionary of Music and Musicians vol.2（Macmillan 1900 印本，初版 1880）p.677「Pavan」條的譜例，8 小節逐音對過；鼓的節奏照同一條 p.676。改編（TASK-0718）：低音與內聲部的和聲是我們配的（D 多利安：Dm F G Am C）；奏兩遍：第一遍錫口笛＋撥弦低音（＋小鼓）、第二遍提琴＋手風琴內聲部；結尾改 D 大三和弦、漸慢",
    abc: ['M:4/2', 'L:1/4', 'Q:1/2=68', 'K:C', 'V:1', 'V:2', 'V:3',
      '% 旋律 ＝ Grove 1880 vol.2 p.677「Pavan」條引的 Tabourot 曲調（d ＝ D5、B ＝ B4）：沒有調號、結在 D（D 多利安）；一小節 ＝ 兩個全音符（Grove 的分法，8 小節）',
      '% --- 第一遍：錫口笛（當那時候跟鼓一起吹的笛子）＋撥弦低音 ---',
      '[V:1] [I:whistle] !mf! d4 c3 A | d2 c2 d3 e | d B c d e4 | e2 e2 e3 g | f2 e2 d3 c | d f e d c2 d2 | B2 c2 d3 c | B c d e d4 |',
      '[V:2] [I:pluck] !mp! D,4 F,4 | G,2 A,2 G,4 | G,4 A,4 | C,2 A,,2 C,4 | F,2 C,2 G,,3 A,, | D,2 A,,2 F,,2 G,,2 | G,,2 A,,2 G,,3 A,, | G,,4 D,4 |',
      '[V:3] [I:accordion] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 |',
      '% --- 第二遍（Morley 1597：帕凡舞每一段奏兩遍）：提琴主旋律、手風琴內聲部（代替 Grove 說的 sackbut／oboe）、結尾 D 大三和弦＋漸慢 ---',
      '[V:1] [I:fiddle] !mf! d4 c3 A | d2 c2 d3 e | d B c d e4 | e2 e2 e3 g | f2 e2 d3 c | d f e d c2 d2 | B2 c2 d3 c | !rit! B c d e d4 |]',
      '[V:2] !mf! D,4 F,4 | G,2 A,2 G,4 | G,4 A,4 | C,2 A,,2 C,4 | F,2 C,2 G,,3 A,, | D,2 A,,2 F,,2 G,,2 | G,,2 A,,2 G,,3 A,, | !rit! G,,4 D,4 |]',
      '[V:3] !mp! [FA]4 [FA]4 | [GB]2 [EA]2 [GB]4 | [DG]4 [Ac]4 | [Gc]2 [Ac]2 [Gc]4 | [Ac]2 [Gc]2 [GB]3 [EA] | [FA]2 [EA]2 [FA]2 [GB]2 | [DG]2 [EA]2 [GB]3 [EA] | !rit! [DG]2 [GB]2 [^FA]4 |]'] },
```

- **小鼓（`snare` 做好之後）**：檔頭的 `'V:3'` 後面加 `'V:4'`，abc 最後加這三行（音高 C 只是佔位，鼓不看音高）：

```js
      '% --- 小鼓（Tabourot：帕凡舞「從頭到尾鼓打一個音」：二分＋兩個四分；Grove p.676）---',
      '[V:4] [I:snare] !mp! C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C |',
      '[V:4] !mf! C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | !rit! C2 C C C4 |]'
```

- **新樂器**：`snare`（小鼓／tabor：一個音、照節奏打）。可選：V:3 第二遍的 `accordion` 換 `brass`（sackbut，Grove 說帕凡舞在宮廷舞會上用 sackbut 和 oboe 奏）；V:2 換 `lute`。
- **parse 檢查**：不含小鼓 —— 事件 **168** 個（錫口笛 35、提琴 35、低音 48、手風琴 50）；一遍 **130.217 拍 @ 𝅗𝅥=68（♩=136）⇒ 57.45 秒**（128 拍＋最後一小節漸慢多 2.22 拍）；`bgmPasses` 2 遍 ≈ 114.9 秒；**MIDI 41–79（F2–G5）**：旋律 69–79（A4–G5）、低音 41–57（F2–A3）、內聲部 62–72（D4–C5）；ABC 1,092 位元組（含小鼓 1,478）。含小鼓（harness 給 `snare` 一個 stub 才過得了 `[I:snare]`）—— 事件 262 個（小鼓 94），長度一樣 57.45 秒；遊戲現在的 `INSTR` 沒有 `snare` ⇒ `abcParse` 丟「沒有這種樂器 snare」，所以小鼓那幾行要等樂器做好再加。

---

## 給整合的人

- ⚠ **`abc` 格式的曲子不能直接放進 `TUNES` 輪播**：`bgmFrame`（02_music.js 第 284 行）的換曲條件是 `th ? BGM.tn !== th : !!BGM.tn.abc` —— 現在沒有主題曲要放時，「正在放的那首有 `abc`」就被當成主題曲、馬上換掉 ⇒ 帶 `abc` 的輪播曲一開始放就被切走。要進輪播得把那一段改成看它是不是 `THEMES` 裡的（例如 `THEMES.indexOf(BGM.tn) >= 0`）；`sndUI` 的提示文字用 `t.inst || BGM_INST` 列樂器，`abc` 曲子會顯示成「提琴＋手風琴」，也要改。只放進 `THEMES`（船的主題曲＋試聽）就沒這兩個問題。
- **響度還沒量**（沒有 build、沒開 headless Chrome）：力度記號是照樂器的峰值估的（提琴 0.16、撥弦 0.2／音、和弦 3 個音 ⇒ 和弦壓到 pp／p）。進遊戲前用 `__game.bgmRender` 或 `music_lab.py` 量 A 加權 RMS，拿 `vol` 對到 −24.3～−25.1 dB；要看的地方：福利亞第二遍的和弦（每拍 3 個撥弦音＋低音八度）會不會蓋過提琴。
- 和弦對旋律檢查過（每個音頭列出同時響的音）：剩下的不協和都是旋律第三拍後半的八分經過音（Corelli 原譜就這樣）、第 15／31 小節 A 上面的 D（原譜的 4–3 掛留）、帕凡舞旋律裡的經過音 —— 都不是我們的和弦打錯音。

## 檔案

- 本檔：`C:/Users/Tim/AppData/Local/Temp/claude/D--Unity-Senate/860cbc18-7707-4222-ab5f-2404c8bb7572/scratchpad/music/era_spain.md`
- 候選曲（node 模組，三份：folia、pavana、pavana＋小鼓）：`.../scratchpad/spain_tools/era_spain_tunes.js`；可直接貼的物件字面值：`.../scratchpad/spain_tools/era_spain_literals.txt`
- parse 檢查：`node .../scratchpad/spain_tools/parse_check.js <02_music.js> <era_spain_tunes.js> [snare]`
- 逐音對拍（Grove 的 LilyPond 轉寫 ⇄ 遊戲 abcParse）：`node .../scratchpad/spain_tools/lily_check.js <02_music.js> <era_spain_tunes.js>`
- 和弦對旋律：`node .../scratchpad/spain_tools/harm_dump.js <02_music.js> <era_spain_tunes.js> folia 3`
- 掃描圖裁切：`.../scratchpad/spain_crops/folia_row1–3.png`、`pavan_row1–3.png`
- 遊戲檔（`bs_music/src/js/02_music.js`）沒改、沒 commit。

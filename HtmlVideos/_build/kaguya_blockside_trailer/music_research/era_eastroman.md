# 東羅馬帝國篇（10 世紀德羅蒙戰艦、希臘火；1453 君士坦丁堡陷落）

兩首都出自同一本公有領域的書，旋律由我照掃描頁逐音讀成 ABC：

**Louis-Albert Bourgault-Ducoudray，《Études sur la musique ecclésiastique grecque》**（Paris：Hachette，1877）。作者 1910 年過世，書在 1877 年出版。

- 掃描（Internet Archive，Google 掃描本）：https://archive.org/details/tudessurlamusiq00bourgoog
- 頁面圖：`https://archive.org/download/tudessurlamusiq00bourgoog/page/n<葉>.jpg`（n32 ＝ 書頁 21，n33 ＝ 22，n43 ＝ 32，n44 ＝ 33，n45 ＝ 34）

書裡的譜是 1875 年在 Khalki（Halki 神學院）聽 Tantalidis、Aphtonidis 兩位口述記下的五線譜，用的是當時君士坦丁堡牧首區一脈的唱法。

**時代上要先講清楚**：這是 19 世紀還活著的拜占庭聖詠傳統，不是 10 世紀的原貌。中期拜占庭的紐姆譜要解讀，靠的是 20 世紀的學術成果，那些都還不是公有領域。所以用的是歌詞與禮儀用途從東羅馬時代傳下來、旋律由同一傳統承傳的版本。

**驗證方法**：
1. 先用 PIL 找出五線的位置，再找音頭、標出每個線與間的音名（`music/tools/staff.py`、`heads.py`）。
2. 逐音對照掃描頁的放大圖讀出音高與時值。二分音符是空心頭，偵測器抓不到，另外放大逐一看過（`crops/hh.png`）。
3. 臨時記號另外放大比對：書中有自創的「半升、半降」（四分音）記號，樣子是降記號加一道斜線。這兩首用到的都確認是普通的 ♭、♮、♯（`crops/acc_ex4.png`、`crops/qsigns.png`）。
4. 最後用遊戲的 `abcParse` 讀回來，逐音印出來，跟讀譜結果比過（下面「讀回」那一列）。

⛔ 沒有參考任何網路上的 ABC、MIDI 或近代編曲。

---

## 1. `methimon` — 神與我們同在

- **原名**：Μεθ᾽ ἡμῶν ὁ Θεός（Meth' hēmōn ho Theos，「上帝與我們同在」）
- **出處**：東正教「大晚課」（Great Compline）的詩歌，歌詞取自以賽亞書 8:8–10。第二副調（ἦχος πλάγιος β'）。旋律屬傳統口傳，作者不明。
- **驗證**：Bourgault-Ducoudray 1877，頁 32「Mélodies du second mode plagal」第 1 首（掃描葉 n43，三行譜全部；附註在頁 33）。法譯在頁 34：「Dieu est avec nous, sachez-le, nations, et soyez vaincues…」。
  - 調號讀為 B♭、E♭、F♯，是普通記號，不是四分音記號。
  - 三行逐音讀過。原譜沒有小節線，作者在頁 8 寫明希臘教會聖詠「n'est pas mesuré」（不分拍子）。
- **為什麼合適**：歌詞直接就是「萬民哪，要知道，你們必被擊潰，因為神與我們同在」，放在 10 世紀德羅蒙戰艦噴希臘火的段落很對味。另外有一個背景說法：「Nobiscum (Deus)」（神與我們同在）是晚期羅馬與東羅馬軍隊的戰吼，見 Vegetius III.5 與《Strategikon》。這一點我只查到二手來源（舊版 Wikipedia「Battle cry」、論壇整理），要寫進影片字幕前請再核一次原典。第二副調的增二度（E♭–F♯）一聽就是「東方」的聲音。
- **配器**：旋律用 `choir`（新樂器：男聲詠唱團，母音「啊」）；伊頌（ison，持續低音）用 `drone`（新樂器：慢起音、不斷的持續音）。
  - 現有樂器的替代：`fiddle`＋`organ`。⚠ 東正教禮拜不用管風琴，用它只是暫代，等合唱聲與持續音做好就換掉。

```js
  { id: 'methimon', name: '神與我們同在', en: 'Μεθ᾽ ἡμῶν ὁ Θεός (Meth\' hēmōn ho Theos)',
    src: 'Bourgault-Ducoudray, Études sur la musique ecclésiastique grecque (Paris 1877) 頁 32 第二副調第 1 首（1875 年 Khalki 照 Tantalidis 口述記下）；旋律照原譜逐音。改編：原譜不分拍子 ⇒ 排成 4/4 十五小節；第 2 個延長記號（ὁ Θεός 的 D）延長成 4 拍再換氣 2 拍；倒數第二句「B♭. A」改成 B♭3/2 A/2 湊滿小節；最後一個 D 延長到 6 拍、漸慢；伊頌（持續低音 D／G 兩個八度）是我們照拜占庭習慣配的：句子落在 D 的地方唱 D，落在 G 那一段唱 G',
    abc: ['M:4/4', 'L:1/4', 'Q:1/4=72', 'K:Gm', 'V:1', 'V:2',
      "% 第二副調（ἦχος πλ. β'）：原譜調號 B♭ E♭ F♯ ⇒ K:Gm＋每小節寫 ^F",
      '[V:1] [I:choir] E ^F G2 | E ^F G2 | G A B B | A G A B | G2 A G | ^F E ^F G | ^F E D2- | D2 z2 |',
      '[V:2] [I:drone] !mp! [D,,D,]4- | [D,,D,]4 | [G,,G,]4- | [G,,G,]4- | [G,,G,]4 | [D,,D,]4- | [D,,D,]4- | [D,,D,]4- |',
      '[V:1] E ^F G G | G A G A | B c B3/2 A/2 | G2 A G | ^F E ^F G | ^F E D2- | !rit! D4 |]',
      '[V:2] [D,,D,]4 | [G,,G,]4- | [G,,G,]4- | [G,,G,]4 | [D,,D,]4- | [D,,D,]4- | !rit! [D,,D,]4 |]'] },
```

- **原譜對照**（四分音符 ＝ 1 拍，`2` ＝ 二分音符，`.` ＝ 附點，`𝄐` ＝ 延長記號）：
  - 第 1 行：E♭ F♯ G2 · E♭ F♯ G2 · G A B♭ B♭ A G
  - 第 2 行：A B♭ G2 · A G F♯ E♭ F♯ G F♯ E♭ D2𝄐 · E♭ F♯ G G G
  - 第 3 行：A G A B♭ C B♭. A G2 · A G F♯ E♭ F♯ G F♯ E♭ D2𝄐
- **改編**：
  1. 自由節奏排成 4/4。
  2. 第一個延長記號：D 延長到 4 拍，再空 2 拍讓詠唱者換氣（伊頌照常持續）。
  3. 「B♭. A」改成 B♭3/2 A/2：原本是附點四分接四分，這樣多出半拍，所以把 A 縮成八分。
  4. 結尾的 D 延長到 6 拍，加 `!rit!`。
  5. 伊頌是配的，原譜只有單聲部旋律。
- **讀回**（遊戲 `abcParse`，旋律）：Eb4 F#4 G4:2 Eb4 F#4 G4:2 G4 A4 Bb4 Bb4 A4 G4 A4 Bb4 G4:2 A4 G4 F#4 Eb4 F#4 G4 F#4 Eb4 D4:4 Eb4 F#4 G4 G4 G4 A4 G4 A4 Bb4 C5 Bb4:1.5 A4:0.5 G4:2 A4 G4 F#4 Eb4 F#4 G4 F#4 Eb4 D4:(6 拍＋漸慢)。跟原譜逐音相同，差別只有上面列的改編。
- **parse 讀數**：事件 56 個（旋律 46、伊頌 10），一遍 61.1 拍（含漸慢），Q=72 ⇒ **50.9 秒**。音域：旋律 D4–C5（MIDI 62–72），伊頌 D2–G3（38–55）。

---

## 2. `zoientafo` — 生命躺臥墓中

- **原名**：Ἡ ζωὴ ἐν τάφῳ（Hē zōē en taphō，「生命啊，你被安放在墓中」）
- **出處**：聖週五晚上「墓前哀歌」（Ἐγκώμια／Epitaphios Thrēnos）的第一段，第一副調（ἦχος πλάγιος α'）。旋律屬傳統口傳，作者不明。這些哀歌最早出現在 13 世紀的手抄本裡（見 Wikipedia「Epitaphios Thrinos」），正好是東羅馬帝國最後兩百年。
- **驗證**：Bourgault-Ducoudray 1877，頁 21「premier mode plagal」第 4 首（掃描葉 n32），用的是「Ἡ ζωὴ ἐν τάφῳ」那三行，頁 22 是法譯。同一首的「Ἄξιόν ἐστι」三行沒用。
  - 頁 21 的附註寫明這首是在 Khalki 照 Tantalidis、Aphtonidis 口述記下，聖週五唱。
  - 標示「Andante, dolce espressivo」。調號 B♭。第 2 行 B 前面的記號放大確認是還原記號。第 3 行的 F♯ 是普通升記號。
  - 頁 24 作者寫第 4、5 首「在移調後的調上，基音（因此伊頌）應是 ut」：「Si on la chante dans le ton transposé, la fondamentale et par conséquent l'ison devra être ut」。所以伊頌用 C，這一點有原書依據。
- **為什麼合適**：這是為基督之死而唱的哀歌，旋律溫柔而悲傷，用在 1453 年 5 月 29 日城陷、聖索菲亞大教堂最後一次禮拜那一段。東方教會的哀歌傳統跟「城市陷落的哀歌」在希臘人的記憶裡本來就連在一起。
- **配器**：同上首，`choir`＋`drone`；替代 `fiddle`＋`organ`。

```js
  { id: 'zoientafo', name: '生命躺臥墓中', en: 'Ἡ ζωὴ ἐν τάφῳ (Hē zōē en taphō)',
    src: 'Bourgault-Ducoudray, Études sur la musique ecclésiastique grecque (Paris 1877) 頁 21 第一副調第 4 首前三行（聖週五墓前哀歌；1875 年 Khalki 照 Tantalidis、Aphtonidis 口述記下）；旋律照原譜逐音。改編：原譜不分拍子 ⇒ 排成 4/4 十一小節；第 1 行兩個小音符（倚音 A G）寫成 G/2 A/4 G/4 佔掉前一個 G 的後半拍；最後的 G（延長記號）延長到 4 拍、漸慢；伊頌 C 照原書頁 24「l\'ison devra être ut」，配兩個八度',
    abc: ['M:4/4', 'L:1/4', 'Q:1/4=60', 'K:F', 'V:1', 'V:2',
      "% 第一副調（ἦχος πλ. α'）：調號 B♭；第 5–7 小節的 B 原譜是還原記號（=B）",
      '[V:1] [I:choir] G A A3/2 B/2 | G B A2 | G G G/2 A/4 G/4 F | G A A2 |',
      '[V:2] [I:drone] !mp! [C,,C,]4- | [C,,C,]4- | [C,,C,]4- | [C,,C,]4- |',
      '[V:1] A A =B G | A =B c A | =B B c B | A2 A A | B c B A | B A G ^F | !rit! G4 |]',
      '[V:2] [C,,C,]4- | [C,,C,]4- | [C,,C,]4- | [C,,C,]4- | [C,,C,]4- | [C,,C,]4- | !rit! [C,,C,]4 |]'] },
```

- **原譜對照**：
  - 第 1 行：G A ⋮ A. B♭(八分) G B♭ A2 | G G G⁀(小音符 A G) F G
  - 第 2 行：A A2 A A ♮B G A ♮B C⁀A ♮B B C ♮B A2
  - 第 3 行：A A ♭B C B♭ A B♭ A G ♯F G2𝄐
  - 譜上的虛線「⋮」照作者的分句保留在第 1 小節中間。第 1 行開頭的 G 上方那個小點不是附點（太高），當作印刷污點。
- **改編**：
  1. 自由節奏排成 4/4。
  2. 倚音寫成實際時值，從前面那個 G 借半拍。
  3. 結尾的 G 從 2 拍延長到 4 拍，加 `!rit!`。
  4. 伊頌是配的，音高照原書頁 24。
- **讀回**（遊戲 `abcParse`，旋律）：G4 A4 A4:1.5 Bb4:0.5 G4 Bb4 A4:2 G4 G4 G4:0.5 A4:0.25 G4:0.25 F4 G4 A4 A4:2 A4 A4 B4 G4 A4 B4 C5 A4 B4 B4 C5 B4 A4:2 A4 A4 Bb4 C5 Bb4 A4 Bb4 A4 G4 F#4 G4:(4 拍＋漸慢)。跟原譜逐音相同（B♮ 那幾個讀回是 B4）。
- **parse 讀數**：事件 42 個（旋律 40、伊頌 2：C 一路連著不斷），一遍 45.1 拍，Q=60 ⇒ **45.1 秒**。音域：旋律 F4–C5（65–72），伊頌 C2–C3（36–48）。

---

## 要做的樂器（給樂器工程師）

- **`choir`**（旋律）：男聲詠唱團，母音「啊」的共振峰（約 700／1100／2600 Hz），幾個略微走音的聲音疊在一起，起音約 80 ms，晚到的輕微顫音。
  - 旋律寫在 D4–C5；真正的詠唱者是男聲，常低一個八度唱。要不要整體低八度，等音色出來再決定，譜不用改。
- **`drone`**（伊頌）：起音約 0.4 s、放開約 0.6 s 的持續音，以基音為主、泛音少、不加顫音。這兩首都用 `[X,,X,]` 兩個八度連著不斷：連音線接上之後不會重新起音，所以只要 `note()` 能撐整段長度就好。
- 兩種都建議送一點殘響（`rev` 約 0.4：教堂石頭空間）。
- **響度**：照 README 的做法，A 加權 RMS 對齊 −24.3～−25.1 dB，用每首的 `vol` 調。我還沒錄音量（新樂器還不存在）。

## parse 檢查方法

`music/tools/parse_check.cjs` 從 `bs_music/src/js/02_music.js` 原文取出 `var ABC_KEYS` 到 `bgmPasses` 前面那一段（`abcParse`／`abcTune`／`bgmWarp`／`tuneEvents`），放進 `vm` 執行，不改遊戲檔。`INSTR` 用空殼代替：現有六種，加上參數給的 `choir,drone`。

- 用 `choir`／`drone` 跑：兩首都過（4/4 每小節拍數檢查、兩聲部長度相同）。
- 用現有樂器 `fiddle`／`organ` 替代（`FALLBACK=1`）：同樣的讀數。
- 不加 `choir,drone` 跑：遊戲照預期丟出「沒有這種樂器 choir」。也就是說，樂器做好之前不能把 `[I:choir]` 版直接放進 `THEMES`／`TUNES`。

譜本身在 `music/tools/era_eastroman_tunes.cjs`。

```
node tools/parse_check.cjs ../bs_music/src/js/02_music.js $(pwd)/tools/era_eastroman_tunes.cjs choir,drone
methimon  Q=72 events=56 beats=61.11 pass=50.9s  v0:46 D4(62)–C5(72)  v1:10 D2(38)–G3(55)
zoientafo Q=60 events=42 beats=45.11 pass=45.1s  v0:40 F4(65)–C5(72)  v1:2  C2(36)–C3(48)
```

## 備選（沒交）

同一本書頁 21–22 第一副調第 5 首就是「Χριστὸς ἀνέστη」（復活節讚詞，Tantalidis／Aphtonidis 口述）。我已經讀過頁面，開頭一行是十幾個八分音符的花唱，作者同樣寫伊頌是 C。全曲約 38 拍，Q=60 約 38 秒。它是喜樂的復活節歌，不適合「陷落」那一段，所以沒有選。如果影片結尾要「希望」的感覺，可以再補。

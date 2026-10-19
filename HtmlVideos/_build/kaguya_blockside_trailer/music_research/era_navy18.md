# 十八世紀海軍（六分儀、三叉戟號、憲法號）兩首 —— TASK-0718 研究稿

| id | 中文名 | 原名 | 來源 | 用在 | 一遍 | 事件 | MIDI |
|---|---|---|---|---|---|---|---|
| `presidents` | 總統進行曲 | The President's March（Hail Columbia 的曲子） | Philip Phile 作曲；Shaw's Flute Preceptor（Philadelphia 1802），讀 Sonneck 1909 的抄本 | 憲法號（1797 下水的美國巡防艦） | 46.15 秒（Q=104，2/4 四十小節） | 646 | 旋律 69–83（A4–B5） |
| `granadera` | 擲彈兵進行曲 | Marcha Granadera（Marcha Real） | 作者不詳，傳統上歸到 1761 年西班牙步兵號令書；旋律照 Boosey 1915 No.41 Spain | 三叉戟號（西班牙 74 砲戰列艦）、六分儀那一段可以用它的開頭 | 40.00 秒（Q=120，2/4 四十小節） | 636 | 旋律 68–89（A♭4–F6） |

- 兩首的旋律都是我自己照公有領域原書的影像，逐小節讀成 ABC 的。⛔ 沒有看任何網路上別人的 ABC、MIDI 或近代編曲。第二支橫笛、低音、和聲、鼓都是我配的，原書的伴奏一個音都沒有照抄。
- 用到的樂器：`fife`、`snare`、`bassdrum`（presidents）；`fife`、`trumpet`、`horn`、`snare`、`timpani`（granadera）。這幾種在 `bs_music/src/js/02_music.js` 的 `INSTR` 裡都已經有了（樂器工程師做的）。後備配器的對應寫在 `tools/era_navy18_tunes.cjs` 最下面（`FALLBACK=1`），只拿來試聽。
- 遊戲檔沒有動、沒有 commit、沒有跑 admin.py，也沒有開瀏覽器。這一輪沒有重新下載任何掃描檔，只用上一輪下載好的（`navy18/dl_sonneck`、`dl_hmnavy`、`dl_commons`）。另外查了兩次 Internet Archive 的搜尋 API，用來對出掃描本的 identifier。

---

## (a) `presidents` 總統進行曲（The President's March）

### 作者、年代（哪些是一手、哪些是二手）

- **曲**：Philip Phile（費城的提琴手、樂隊領班；生年不詳）。Sonneck 推測他死在 1793 年費城的黃熱病：1793 年的城市名錄還有他，1794 年只剩「Phile, Susanna, widow」（頁 61）。這裡全部照 O. G. Sonneck《Report on "The Star-Spangled Banner", "Hail Columbia", "America", "Yankee Doodle"》（Library of Congress；Washington: Government Printing Office，1909）的考證。Sonneck 1928 年過世，而且這本是美國政府出版品，所以是公有領域。
  - 歸給 Phile 的根據，是 Sonneck 在國會圖書館找到的一張殘頁，標題寫「THE PRESIDENTS MARCH, BY PHEIL」。同一頁還有 Moller 的進行曲，所以他推定是 1793 年左右 Moller & Capron 在費城出的（Sonneck 頁 68–69，殘頁的影像收在 Appendix Pl. XI）。
  - ⚠ 常見的「1789 年為華盛頓就職而作」**沒有根據**。Sonneck 頁 68 明講：「most decidedly not to date the origin of the march 1789」。他能找到最早提到這首曲子的資料是 1794 年（《Gentleman's Amusement》）。那張 PHEIL 殘頁他推定約 1793 年。所以 src 不寫 1789。
- **詞**：Joseph Hopkinson，1798 年寫成 Hail Columbia。
  - 作者自己的說法（1840 年 8 月 24 日給 Griswold 的信，Sonneck 頁 43 全文轉引）：「Hail Columbia was written in the summer of 1798, when war with France was thought to be inevitable」。這是**一手證詞**，但是作者 42 年後的回憶，我是經 Sonneck 轉引讀到的。
  - 首唱：1798 年 4 月 25 日，費城 New Theatre，演唱者 Gilbert Fox。根據是 Porcupine's Gazette 1798 年 4 月 24 日的廣告，原文寫「an entire New Song … to the tune of the "President's March"」，Sonneck 頁 44 轉引。這是**一手報紙**，同樣經 Sonneck 轉引。

### 為什麼合適：憲法號那一幕

- 憲法號 1797 年 10 月在波士頓下水，1798 年首航，接著就是對法國的「準戰爭」（Quasi-War，1798–1800）。Hail Columbia 正好是 1798 年春天、「跟法國的戰爭看來免不了」的時候寫的（上面那封信）。所以同一年、同一場危機，一艘新的美國巡防艦配一首新的美國愛國歌，對得剛好。
  - 憲法號的下水年份與參加準戰爭是**二手**（一般海軍史、DANFS 一類的常識），我這一輪沒有查一手文件。
  - ⚠ 「這首曲子在憲法號上演奏過」我**沒有找到任何來源**，影片字幕不要這樣寫，只寫「1798 年的美國愛國歌」就好。
- 配器用橫笛＋小鼓＋大鼓：十八世紀末美國艦上的陸戰隊有鼓手與笛手，敲「戰鬥部署」靠的是鼓。這一點是**二手**常識，沒有查一手。
- 1805 年左右 Willig 的《Compleat Tutor for the Fife》也收了這首（見下面「對照」），表示它當時確實是橫笛手會吹的曲子。根據是 Sonneck 頁 67 抄的那一份。

### 轉譜用的原書

- **主讀**：Sonneck 1909 頁 67 的第 (3) 例「The President's March as in Shaw's Flute Preceptor. Philadelphia, 1802」。C 拍（4/4）、D 大調（F♯ C♯），A 段 12 小節 :||:，B 段 16 小節 :||。
  - 掃描本是 Internet Archive `reportonthestars00sonniala`（University of California Libraries，書裡蓋著 Santa Barbara Free Public Library 的章；OCR 第一行「Ato.」跟上一輪抓的 `sonneck.txt` 一字不差，用這個對上 identifier）。頁 67 ＝ 影像葉 n72（2358×3642）：`https://archive.org/download/reportonthestars00sonniala/page/n72.jpg`。
  - ⚠ 這是 Sonneck 排版的**抄本**，不是 Shaw 1802 原書的影印。Sonneck 自己寫「submitted either in facsimile or in transcript」，(3)、(4) 這兩例屬於 transcript。所以如果 Sonneck 抄錯了，我們也會跟著錯。為了這一點，下面用兩份獨立的版本對照。
- **對照 1**：同一頁第 (4) 例「The President's March as in the "Compleat Tutor for the Fife," Philadelphia, G. Willig, ca. 1805」。2/4，時值剛好是 Shaw 的一半，有裝飾音與 tr。
  - A 段 12 小節逐小節的音名骨架都對得上，包括第 10 小節第一個音的 ♯（G♯）、第 11 小節兩組三連音（這一份印了「3」）、第 12 小節的 :||:。
  - B 段：第 13 小節「a.(ba) g f」一樣，最後一小節也是「d d.d d」**只有 3 個八分**（＝ Shaw 的 3 拍）。兩份抄本都缺這一拍，所以不是 Sonneck 漏抄。
- **對照 2**：Sonneck Appendix Pl. XI ＝ Shaw & Carr《Gentleman's Amusement》No.1 頁 3（Philadelphia: Carr，1794 年 4 月）「PRESIDEN'S MARCH」，Flauto 1mo／2do，是影印本，在影像葉 n207 右半＋n208 左半（我拼成了 `navy18/view/plateXI_full.png`）。
  - 2/4、D 大調。第二行 Flauto 1 有 ♯、兩個「3」、tr，接著是 :||:，跟 A 段結尾一樣。
  - 這一份是灰底影印，又跨在兩頁的接縫上，量音頭的工具在上面互相矛盾，所以**只做到樂段層級的對照**，沒有逐音比。
- Pl. IX–X（n203–n204）：Willig 約 1798–1803 年出的「The President's March. A New Federal Song」（Hail Columbia 人聲＋鍵盤）。這一份沒有讀，因為我們要的是器樂版。

### 驗證方法

1. 找五線：`navy18/tools/staff18.py`（上一輪寫的），以及這一輪寫的 `navy18/tools2/barcrop.py`。barcrop 會自己找最平的角度把影像轉正，用固定線距套五條線，畫上每一條線與間的音名，再放大存檔。
2. 量音頭：`music/tools/heads.py` 先逐行量一遍，再逐小節放大、看圖讀時值（附點、橫樑數、空心頭）。
3. 拿不準的音，用 `navy18/tools2/pitchat.py` 直接在原圖上量：五線從音頭左右兩側量，音頭取「這幾行暗點過半的列」，再扣掉五線本身。
   - 第 17 小節最後一個音：heads.py 說是 D5（−0.47），pitchat 量出音頭在第 1455–1464 列，中心 1459.5，五線在 1449.5／1466／1482／1499／1515.5 ⇒ **E5**（−0.21）。所以照 E5 寫。
   - 第 25 小節：B4（+0.03）、C♯5（−0.21）。
4. 另外放大確認的地方：
   - 第 10 小節的臨時記號（G♯）。
   - 第 11、27 小節的三連音：每組三個八分一道橫樑、上面有圓滑線，沒印「3」，但不當三連音的話拍數就湊不起來。
   - 第 13 小節的十六分（`z_b13`）、第 14 小節（`Z14`）。
   - 第 23 小節：heads 漏了一個 F，在原圖 x≈1020。
   - 第 28 小節（`z_b28`）：只有 3 拍，結束線前沒有休止符。
5. 用遊戲的 `abcParse` 讀回來逐小節印出（下面「讀回」），跟讀譜的結果逐音比過。

### 原書讀譜（Shaw 1802，照 Sonneck 抄本；L:1/4、C 拍）

```
A: d2 f3/2 e/2 | e A d z | f2 a3/2 g/2 | f d f z | d d3/4 d/4 d f | e/2 d/2 e/2 f/2 d A | f f3/4 f/4 f a | g/2 f/2 g/2 a/2 f d |
   e e3/4 e/4 e a | ^g/2 g/2 f/2 f/2 e/2 e/2 d/2 d/2 | (3cde (3fed c B | A A3/4 A/4 A z :|:
B: a3/2 b/4 a/4 g f | f/2 a/2 b/2 f/2 e z | e e3/4 e/4 f f3/4 f/4 | e e3/4 e/4 e f | g3/2 a/4 g/4 f e | f/2 g/2 a/2 f/2 d z |
   d d3/4 d/4 e e3/4 e/4 | d d3/4 d/4 d z | d d3/4 d/4 d f | e/2 d/2 e/2 f/2 d A | f f3/4 f/4 f a | g/2 f/2 g/2 a/2 f A |
   B B3/4 B/4 g c | d3/4 d/4 f3/4 f/4 a z/2 g/2 | (3fef (3gfe d c | d d3/4 d/4 d :|      ← 原書最後一小節只有 3 拍
```

### 改編（都寫進了 src）

1. **時值減半，改寫成 2/4、L:1/8**：寫出來的字串一個字都不用改，聽起來就跟 Willig 1805 年的橫笛版一樣。
2. **三連音**：遊戲的 ABC 沒有 `(3`，所以寫成 `c/3 d/3 e/3`（每個佔 1/3 個八分）。原譜有兩處（第 11、27 小節），排進遊戲是第 11、23、39 小節。
3. **最後一小節補一個八分休止**，湊滿 2/4。
4. **反覆**：照 A A B 排（第一遍 A 只有一支橫笛＋輕的鼓，第二遍 A 加第二支橫笛），B 段不反覆。一遍 46 秒；照原譜 A A B B 會是 60 秒。
5. **第二支橫笛**是我配的：大多在下方三度或六度，跟旋律同節奏。第 2 小節用 C♯–C♯–A、第 12 小節收在上方的 C♯5、第 11 小節最後一拍是 G♯4（E 和弦）、全曲第 39 小節最後一拍是 G4（A7）。
6. **小鼓**：「八分、兩個十六分、八分、兩個十六分」。旋律停在休止的小節（原譜第 2、4、12、14、18、20、28 小節）最後一個八分不打。第一遍 A 用 `!p!`，之後 `!mp!`。**大鼓**每拍一下。
7. **速度**：原書沒有寫，定成 Q=104（2/4 的快步進行曲）。

### 譜

```js
  { id: 'presidents', name: '總統進行曲', en: 'The President\'s March (Hail Columbia)',
    src: 'Philip Phile 作曲（作者照 Sonneck 1909 的考證；年份不詳：最早的印本約 1793，Sonneck 認為不能定在 1789）；1798 年 Joseph Hopkinson 照這首填詞成 Hail Columbia；旋律照 Shaw\'s Flute Preceptor（Philadelphia 1802），讀的是 O. G. Sonneck《Report on "The Star-Spangled Banner", "Hail Columbia", "America", "Yankee Doodle"》（Washington: GPO 1909）頁 67 的抄本（Internet Archive reportonthestars00sonniala 第 n72 葉），對過同頁 Willig《Compleat Tutor for the Fife》（約 1805）與 Plate XI（Shaw & Carr《Gentleman\'s Amusement》1794）；改編（TASK-0718）：原譜 C 拍（4/4）的時值減半寫成 2/4（跟 1805 橫笛版一樣）；三連音寫成 /3；最後一小節原書只有 3 拍，補一個休止；反覆照 A A B（B 段不反覆）；第二支橫笛（第二遍 A 起）、小鼓、大鼓是我們配的',
    abc: ['M:2/4', 'L:1/8', 'Q:1/4=104', 'K:D', 'V:1', 'V:2', 'V:3', 'V:4',
      '% Shaw 1802 原譜 C 拍、D 大調；時值減半 ⇒ 2/4（Willig 約 1805 橫笛版就是這樣記的）。A 段 12 小節 :|: B 段 16 小節 :|',
      '% V:1 橫笛（旋律）、V:2 第二支橫笛（第一遍 A 休息）、V:3 小鼓、V:4 大鼓',
      '% --- A 段第一遍（1–12）：一支橫笛＋鼓（輕）---',
      '[V:1] [I:fife] !mf! d2 f3/2 e/2 | e A d z | f2 a3/2 g/2 | f d f z | d d3/4 d/4 d f | e/2 d/2 e/2 f/2 d A |',
      '[V:2] [I:fife] !mp! z4 | z4 | z4 | z4 | z4 | z4 |',
      '[V:3] [I:snare] !p! C C/2C/2 C C/2C/2 | C C/2C/2 C z | C C/2C/2 C C/2C/2 | C C/2C/2 C z | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 |',
      '[V:4] [I:bassdrum] !p! C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 |',
      '[V:1] f f3/4 f/4 f a | g/2 f/2 g/2 a/2 f d | e e3/4 e/4 e a | ^g/2 g/2 f/2 f/2 e/2 e/2 d/2 d/2 | c/3 d/3 e/3 f/3 e/3 d/3 c B | A A3/4 A/4 A z |',
      '[V:2] z4 | z4 | z4 | z4 | z4 | z4 |',
      '[V:3] C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C z |',
      '[V:4] C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 z2 |',
      '% --- A 段第二遍（13–24）：第二支橫笛進來（三度／六度在下面，第 12 小節收在上面的 C♯）---',
      '[V:1] d2 f3/2 e/2 | e A d z | f2 a3/2 g/2 | f d f z | d d3/4 d/4 d f | e/2 d/2 e/2 f/2 d A |',
      '[V:2] A2 d3/2 c/2 | c c A z | d2 f3/2 e/2 | d A d z | A A3/4 A/4 A d | c/2 B/2 c/2 d/2 A F |',
      '[V:3] !mp! C C/2C/2 C C/2C/2 | C C/2C/2 C z | C C/2C/2 C C/2C/2 | C C/2C/2 C z | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 |',
      '[V:4] !mp! C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 |',
      '[V:1] f f3/4 f/4 f a | g/2 f/2 g/2 a/2 f d | e e3/4 e/4 e a | ^g/2 g/2 f/2 f/2 e/2 e/2 d/2 d/2 | c/3 d/3 e/3 f/3 e/3 d/3 c B | A A3/4 A/4 A z |',
      '[V:2] d d3/4 d/4 d f | e/2 d/2 e/2 f/2 d A | c c3/4 c/4 c e | e/2 e/2 d/2 d/2 c/2 c/2 B/2 B/2 | A/3 B/3 c/3 d/3 c/3 B/3 A ^G | c c3/4 c/4 c z |',
      '[V:3] C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C z |',
      '[V:4] C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 z2 |',
      '% --- B 段（25–40；原譜 13–28）---',
      '[V:1] a3/2 b/4 a/4 g f | f/2 a/2 b/2 f/2 e z | e e3/4 e/4 f f3/4 f/4 | e e3/4 e/4 e f | g3/2 a/4 g/4 f e | f/2 g/2 a/2 f/2 d z | d d3/4 d/4 e e3/4 e/4 | d d3/4 d/4 d z |',
      '[V:2] f3/2 g/4 f/4 e d | d/2 f/2 g/2 d/2 c z | c c3/4 c/4 d d3/4 d/4 | c c3/4 c/4 c d | e3/2 f/4 e/4 d c | d/2 e/2 f/2 d/2 A z | A A3/4 A/4 c c3/4 c/4 | F F3/4 F/4 F z |',
      '[V:3] C C/2C/2 C C/2C/2 | C C/2C/2 C z | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C z | C C/2C/2 C C/2C/2 | C C/2C/2 C z |',
      '[V:4] C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 |',
      '[V:1] d d3/4 d/4 d f | e/2 d/2 e/2 f/2 d A | f f3/4 f/4 f a | g/2 f/2 g/2 a/2 f A | B B3/4 B/4 g c | d3/4 d/4 f3/4 f/4 a z/2 g/2 | f/3 e/3 f/3 g/3 f/3 e/3 d c | d d3/4 d/4 d z |]',
      '[V:2] A A3/4 A/4 A d | c/2 B/2 c/2 d/2 A F | d d3/4 d/4 d f | e/2 d/2 e/2 f/2 d F | G G3/4 G/4 e A | A3/4 A/4 d3/4 d/4 f z/2 e/2 | d/3 c/3 d/3 e/3 d/3 c/3 A G | F F3/4 F/4 F z |]',
      '[V:3] C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C C/2C/2 | C C/2C/2 C z |]',
      '[V:4] C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 C,2 | C,2 z2 |]'] },
```

### 讀回（遊戲 `abcParse`，旋律 V:1；`音名:幾個八分`，沒寫 ＝ 1 個八分；G♯5 印成 Ab5，是同一個 MIDI 80）

```
 1 | D5:2 F#5:1.5 E5:0.5
 2 | E5 A4 D5
 3 | F#5:2 A5:1.5 G5:0.5
 4 | F#5 D5 F#5
 5 | D5 D5:0.75 D5:0.25 D5 F#5
 6 | E5:0.5 D5:0.5 E5:0.5 F#5:0.5 D5 A4
 7 | F#5 F#5:0.75 F#5:0.25 F#5 A5
 8 | G5:0.5 F#5:0.5 G5:0.5 A5:0.5 F#5 D5
 9 | E5 E5:0.75 E5:0.25 E5 A5
10 | Ab5:0.5 Ab5:0.5 F#5:0.5 F#5:0.5 E5:0.5 E5:0.5 D5:0.5 D5:0.5
11 | C#5:0.333 D5:0.333 E5:0.333 F#5:0.333 E5:0.333 D5:0.333 C#5 B4
12 | A4 A4:0.75 A4:0.25 A4
13 | D5:2 F#5:1.5 E5:0.5
14 | E5 A4 D5
15 | F#5:2 A5:1.5 G5:0.5
16 | F#5 D5 F#5
17 | D5 D5:0.75 D5:0.25 D5 F#5
18 | E5:0.5 D5:0.5 E5:0.5 F#5:0.5 D5 A4
19 | F#5 F#5:0.75 F#5:0.25 F#5 A5
20 | G5:0.5 F#5:0.5 G5:0.5 A5:0.5 F#5 D5
21 | E5 E5:0.75 E5:0.25 E5 A5
22 | Ab5:0.5 Ab5:0.5 F#5:0.5 F#5:0.5 E5:0.5 E5:0.5 D5:0.5 D5:0.5
23 | C#5:0.333 D5:0.333 E5:0.333 F#5:0.333 E5:0.333 D5:0.333 C#5 B4
24 | A4 A4:0.75 A4:0.25 A4
25 | A5:1.5 B5:0.25 A5:0.25 G5 F#5
26 | F#5:0.5 A5:0.5 B5:0.5 F#5:0.5 E5
27 | E5 E5:0.75 E5:0.25 F#5 F#5:0.75 F#5:0.25
28 | E5 E5:0.75 E5:0.25 E5 F#5
29 | G5:1.5 A5:0.25 G5:0.25 F#5 E5
30 | F#5:0.5 G5:0.5 A5:0.5 F#5:0.5 D5
31 | D5 D5:0.75 D5:0.25 E5 E5:0.75 E5:0.25
32 | D5 D5:0.75 D5:0.25 D5
33 | D5 D5:0.75 D5:0.25 D5 F#5
34 | E5:0.5 D5:0.5 E5:0.5 F#5:0.5 D5 A4
35 | F#5 F#5:0.75 F#5:0.25 F#5 A5
36 | G5:0.5 F#5:0.5 G5:0.5 A5:0.5 F#5 A4
37 | B4 B4:0.75 B4:0.25 G5 C#5
38 | D5:0.75 D5:0.25 F#5:0.75 F#5:0.25 A5 G5:0.5
39 | F#5:0.333 E5:0.333 F#5:0.333 G5:0.333 F#5:0.333 E5:0.333 D5 C#5
40 | D5 D5:0.75 D5:0.25 D5
```

- 第 1–12 小節 ＝ 第 13–24 小節 ＝ 原書 A 段；第 25–40 小節 ＝ 原書 B 段。逐音、逐時值都跟上面的原書讀譜相同。差別只有改編第 1、2、3 條（時值減半、三連音的寫法、最後補的休止）。

### parse 讀數

- 事件 646 個：旋律 204、第二支橫笛 145、小鼓 220、大鼓 77。
- 一遍 80 拍 ＝ **46.15 秒**（Q=104）；`bgmPasses` 會奏 2 遍，約 92 秒。
- 音域：旋律 A4–B5（69–83），第二支橫笛 F♯4–G5（66–79）。
- 鼓譜寫的是 `C`／`C,`，在 K:D 底下讀成 C♯4／C♯3（61／49）。小鼓與大鼓不管音高，只會讓頻率差 0.6%，所以沒改。
- 4/4 的每小節拍數檢查、四個聲部等長都過了。後備配器（whistle＋pluck）讀數相同。

### 給影片剪接（一小節 1.154 秒）

- 0–13.85 秒：第一遍 A，一支橫笛。第 12 小節結在 A（半終止）。
- 13.85 秒：第二支橫笛進來。
- 27.69 秒：第二遍 A 結束，B 段開始。
- 36.92 秒：第 32 小節，回到 D。
- 46.15 秒：結在 D。
- 只要短版的話，剪 0–13.85 秒（A 段一遍）。

---

## (b) `granadera` 擲彈兵進行曲（Marcha Granadera／Marcha Real）

### 作者、年代（哪些是一手、哪些是二手）

- **作者不詳**。傳統說法有兩點，我都只查到**二手**來源（Wikipedia「Marcha Real」與 Wikimedia Commons 檔案說明那一類），沒有看到 1761 年那本書的書名頁：
  - 它是 Manuel de Espinosa 1761 年《Libro de Ordenanza de los toques militares de la Infantería Española》裡的〈La Marcha Granadera〉。
  - 1770 年起，查理三世定它為榮譽進行曲（Marcha de Honor）。
- 我手上的一手影像有兩份：
  1. Wikimedia Commons 的 **1761 手抄譜**影像（上一輪下載的 `dl_commons/mg1761.jpg`，700×546）。看得到標題「…adera」，三行分別是 Pífano 1º、Pífano 2º、Tambor，2/4、一個升記號（G 大調），A 段 8 小節＋反覆。⚠ 只有第一頁：B 段開頭之後就沒有了。
  2. `mg1769.jpg`：La Marcha de Granaderos（1769）。右下角寫「Si:」（sigue，接下頁），所以也只有第一頁。
  - ⚠ 這兩張 Commons 圖的檔案頁（作者、館藏、授權說明）上一輪沒有存下來，我這一輪也沒有重抓。手抄譜本身是 1761 年的，二維公有領域作品的照片不會產生新的著作權，但出處那一行要等有人把 Commons 的檔名補上。
- **全曲**照 Boosey 1915 讀：*National Anthems, Salutes, and Official Marches as used in H.M. Navy*（London／New York／Toronto: Boosey & Co.，1915；扉頁寫「These Anthems, &c., may be performed in public without Fee or License」）。用的是 No.41「SPAIN」，大譜表鋼琴縮譜，♩=120。
  - 掃描本是 Internet Archive `national-anthems-salutes-and-official-marches-as-used-in-h.-m.-navy_202107`，影像葉 n37（上一輪存成 `dl_hmnavy/n37f.jpg`，3200×5102）。
  - 版權：編曲者不具名，1915 年出版。美國 1931 年以前出版的作品已經是公有領域；英國的不具名作品是出版後 70 年，1985 年就到期了。而且我們只取旋律（十八世紀的曲子），Boosey 的和聲、伴奏一個音都沒有照抄。

### 為什麼合適：三叉戟號那一幕

- 這是十八世紀西班牙軍隊的擲彈兵進行曲。照上面的二手說法，1770 年起它是西班牙王室的榮譽進行曲，後來就成了西班牙國歌（Boosey 1915 把它列為「Spain」的國歌，這一點是一手）。
- 三叉戟號是西班牙的 74 砲戰列艦，掛波旁王朝的旗子出場，配這首最直接。
- 1761 年的原譜是寫給**兩支橫笛＋小鼓**的，所以 A 段照那個編制寫。B 段起換成小號＋法國號＋定音鼓，當作「王室榮譽進行曲」的排場。後半是我們的改編，不是史實。
- ⚠ 「西班牙戰艦上奏這首向國王或軍旗致敬」我只有二手的印象，沒有找到出處，字幕不要寫。
- 六分儀那一段：A 段（0–8 秒）只有兩支橫笛加小鼓，很輕，可以墊在六分儀（1757 年前後的發明；這是二手常識）的特寫底下，接著在三叉戟號出場的時候（8 秒）小號進來。

### 轉譜用的原書

- **Boosey 1915 No.41 Spain**：降 B 大調、2/4、♩=120。
  - 結構：A 8 小節 :|| ‖: B 8 小節 :|| ‖: C 7 小節＋第一房、第二房 :|| ‖: D 8 小節 :||。
  - **C、D 段轉降 E 大調**：我用 6 倍、不內插的放大圖確認過調號（`view/ks_all.png`）。第 3、4 行的調號都是 B♭、E♭、A♭ 三個降記號，第 1、2 行是兩個。⚠ 第一次看的時候我把 E♭、A♭ 看成還原記號，讀成 F 大調，後來放大才改正。放大以後旋律也比較合理：C 段第 1–2 小節正好是 E♭ 和弦的分解（E♭ B♭｜G E♭ B♭）。
  - D 段最後一個和弦是 E♭5 C5 A♭4 F4（Fm7）。量過前面沒有臨時記號（`view/r3_8.png`），接著是 :||。頁面上看不到 Fine 或 D.C.。
- **讀法**：這一頁是大譜表和弦，旋律取右手的最上聲部。
  1. `navy18/tools2/bars.py` 找小節線。
  2. `heads2.py` 量音頭的塊。
  3. `topnote.py`：五線每 6 px 一行，用至少三條對得上的線擬合最上線；再從上往下找第一段高度在 0.75 個線距以上的暗段，避開橫樑與加線。量出每個和弦最上面那顆音頭的高度。
  4. 再把每兩小節（高音＋低音譜表）轉正、畫上音名格線放大看圖（`view/Q*.png`），讀時值，並對照量出來的數字。
  - ⚠ 這一頁的最上線有幾段印得很淡。我第一次用的工具因此把第二條線當成最上線，整個差了兩格，後來換成「至少三條對得上」的擬合才對。
- 量出來的最上聲部（`st` ＝ 離最上線 F5 幾個半格，`+` ＝ 往上）：
  - 第 1–8 小節：B♭5 +2.89｜D6 +5.28、B♭5 +2.93、F5 +0.05｜E♭5 −0.82、D5 −1.82、C5 −2.94、B♭4 −3.86｜B♭5 +2.69、A5 +1.93…｜B♭5 +2.61、C6 +4.21｜D6 +4.93、D6 +5.21（連音線）、F5 +0.08｜E♭5 −0.84、D5 −1.80、C5 −2.89、B♭4 −3.84｜F5 +0.04
  - 第 9–16 小節：F5 +0.20、D5 −2.05、F5 +0.06｜E♭5 −0.80、C5 −2.88、E♭5 −1.00｜D5 −1.96、B♭4 −3.79、D5 −1.92｜C5 −2.86、F5 +0.13、G5 +1.08、A5 +2.26｜B♭5 +3.31、C6 +4.08｜D6 +5.45、E♭6 +6.05、F6 +7.08、E♭6 +6.15｜D6 +5.41、C6 +4.17｜B♭5 +3.12
  - C 段：E♭5 −0.84、B♭4 −3.95｜G5 +1.00、E♭5 −1.05、B♭5 +3.13｜A♭5 +2.21、G5 +1.15、F5 +0.21、E♭5 −0.92｜E♭5 −1.06、D5 −1.92、C5 −3.11、B♭4 −3.91｜E♭5 −0.96、F5 +0.13｜G5 +0.89、B♭5 +2.92｜A♭5 +2.13、G5 +1.01、F5 +0.22、E♭5 −0.98｜第一房 [D5＋B♭5] +2.61、C5 −3.03、B♭4 −3.99、A♭4 −5.09｜第二房 [D5＋B♭5] +2.87
  - D 段：B♭5 +3.11、G5 +1.03、B♭5 +3.09｜A♭5 +2.05、（F5，pattern＋看圖）、A♭5 +2.04｜G5 +1.01、E♭5 −0.88、G5 +1.03｜（F5 看圖）、B♭4 −3.90、（C5 看圖）、D5 −2.07｜E♭5、F5（看圖）｜G5 +1.00、A♭5 +1.92、B♭5 +3.15、A♭5 +1.99｜G5 +0.93、F5 −0.02｜E♭5（看圖＋`r3_8.png`）
- 時值要另外確認的地方：
  - 第 1 房的四個音頭是八分：右手橫樑 10 px 厚，跟 A 段第 3 小節的八分橫樑（11 px）一樣，不是十六分。後面那兩點是反覆記號，不是休止。
  - 第 6 小節的連音線把 D6 拉成附點四分。
  - 第 14 小節是附點八分＋十六分＋兩個八分。
- **對照 1761 手抄譜**（Pífano 1º，G 大調）：第 1–3 小節的輪廓是 G5 D5｜B5 G5 D6｜C6 B5 A5 G5，正好是 Boosey 降小三度（B♭→G）。差別只有第 2 小節最後一個音：1761 寫高八度（D6），Boosey 是 F5（＝ G 大調的 D5）。
  - 這張影像的線距只有 7 px，第 4 小節以後音頭的位置量不準，所以**只對了前三小節與段落結構**（A 段 8 小節＋反覆）。

### 改編（都寫進了 src）

1. **反覆**：A B C（第一房）C（第二房）D，A、B、D 各奏一遍（原書每段都反覆）。這樣一遍是 40 小節、40 秒，D 段結在 Fm7，接回 A 的 B♭ 剛好可以一遍接一遍。
2. **配器**：
   - A 段照 1761 的編制：兩支橫笛＋小鼓。第二支橫笛是我配的，大多在下方六度或三度。
   - B 段起旋律換小號（`[I:trumpet]`），第二聲部換法國號。法國號是嗡–叭寫法：每拍低音一個八分（主音／五音）＋後半拍和弦一個八分。
   - 定音鼓：A、B 段用 B♭2／F2；C、D 段用 E♭2／B♭2，D 段結尾用 F2。
3. **和聲與低音是我照旋律配的**：
   - B 段（B♭）：I｜V7｜I｜V｜I–V｜I–V7｜I–V｜I。
   - C 段（E♭）：I｜I｜ii–V7｜I–V｜I–V7｜I｜ii–V7｜第一房 V–V7、第二房 V。
   - D 段：I｜V7｜I｜V｜IV–V7｜I–V7｜I–V7｜ii7（最後這個和弦照原書）。
   - Boosey 的鋼琴伴奏沒有照抄。
4. **調**：遊戲的 ABC 不能中途換調（沒有 `[K:]`），所以整首寫 `K:Bb`，C、D 段的 A 都寫成 `_A`／`_a`。同一小節之內沿用 ABC 的規則。
5. **第一房、第二房的 [D5＋B♭5]**：原書右手就是這兩個音一起，所以旋律聲部照寫成和弦。
6. **小鼓**：「八分、兩個十六分、八分、八分」。每段結尾打一個空拍；第一房與 D 段最後一小節加一串十六分，當作接回去的過門。

### 譜

```js
  { id: 'granadera', name: '擲彈兵進行曲', en: 'Marcha Granadera (Marcha Real)',
    src: '作者不詳（傳統說法：Manuel de Espinosa《Libro de Ordenanza de los toques militares de la Infantería Española》1761 的 La Marcha Granadera；1770 年起當西班牙的榮譽進行曲 —— 這兩點是二手來源）；旋律照 National Anthems, Salutes, and Official Marches as used in H.M. Navy（London: Boosey & Co. 1915）No.41 Spain 的最上聲部（Internet Archive national-anthems-salutes-and-official-marches-as-used-in-h.-m.-navy_202107 第 n37 葉），第 1 小節對過 Wikimedia Commons 的 1761 手抄譜影像（Pífano 1º，G 大調）；改編（TASK-0718）：反覆照 A B C（第一房）C（第二房）D、A B D 各奏一遍；A 段照 1761 的編制給兩支橫笛＋小鼓（第二支橫笛是我們配的六度／三度），B 段起換小號＋法國號（嗡–叭）＋定音鼓；低音、和聲、鼓都是我們照旋律配的（Boosey 的鋼琴伴奏沒有照抄）；C、D 段原書轉 E♭ 大調（三個降記號）⇒ 遊戲的 ABC 不能中途換調，A 都寫成 _A',
    abc: ['M:2/4', 'L:1/8', 'Q:1/4=120', 'K:Bb', 'V:1', 'V:2', 'V:3', 'V:4',
      '% Boosey 1915 No.41：B♭ 大調、2/4、♩=120；A 8 小節 :|| B 8 小節 :|| C（轉 E♭：三個降記號）7 小節＋第一房／第二房 :|| D（E♭）8 小節 :||（D 段結在 Fm7 ⇒ 接回 A 的 B♭）',
      '% V:1 旋律（A 橫笛、B 起小號）、V:2 第二支橫笛 ⇒ B 起法國號（低音＋後半拍和弦）、V:3 小鼓、V:4 定音鼓（B♭2／F2，C、D 段 E♭2／B♭2）',
      '% --- A（1–8）：1761 的編制 ＝ 兩支橫笛＋鼓 ---',
      '[V:1] [I:fife] !mf! b2 f2 | d\'2 b f | e d c B | b a g f | b2 c\'2 | d\'3 f | e d c B | f2 z2 |',
      '[V:2] [I:fife] !mp! f2 d2 | b2 f d | c B A F | d c B A | g2 a2 | b3 d | c B A F | c2 z2 |',
      '[V:3] [I:snare] !mp! C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C z |',
      '[V:4] [I:timpani] !mp! z4 | z4 | z4 | z4 | z4 | z4 | z4 | z4 |',
      '% --- B（9–16）：小號＋法國號＋定音鼓 ---',
      '[V:1] [I:trumpet] !mf! f2 d3/2 f/2 | e2 c3/2 e/2 | d2 B3/2 d/2 | c f g a | b2 c\'2 | d\'3/2 e\'/2 f\' e\' | d\'2 c\'2 | b2 z2 |',
      '[V:2] [I:horn] !mp! B,, [F,B,D] F,, [F,B,D] | F,, [F,A,E] C, [F,A,E] | B,, [F,B,D] F,, [F,B,D] | F,, [F,A,C] C, [F,A,C] | B,, [F,B,D] F,, [F,A,C] | B,, [F,B,D] F,, [F,A,E] | B,, [F,B,D] F,, [F,A,C] | B,, [F,B,D] z2 |',
      '[V:3] C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C z |',
      '[V:4] B,,2 F,,2 | F,,2 z2 | B,,2 F,,2 | F,,2 z2 | B,,2 F,,2 | B,,2 F,,2 | B,,2 F,,2 | B,,2 z2 |',
      '% --- C 第一遍（17–24）：原書轉 E♭ 大調（調號三個降記號 ⇒ A 寫成 _A）；第 24 小節 ＝ 第一房（往下走回 C 段開頭）---',
      '[V:1] e2 B2 | g2 e b | _a g f e | e d c B | e2 f2 | g3 b | _a g f e | [db] c B _A |',
      '[V:2] E,, [G,B,E] B,, [G,B,E] | E,, [G,B,E] B,, [G,B,E] | F,, [_A,CF] B,, [F,_A,D] | E,, [G,B,E] B,, [F,B,D] | E,, [G,B,E] B,, [F,_A,D] | E,, [G,B,E] B,, [G,B,E] | F,, [_A,CF] B,, [F,_A,D] | B,, [F,B,D] B,, [F,_A,D] |',
      '[V:3] C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C/2C/2C/2C/2 C/2C/2C/2C/2 |',
      '[V:4] E,,2 B,,2 | E,,2 B,,2 | z2 B,,2 | E,,2 B,,2 | E,,2 B,,2 | E,,2 B,,2 | z2 B,,2 | B,,2 B,,2 |',
      '% --- C 第二遍（25–32）：第 32 小節 ＝ 第二房（停在 B♭，接 D 段的 E♭）---',
      '[V:1] e2 B2 | g2 e b | _a g f e | e d c B | e2 f2 | g3 b | _a g f e | [db]2 z2 |',
      '[V:2] E,, [G,B,E] B,, [G,B,E] | E,, [G,B,E] B,, [G,B,E] | F,, [_A,CF] B,, [F,_A,D] | E,, [G,B,E] B,, [F,B,D] | E,, [G,B,E] B,, [F,_A,D] | E,, [G,B,E] B,, [G,B,E] | F,, [_A,CF] B,, [F,_A,D] | B,, [F,B,D] z2 |',
      '[V:3] C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C z |',
      '[V:4] E,,2 B,,2 | E,,2 B,,2 | z2 B,,2 | E,,2 B,,2 | E,,2 B,,2 | E,,2 B,,2 | z2 B,,2 | B,,2 z2 |',
      '% --- D（33–40）：還是 E♭ 大調（原書這一行的調號也是三個降記號）；結在 Fm7（E♭ C A♭ F，照原書）⇒ 接回 A 的 B♭ ---',
      '[V:1] b2 g3/2 b/2 | _a2 f3/2 a/2 | g2 e3/2 g/2 | f B c d | e2 f2 | g3/2 _a/2 b a | g2 f2 | e2 z2 |]',
      '[V:2] E,, [G,B,E] B,, [G,B,E] | B,, [F,_A,D] F,, [F,_A,D] | E,, [G,B,E] B,, [G,B,E] | B,, [F,B,D] F,, [F,B,D] | _A,, [_A,CE] B,, [F,_A,D] | E,, [G,B,E] B,, [F,_A,D] | E,, [G,B,E] B,, [F,_A,D] | F,, [_A,CE] z2 |]',
      '[V:3] C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C C/2C/2 C C | C/2C/2C/2C/2 C/2C/2 C |]',
      '[V:4] E,,2 B,,2 | B,,2 z2 | E,,2 B,,2 | B,,2 F,,2 | z2 B,,2 | E,,2 B,,2 | E,,2 B,,2 | F,,2 z2 |]'] },
```

### 讀回（遊戲 `abcParse`，旋律 V:1；`音名:幾個八分`）

```
 1 | Bb5:2 F5:2
 2 | D6:2 Bb5 F5
 3 | Eb5 D5 C5 Bb4
 4 | Bb5 A5 G5 F5
 5 | Bb5:2 C6:2
 6 | D6:3 F5
 7 | Eb5 D5 C5 Bb4
 8 | F5:2
 9 | F5:2 D5:1.5 F5:0.5
10 | Eb5:2 C5:1.5 Eb5:0.5
11 | D5:2 Bb4:1.5 D5:0.5
12 | C5 F5 G5 A5
13 | Bb5:2 C6:2
14 | D6:1.5 Eb6:0.5 F6 Eb6
15 | D6:2 C6:2
16 | Bb5:2
17 | Eb5:2 Bb4:2
18 | G5:2 Eb5 Bb5
19 | Ab5 G5 F5 Eb5
20 | Eb5 D5 C5 Bb4
21 | Eb5:2 F5:2
22 | G5:3 Bb5
23 | Ab5 G5 F5 Eb5
24 | D5+Bb5 C5 Bb4 Ab4
25 | Eb5:2 Bb4:2
26 | G5:2 Eb5 Bb5
27 | Ab5 G5 F5 Eb5
28 | Eb5 D5 C5 Bb4
29 | Eb5:2 F5:2
30 | G5:3 Bb5
31 | Ab5 G5 F5 Eb5
32 | D5+Bb5:2
33 | Bb5:2 G5:1.5 Bb5:0.5
34 | Ab5:2 F5:1.5 Ab5:0.5
35 | G5:2 Eb5:1.5 G5:0.5
36 | F5 Bb4 C5 D5
37 | Eb5:2 F5:2
38 | G5:1.5 Ab5:0.5 Bb5 Ab5
39 | G5:2 F5:2
40 | Eb5:2
```

- 跟上面量出來、看圖讀出來的最上聲部逐音相同（第 24、32 小節的 D5＋B♭5 是和弦）。C、D 段的 A 讀回是 A♭（Ab5／Ab4），E 是 E♭，跟三個降記號的調號一致。

### parse 讀數

- 事件 636 個：旋律 115、第二支橫笛／法國號 266、小鼓 202、定音鼓 53。
- 一遍 80 拍 ＝ **40.00 秒**（Q=120，照原書 ♩=120）；`bgmPasses` 會奏 2 遍，約 80 秒。
- 音域：
  - 旋律 A♭4–F6（68–89；F6 在第 14 小節，小號）。
  - 第二聲部 E♭2–B♭5（39–82）：橫笛 F4–B♭5，法國號 E♭2–F4。
  - 定音鼓 E♭2–B♭2（39–46）。
  - 小鼓寫在 C4（60）。
- 每小節拍數、四個聲部等長都過了。後備配器（whistle／pluck／fiddle／accordion）讀數相同。

### 給影片剪接（一小節 1.000 秒）

- 0–8 秒：A 段，兩支橫笛＋小鼓。第 8 小節停在 F（半終止）。
- 8 秒：小號、法國號、定音鼓進來。
- 16 秒：B 段結束，結在 B♭（完全終止）。**短版剪 0–16 秒就是完整的一句。**
- 16–32 秒：C 段（E♭），23–24 秒是第一房，31–32 秒是第二房。
- 32–40 秒：D 段，結在 Fm7，接回開頭。

---

## 放進遊戲時要注意

- 兩首都是 `abc` 格式。要讓聲音設定頁選得到，就放進 `TUNES`，並補上 `inst`（`sndUI` 的提示是照這個列樂器名的）：
  - presidents：`inst: ['fife', 'fife']`
  - granadera：`inst: ['trumpet', 'horn']`
- `vol` 還沒定。要照 README 那一套量 A 加權 RMS（目標 −24.3…−25.1 dB）再補。presidents 是兩支橫笛在 A4–B5 這個高音域，大概會偏刺、偏大聲，量的時候特別注意。
- id `presidents`、`granadera` 跟現有的 TUNES／THEMES 以及其他年代的稿（battlecry、battlehymn、dutchman、folia、methimon、pavana、sakura、syrie、tedeum、zoientafo）都不撞名。

## 沒交的

- **Heart of Oak**（William Boyce 1759，Boyce 1779 年過世，公有領域）：沒做。
  - 上一輪沒有下載它的掃描（`dl_bdh` 是空的，那是西班牙國家圖書館的下載資料夾，跟 Boyce 無關）。
  - 這一段出場的船是西班牙的與美國的，皇家海軍的進行曲對不上。
  - 如果六分儀那一幕要英國的味道，或之後要給英國船，它是最對的候選（皇家海軍的官方進行曲）。那時候要另外找 1759–1760 年的原版或早期印本。
- `mg1769.jpg`（1769 La Marcha de Granaderos，單簧管＋橫笛＋鼓）：只有第一頁，所以沒用。

## 沒把握的地方

1. **presidents 主讀的是 Sonneck 1909 的排版抄本**，不是 Shaw 1802 原書。Willig 約 1805 的抄本（同頁）A 段骨架全對得上；1794 年的影印（Pl. XI）只對到樂段層級。B 段只有第 13 小節與最後一小節對過 Willig 版，其餘看過樂句、沒有逐音比。
2. **Phile 的作曲年份**：Sonneck 認為不能定在 1789。最早的印本他推定約 1793 年（PHEIL 殘頁），最早提到這首曲子的資料是 1794 年。
3. **granadera 的旋律來自 1915 年的鋼琴縮譜最上聲部**，所以第 36 小節「F5 B♭4 C5 D5」的 F5 有可能是和聲音（內聲部的 D5 才是旋律）。我照最上聲部寫了。
4. **1761 手抄譜只對了前三小節**，第 2 小節最後一個音差一個八度。1761 與 1770 的史實、Commons 影像的檔案頁都是二手，或者還沒補出處。
5. **Boosey 頁面看不到 Fine／D.C.**。D 段結在 Fm7 照原書，但原書是不是要 D.C. 回到 A、結在 B 段，我不確定。我們的循環剛好不需要知道這一點。
6. **兩首都沒錄音、沒量響度**：樂器已經在 worktree 裡，但這一輪只做了解析，Tim 還沒聽過。
7. Boosey 那一頁左邊空白處有人用筆寫了字（看得出「Present」），是這本書的前一位使用者寫的，跟譜無關。

## 檔案

- 研究稿：`C:/Users/Tim/AppData/Local/Temp/claude/D--Unity-Senate/860cbc18-7707-4222-ab5f-2404c8bb7572/scratchpad/music/era_navy18.md`（就是這份）
- 譜：`…/scratchpad/music/tools/era_navy18_tunes.cjs`（兩首＋`FALLBACK=1` 後備配器）
- 解析檢查：`node tools/parse_check.cjs ../bs_music/src/js/02_music.js $(pwd)/tools/era_navy18_tunes.cjs fife,snare,bassdrum,trumpet,horn,timpani`
- 讀回：`navy18/tools2/readback.cjs`（同 parse_check 的抽法，逐小節印某個聲部）。用法：`node navy18/tools2/readback.cjs ../bs_music/src/js/02_music.js $(pwd)/tools/era_navy18_tunes.cjs 樂器… 曲id 聲部`
- 讀譜工具（只給人讀，不辨識音符）：`navy18/tools2/` 的 barcrop.py（轉正＋音名格線）、pitchat.py（單一音頭量高度）、topnote.py（和弦最上那顆）、heads2.py、bars.py、colprof.py、msgrid.py（手抄譜斜的格線）、montage.py、stack.py、emit.cjs（把譜印成上面那種 JS 物件）
- 讀譜筆記：`navy18/notes.md`；放大圖：`navy18/view/`（S*.png ＝ Shaw、F*.png ＝ Willig 橫笛、Q*.png ＝ Boosey、plateXI_full.png、ks_all.png、g61_*.png ＝ 1761）
- 原書影像（不入版控，上一輪下載的）：`navy18/dl_sonneck/`、`navy18/dl_hmnavy/`、`navy18/dl_commons/`

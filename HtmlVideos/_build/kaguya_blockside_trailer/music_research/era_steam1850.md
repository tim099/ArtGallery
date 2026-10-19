# 1850 年代（蒸汽）兩首 —— TASK-0718 研究稿

| id | 中文名 | 原名 | 來源 | 用在 | 一遍 | 事件 | MIDI |
|---|---|---|---|---|---|---|---|
| `syrie` | 出征敘利亞 | Partant pour la Syrie | Hortense de Beauharnais，約 1807 | 拿破崙號（1850）、光榮號（1859） | 39.23 秒（Q=104，17 小節） | 331 | 34–77（Bb1–F5） |
| `sakura` | 櫻花 | さくら（Sakura Sakura） | 江戶時代的箏曲歌謠，1888《箏曲集》No.2 | 1853 黑船（蘇士奎哈納號、培里艦隊） | 56.84 秒（Q=76，18 小節） | 115 | 52–76（E3–E5） |

- 譜都是我自己從公有領域的原書影像逐小節讀出來寫成 ABC 的；網路上別人的轉譜只拿來對照（`sakura` 那一份），一個音也沒有抄。
- 遊戲檔（`bs_music/src/js/02_music.js`）沒有動、沒有 commit、沒有跑 admin.py 建置，也沒有開 Chrome。
- 新樂器四種：`brass`、`horn`、`snare`、`koto`（規格寫在最後面）。做好之前可以用後備配器試聽：brass → fiddle、horn → accordion、snare → 拿掉第 3 聲部、koto → pluck；後備版也解析過。

---

## (a) `syrie` 出征敘利亞（Partant pour la Syrie）

- **作者、年代**：Hortense de Beauharnais（1783–1837，拿破崙三世的母親）約 1807 年作曲，詞是 Alexandre de Laborde（1773–1842）。也有人說曲子是 Louis Drouet（1792–1873）寫的。不管算誰的，作者都過世很久，旋律在 1810 年以前就出版了 ⇒ 公有領域。
- **為什麼適合**：這首是法蘭西第二帝國（1852–1870）實質上的國歌。1855 年 Ditson 版的扉頁就寫 "now the national air of the French empire"。拿破崙號（1850 下水，第一艘從一開始就設計成蒸汽動力的戰列艦）、光榮號（1859，第一艘遠洋鐵甲艦）都是拿破崙三世的海軍，而這首正是他母親寫的歌。檢閱、下水典禮上軍樂隊吹的就是它。
- **轉譜用的原書**：*The Departure for Syria = Partant pour la Syrie: romance / composed by Made. Hortense*，Boston: Oliver Ditson，約 1855，人聲加鋼琴，5 頁。Gaylord Music Library（Washington University in St. Louis）藏，Internet Archive `gml-us1850s-34-horte-depar`（https://archive.org/details/gml-us1850s-34-horte-depar）。
  - 譜在第 3 頁（IA 頁面影像 n2）和第 4 頁第 1 行（n3）。我讀的是人聲那一行第 1 段：弱起加 16 小節，降 E 大調（三個降記號）、C（4/4）。每一小節都把影像裁切放大、對著五線找音高，逐個音讀。
  - 自己對自己：第 4 頁第 2–4 行的第 2 段（"Il trace sur la pierre…"）是另外刻的版，弱起到第 12 小節跟第 1 段一個音都不差。
- **另一份獨立的公有領域版本拿來對照**：M. Holst，*The favorite air Partant pour la Syrie, arranged with variations for the piano forte or harp, with an accompaniment for the flute*，London: Bedford Musical Repository，1825。BYU Harold B. Lee Library 藏，Internet Archive `favoriteairparta00hols`，第 3 頁 "Andante" 主題的鋼琴右手，F 大調（比 Ditson 高一個全音）。降一個全音之後：
  - 一樣：弱起、第 1 小節（B♭. B♭ c d）、第 5 小節（第一拍是升高的四級音 A♮）、第 7 小節（Holst 把迴音寫成 C–B♮–A–B♮，就是 Ditson 那個 A♮ 上的迴音）、第 8 小節（B2 z B）、第 9 小節（A♭ B♭ G B♭）、第 10 小節（A♭. G F B♭）、第 12 小節（F2 z B♭ A♭）、第 13 小節（G. A♭ B♭ c d e）、第 14 小節（f. d B♭…）、第 15–16 小節的收尾（e. e d e f｜e）。
  - 不一樣：第 2–4、6、11 小節 Holst 加了裝飾（變奏曲的主題本來就會加花），Ditson 是平的。第 5 小節的第二個音兩版不同。⇒ 照年代比較近、又沒有加花的 Ditson 版。
- **原書第 1 段（L:1/8）**：`B/2 | B3 B c2 d2 | e3 f d2 z B | e2 B2 G2 B2 | F4 z2 B2 | =A3 A B3 c | d3 c B2 z B | c2 G2 =A3 c | B4 z2 B2 | A2 B2 G2 B2 | A3 G F2 B2 | A2 B2 G2 c3/2 B/2 | F4 z2 B A | G3 A B c d e | f3 d B2 z B | e3 e d2 e3/2 f/2 | e2 z2 z4`
- **改編**（都寫進了 src）：
  1. 配成進行曲：旋律給 `brass`（短號／小號），第 2 聲部 `horn` 用「嗡–叭」的寫法：第 1、3 拍是低音（B♭1–F2），第 2、4 拍是後半拍的短和弦（F3–E♭4）；第 3 聲部 `snare` 是法式 *pas redoublé* 的鼓點。
  2. 前面加了第 0 小節：鼓加低音的前奏，旋律只有最後一個十六分音符的弱起 B♭。這樣每一遍都從一個完整的小節開始，接起來不會錯拍；第 16 小節最後兩拍空著當換氣，接著鼓再帶下一遍。
  3. 省略的裝飾：第 2、7、11、15 小節的迴音記號，第 12 小節 F 上的倚音（引擎沒有裝飾音）。第 11 小節迴音上方那個升記號（A♮）只留在和聲的想法裡。
  4. 低音與和聲是我照旋律配的（原書鋼琴伴奏沒有照抄）：I–V、V/V（F7，帶 A♮）–V、ii（Cm）–V/V、V7–I、IV–V、ii7（Fm7）–V、IV–V7–I。旋律的音高和節奏一個都沒改。
  5. 速度：原書沒有寫速度記號（Ditson 版沒有 tempo 字），定成 Q=104 走進行曲；原曲是 romance，這裡改成軍樂的走法。
- **解析檢查**：事件 331 個（旋律 61、法國號 136、小鼓 134），一遍 68 拍 ＝ 39.23 秒，MIDI 34–77（Bb1–F5）。旋律 F4–F5、法國號 Bb1–Eb4、小鼓的音寫在 C4。`bgmPasses` 2 遍 ≈ 78.5 秒。後備配器（fiddle＋accordion、沒有小鼓）：197 個事件、39.23 秒。
- **給影片剪接**：一小節 2.308 秒。旋律弱起在 2.19 秒；樂句結尾在第 4 小節末 11.54 秒、第 8 小節末 20.77 秒（半終止）、第 12 小節末 30.00 秒、第 16 小節末 39.23 秒（完全終止）。

```js
  { id: 'syrie', name: '出征敘利亞', en: 'Partant pour la Syrie',
    src: 'Hortense de Beauharnais 約 1807（詞 A. de Laborde）；旋律照 Ditson 版 The Departure for Syria（Boston 約 1855，Internet Archive gml-us1850s-34-horte-depar 第 3–4 頁人聲），對過 M. Holst 變奏曲主題（London 1825，favoriteairparta00hols 第 3 頁）；改編（TASK-0718）：前面加一小節小鼓＋低音當前奏，迴音記號與第 12 小節的倚音省略，法國號低音＋後半拍和弦、小鼓是照旋律配的',
    abc: ['M:4/4', 'L:1/8', 'Q:1/4=104', 'K:Eb', 'V:1', 'V:2', 'V:3',
      '% 第 0 小節：前奏（鼓＋低音一小節，旋律只有最後一個十六分的弱起 B）；1–16 ＝ 原曲一段（Ditson 1855 第 3 頁第 2 行起）',
      '[V:1] [I:brass] !mf! z4 z3 z/2 B/2 | B3 B c2 d2 | e3 f d2 z B | e2 B2 G2 B2 | F4 z2 B2 | =A3 A B3 c | d3 c B2 z B | c2 G2 =A3 c | B4 z2 B2 |',
      '[V:2] [I:horn] !mp! E,,2 [G,B,E] z B,,,2 [G,B,E] z | E,,2 [G,B,E] z B,,,2 [F,B,D] z | E,,2 [G,B,E] z B,,,2 [F,A,D] z | E,,2 [G,B,E] z B,,,2 [G,B,E] z | B,,,2 [F,B,D] z F,,2 [F,B,D] z | F,,2 [=A,CE] z B,,,2 [F,B,D] z | B,,,2 [F,B,D] z F,,2 [F,B,D] z | C,,2 [G,CE] z F,,2 [=A,CE] z | B,,,2 [F,B,D] z F,,2 [F,A,D] z |',
      '[V:3] [I:snare] !mf! C2 C/2C/2C C2 C/2C/2C/2C/2 | !mp! C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C/2C/2C/2C/2 C C |',
      '% 9–16（Ditson 第 3 頁第 4 行起、第 4 頁第 1 行）',
      '[V:1] A2 B2 G2 B2 | A3 G F2 B2 | A2 B2 G2 c3/2 B/2 | F4 z2 B A | G3 A B c d e | f3 d B2 z B | e3 e d2 e3/2 f/2 | e2 z2 z4 |]',
      '[V:2] B,,,2 [F,A,D] z E,,2 [G,B,E] z | A,,2 [A,CE] z B,,,2 [F,B,D] z | B,,,2 [F,A,D] z E,, [G,B,E] F,, [A,CE] | B,,,2 [F,B,D] z F,,2 [F,A,D] z | E,,2 [G,B,E] z B,,,2 [G,B,E] z | B,,,2 [F,B,D] z F,,2 [F,A,D] z | A,,2 [A,CE] z B,,,2 [F,A,D] z | E,,2 [G,B,E]2 z4 |]',
      '[V:3] C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C/2C/2C/2C/2 C C | C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C C/2C/2 C z | C C/2C/2 C z C C/2C/2 C z | !mf! C2 z2 z4 |]'] },
```

---

## (b) `sakura` 櫻花（さくら）

- **來源、年代**：江戶時代的箏曲歌謠，作者不詳。第一次印出來是文部省音樂取調掛 編《箏曲集》，文部省編集局，明治 21 年（1888）10 月；英文扉頁是 *Collection of Japanese Koto Music by Tōkyō Academy of Music, Published by the Department of Education*。這是第二曲「櫻」。歌詞頁的曲名旁邊註「旧 咲た桜」，也就是舊曲〈咲いた桜〉重新填詞，旋律比 1888 年更早。日本政府出版品、無名氏的舊曲 ⇒ 公有領域；國立國會圖書館標的是 PDM（Public Domain Mark）。
- **為什麼適合**：1853 年培里的黑船開進浦賀，碰到的就是這個江戶的日本；這首是當時練箏的入門曲。譜照原書用平調子、都節音階（陰旋法：E F A B C），沒有任何升降記號。
- **轉譜用的原書**：國立國會圖書館數位典藏 info:ndljp/pid/857651（https://dl.ndl.go.jp/pid/857651 ，IIIF `https://dl.ndl.go.jp/api/iiif/857651/R00000NN/full/full/0/default.jpg`），請求記號 16-41。
  - 影像 R0000022 右頁下方：「No. 2 櫻 Sakura」第 1–4 小節。影像 R0000023 左頁：第 5–14 小節，加上第 15–18 小節箏的尾奏。五線譜上有片假名加羅馬字（"Sa-ku-ra sa-ku-ra ya-yo-i no so-ra wa…"），上面一行是歌唱、下面一行是箏（標指法 1／2／3）。
  - 14 小節歌唱的部分，每一小節都放大對著五線讀過。第 8 小節的二分音符是 F4 還是 E4、第 13–14 小節，這幾處另外用原解析度再看過一次。
  - 同一頁的箏譜拿來對照：第 1–6、11–12 小節跟歌唱同度；第 7–10、14 小節高八度；第 13 小節箏填在歌唱休止的那一拍。⇒ 除了第 13 小節的填音，每一小節的音名都對得上。
- **外部對照（只拿來對照，沒有抄）**：R. Dittrich，*Nippon Gakufu*（Leipzig: Breitkopf & Härtel 1894，plate 20313）No.3「Sakura」，D 小調。IMSLP #367248 的掃描要過 CAPTCHA，我沒有去繞過它；改用 Tom Potter 2006 年捐給公有領域的轉譜（daisyfield.com 的 `NGS04-Sakura-Piano.xml`），抽出右手最高聲部來比：它的第 5–18 小節，降一個完全四度之後，就是我們的第 1–14 小節，音高、節奏全部一樣（它第 17 小節第一拍的 G4 是伴奏，我們那裡是休止）。
- **原書歌唱那一行（L:1/4）**：`A A B2 | A A B2 | A B c B | A B/2A/2 F2 | E C E F | E E/2C/2 B,2 | A B c B | A B/2A/2 F2 | E C E F | E E/2C/2 B,2 | A A B2 | A A B2 | z E F2 | B/2A/2 F E2`
- **原書箏的尾奏**：`[EF] e [EF] e | [EF]/2 [EF]/2 e/2 c/2 B A | B B/2A/2 F2 | [E,E]2 z2`（同一頁箏的那一行，E4＋F4 兩弦一起撥，最後 E3＋E4 八度）
- **改編**（都寫進了 src）：
  1. 旋律（原書歌唱那一行）跟尾奏都給 `koto`（撥一下就衰減，譜上的長度只決定下一個音什麼時候撥）。
  2. 第二部箏（`!p!`）是我配的：每小節第 1、3 拍撥一下平調子的空弦（E3、A3、B3、E4：E–B 五度、A–E 四度這種長音），只用都節音階裡的音；跟旋律同一時間同一個音的地方都避開了。沒有用西洋和聲。尾奏時拉成長音，最後一小節空著，讓 V1 最後那個八度自己響完。
  3. 速度：原書沒有寫，定成 Q=76。沒有 `!rit!`，因為要能一遍接一遍。
- **解析檢查**：事件 115 個（旋律＋尾奏 70、第二部箏 45），一遍 72 拍 ＝ 56.84 秒，MIDI 52–76（E3–E5）。旋律 E3–E5（E3 只出現在尾奏最後那個八度）、第二部 E3–E4。`bgmPasses` 2 遍 ≈ 113.7 秒。後備配器（pluck）：115 個事件、56.84 秒。
- **給影片剪接**：一小節 3.158 秒。樂句結尾在第 4 小節末 12.63 秒、第 8 小節末 25.26 秒、第 10 小節末 31.58 秒、第 14 小節末 44.21 秒（歌唱結束）；尾奏 44.21–56.84 秒。只要短版的話剪在 44.21 秒，結在 E。

```js
  { id: 'sakura', name: '櫻花', en: 'Sakura Sakura',
    src: '江戶時代箏曲歌謠（作者不詳）；照文部省音樂取調掛《箏曲集》（1888）No.2「櫻」：1–14 小節歌唱那一行、15–18 小節箏的尾奏（國立國會圖書館 pid 857651 第 22–23 影像），對過 Dittrich《Nippon Gakufu》（1894）No.3；改編（TASK-0718）：全給箏，第二部箏（弱）用平調子的空弦配長音',
    abc: ['M:4/4', 'L:1/4', 'Q:1/4=76', 'K:Am', 'V:1', 'V:2',
      '% 1888《箏曲集》No.2：都節音階（E F A B C）、沒有升降記號；1–14 ＝ 歌唱那一行，15–18 ＝ 箏的尾奏',
      '[V:1] [I:koto] !mf! A A B2 | A A B2 | A B c B | A B/2A/2 F2 | E C E F | E E/2C/2 B,2 | A B c B | A B/2A/2 F2 | E C E F |',
      '[V:2] [I:koto] !p! E,2 [A,E]2 | E,2 [A,E]2 | A,2 [E,A,]2 | A,2 [E,B,]2 | [E,B,]2 A,2 | A,2 E,2 | A,2 [E,A,]2 | A,2 [E,B,]2 | [E,B,]2 A,2 |',
      '[V:1] E E/2C/2 B,2 | A A B2 | A A B2 | z E F2 | B/2A/2 F E2 |',
      '[V:2] A,2 E,2 | E,2 [A,E]2 | E,2 [A,E]2 | A,2 [E,B,]2 | B,2 [E,B,]2 |',
      '% 尾奏（1888 原書箏的那一行）',
      '[V:1] [EF] e [EF] e | [EF]/2 [EF]/2 e/2 c/2 B A | B B/2A/2 F2 | [E,E]2 z2 |]',
      '[V:2] E,4 | A,4 | B,2 [E,B,]2 | z4 |]'] },
```

---

## 放進遊戲時要注意

- 兩首都是 `abc` 格式，放 `THEMES` 或 `TUNES` 都可以（`tuneEvents` 看到有 `abc` 就走 `abcTune`）。要讓聲音設定頁選得到，就放 `TUNES`。不過 `sndUI` 的按鈕提示是照 `(t.inst || BGM_INST)` 列樂器名，所以要補 `inst: ['brass', 'horn']`、`inst: ['koto', 'koto']`（真正發聲的樂器照 `[I:]`）。
- `vol` 還沒定：要等新樂器做好，照 README 那一套量 A 加權 RMS（目標 −24.3…−25.1 dB），再回頭補。
- 想先用現有樂器聽：把 `[I:brass]` 換成 `[I:fiddle]`、`[I:horn]` 換成 `[I:accordion]`，拿掉 `V:3` 和 `[V:3]` 那幾行；`[I:koto]` 換成 `[I:pluck]`。

## 要新增的樂器（給做樂器的那邊）

| 名字 | 給誰用 | 音域（這兩首實際用到的） | 想要的聲音 |
|---|---|---|---|
| `brass` 短號／小號 | syrie 旋律 | F4–F5 | 鋸齒波＋低通，起音時濾波器很快從 2× 打開到 6–8× f（那一下銅管的「叭」）；起音往上滑一點（−30 cent → 0，約 40 ms）；長音晚到的輕顫音。 |
| `horn` 法國號／低音號 | syrie 低音＋後半拍和弦 | Bb1–Eb4（低音 34–44，和弦 53–63） | 比 brass 圓、暗（低通大約 3–4× f）；和弦是短的八分音符要咬得清楚；低音要有夠多泛音，小喇叭才聽得到 Bb1。 |
| `snare` 小鼓 | syrie 第 3 聲部 | 譜上寫 C4（MIDI 60），音高可以不管 | 帶通／高通雜訊（約 1.5–5 kHz），衰減約 120 ms；加一點 180–200 Hz 的鼓皮短音。力度照 `!mp!`／`!mf!`。雜訊要用自己的 LCG（⛔ 不用 `Math.random`，可以重用 `bgmNoise`）。 |
| `koto` 箏 | sakura 兩個聲部 | E3–E5，會有兩弦一起撥（`[EF]`、`[E,E]`） | 撥一下就衰減（像 musicbox／pluck 那樣，譜上的長度只決定下一個音）；起音亮（爪子撥的）、低音弦響 2–3 秒、高音約 1 秒；起音時音高往下沉一點點（約 +15 cent → 0、30 ms）；可以送一點殘響。 |

## 檔案

- 研究稿、解析器：`C:/Users/Tim/AppData/Local/Temp/claude/D--Unity-Senate/860cbc18-7707-4222-ab5f-2404c8bb7572/scratchpad/music/harness_steam1850/tunes.js`（兩首＋後備配器表）、`check.js`（`node check.js <02_music.js>`：從遊戲檔原文抽出 `ABC_KEYS`…`tuneEvents`，INSTR 換成只有名字的樁，印事件數、秒數、MIDI 範圍、旋律逐小節的音名、後備配器）、`mxl_top.py`（對照用：抽 MusicXML 的最高聲部）
- 原書影像（不入版控）：`C:/Users/Tim/AppData/Local/Temp/claude/D--Unity-Senate/860cbc18-7707-4222-ab5f-2404c8bb7572/scratchpad/music/dl_ditson1855/`、`…/music/dl_holst1825/`、`…/music/dl_ndl857651/`；對照用的轉譜：`…/music/dl_daisyfield/`；裁切放大圖：`…/music/crops/`

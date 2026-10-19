# 1862 南北戰爭篇（漢普頓錨地：維吉尼亞號對莫尼特號、坎伯蘭號、國會號）—— TASK-0718 研究稿

| id | 中文名 | 原名 | 來源 | 用在 | 一遍 | 事件 | MIDI |
|---|---|---|---|---|---|---|---|
| `battlehymn` | 共和國戰歌 | Battle Hymn of the Republic | Howe 詞＋營歌「Glory, Hallelujah」，Boston: Oliver Ditson 1862 | 3 月 8 日：維吉尼亞號撞沉坎伯蘭號、燒國會號 | 40.80 秒（Q=100，17 小節） | 402 | 34–86（B♭1–D6） |
| `battlecry` | 自由的戰鬥吶喊 | The Battle Cry of Freedom | George F. Root 詞曲，Chicago: Root & Cady 1862 | 3 月 9 日：莫尼特號趕到、兩艘鐵甲艦對轟 | 36.43 秒（Q=112，17 小節） | 365 | 36–91（C2–G6） |

- 兩首的旋律都是我照公有領域的 1862 年原版掃描，逐小節讀成 ABC 的。⛔ 沒有參考任何網路上的 ABC、MIDI 或近代編曲；也沒有拿別人的轉譜來對照（這一輪沒有對照用的轉譜）。
- 用到的樂器：`fife`（橫笛）、`brass`（銅管合奏，這裡當短號／薩克斯號一類的軍樂隊銅管）、`horn`（法國號，這裡當低音號）、`snare`（小鼓）、`bassdrum`（大鼓）。這五種在 `bs_music` 的 `02_music.js` 裡已經有了（樂器工程師的改動，未提交）。
- 遊戲檔沒動、沒 commit、沒跑 admin.py build、沒開瀏覽器。上一輪已經下載的掃描都還能用，這一輪沒有重新下載。

---

## 原版掃描與驗證方法

**(1) The Battle Cry of Freedom**：*The battle cry of freedom / by Geo. F. Root*，Chicago: Root & Cady（95 Clark St.），1862。封面印「Entered according to act of Congress, in the year 1862, by Root & Cady」，頁腳印 `225 4`（版號 225）。Gaylord Music Library（Washington University in St. Louis）藏，Internet Archive `b94194191`（https://archive.org/details/b94194191 ）。

- 影像（IIIF，`https://iiif.archive.org/image/iiif/3/b94194191%2Fb94194191_jp2.zip%2Fb94194191_jp2%2Fb94194191_000<n>.jp2/full/<寬>,/0/default.jpg`）：0000 封面、0001 歌詞頁、0002 ＝ 第 3 頁（Introduction＋主歌前半）、0003 ＝ 第 4 頁（主歌後半＋CHORUS 開頭，四部合唱 Air／Alto／Tenor／Base＋鋼琴）、0004 ＝ 第 5 頁（副歌其餘）、0005 封底 Root & Cady 新書目（裡面也列了這首）。
- 本地檔：`music/dl_civilwar/bcf_0…5.jpg`（寬 1800）、`bcfmax_3.jpg`、`bcfmax_4.jpg`（原解析度約 3000×4030）。`bcfmax_2.jpg` 是 504 錯誤頁，不是圖。所以第 3 頁只有寬 1800 的版本（線距約 12.7 px），照指示沒有重新下載。
- 曲名下面寫 *(Rallying Song.)*，就是「Yes we'll rally round the flag, boys」那一套詞。第 2 頁另外印了「(Battle Song.)」那套詞「We are marching to the field, boys」（只有字，沒有譜）。所以這一份不一定是第一刷，但年份、出版社都對。
- Root 1895 年過世，1862 年出版 ⇒ 公有領域。

**(2) Battle Hymn of the Republic**：*Battle Hymn of the Republic, adapted to the favorite melody of "Glory, Hallelujah," written by Mrs. Dr. S. G. Howe, for the Atlantic Monthly*，Boston: Oliver Ditson & Co.（277 Washington St.），1862，版號 21454。封面印「Entered according to act of Congress AD 1862 by O. Ditson & Co. in the Clerk's Office of the Dist. Court of Mass.」。

- 封面手寫「Deposited April 9th 1862 / Recorded Vol. 37 Page 209」，下面蓋「COPYRIGHT LIBRARY July 17 1862」的章，書架號 M 1640 .B。也就是版權登記時繳交的那一份。
- 影像：Wikimedia Commons「File:Battle Hymn of the Republic (1862) 1.jpg」…「4.jpg」（灰階，約 3300×4340）。Commons 標的來源是美國國會圖書館 Music Division（digital ID muscivilwar.200000858）。這個 ID 我只從 Commons 的描述抄來，loc.gov 被 Cloudflare 擋住，沒有親自對過。
- 本地檔：`music/dl_civilwar/bhr_1…4.jpg`：1 封面、2 ＝ 第 3 頁（3 小節鋼琴前奏＋第 1 段主歌）、3 ＝ 第 4 頁（CHORUS，三行人聲＋鋼琴）、4 ＝ 第 5 頁（第 2–5 段詞，旋律同第 3 頁）。
- 原版沒寫作曲者。Howe 1910 年過世；曲子是 1850 年代的營會詩歌（Say, Brothers），有些目錄寫 William Steffe（1890 年過世），這一點是二手來源。不管算誰的，加上 1862 年出版 ⇒ 公有領域。

**驗證方法**（工具都在 `civ_tools/`）：
1. **量五線**：`heads2.py` 每 40 px 一格，用水平投影量五條線的 y，所以紙張歪斜、彎曲都照局部算。接著擦掉五線與符桿、找符頭，印出 x、音名，以及離線／間中心差幾個半格。實心符頭抓得到；二分音符的空心頭抓不到，另外看放大圖。
2. **看節奏**：每一小節都裁切放大（1.2–5 倍，`crop.py`、`gcrop.py` 會畫上各線、間的音名導線），對旗、附點、連桿、休止符。這兩份老譜的四分休止符是舊式的「Γ」形，八分休止符像「7」。
3. **有疑問的那一個音**：Battle Cry 第 3 頁第 3 小節的「of」，做了逐列像素剖面（下面詳述）。
4. **讀回**：最後用遊戲的 `abcParse` 把譜讀回來，逐小節印音名與拍數（`civ_tools/readback.cjs`），跟上面讀的比過。
5. **和聲**：原版鋼琴左手每一拍的音，也用 `heads2.py`（低音譜號）量過。低音聲部照這個和聲配。

---

## 1. `battlehymn` — 共和國戰歌（Battle Hymn of the Republic）

- **出處**：詞是 Julia Ward Howe（1819–1910）寫給《Atlantic Monthly》的。曲是「Glory, Hallelujah」（John Brown's Body），原版只寫「adapted to the favorite melody of」。讀的是 Ditson 1862 年版第 3 頁的人聲那一行（第 1 段主歌，弱起加 8 小節），以及第 4 頁 CHORUS 最上面一行（8 小節）。降 B 大調、C（4/4）。第 5 頁的第 2–5 段詞配的是同一個旋律（弱起照詞多幾個音）。那一頁沒有逐音讀，只看過大致相同。
- **為什麼合適**：
  - **場景**：1862 年 3 月 8 日那一幕（維吉尼亞號撞沉坎伯蘭號、砲擊並燒掉國會號），用在兩艘北軍木殼帆船的最後一戰。主歌用銅管，莊重；副歌「Glory, glory, hallelujah… His truth is marching on」接在坎伯蘭號旗子還掛著就沉下去的那一刻。「坎伯蘭號沉沒時旗還在桅上、砲打到最後」是常見的戰史敘述，我沒有讀一手文獻，屬於二手。遊戲裡坎伯蘭號、國會號是 `names_pub` 的艦名，套在北軍那邊的巡防艦上。
  - **年代**：一手的部分是封面寫「for the Atlantic Monthly」，以及手寫的「Deposited April 9th 1862」。⇒ 樂譜在漢普頓錨地之戰（3 月 8–9 日）之後一個月送交版權登記。詩刊在《Atlantic Monthly》1862 年 2 月號（二手：常見的文學史資料，我沒看到雜誌本身）。⇒ 開戰那天，詞已經印出來一個月了；曲子是 1861 年起北軍行軍時最流行的歌（二手）。
  - ⚠ 我沒有查到任何記載說這首在漢普頓錨地的船上唱過或奏過。字幕不要寫「當時艦上唱的是這首」。
- **配器**：
  - 旋律 `brass`（短號類的銅管合奏，原調 D4–D5）；副歌加 `fife` 高八度（D5–D6）。
  - `horn` 寫「嗡–叭」：第 1、3 拍低音（B♭1–F2），第 2、4 拍短和弦（F3–E♭4）。和聲照原版鋼琴：主歌、副歌都是 I I IV I｜I I IV–V7 I。
  - `snare` 在主歌輕（每拍、八分）、副歌密一點；`bassdrum` 主歌只打第 1 拍、副歌打 1、3 拍。

```js
  { id: 'battlehymn', name: '共和國戰歌', en: 'Battle Hymn of the Republic', inst: ['brass', 'horn'],
    src: "Julia Ward Howe 詞（寫給 Atlantic Monthly，1862）；曲是當時的營歌「Glory, Hallelujah」（John Brown's Body；原版沒寫作曲者）；旋律照 Boston: Oliver Ditson & Co. 1862 原版逐音讀（plate 21454；美國國會圖書館 Music Division 藏本，Wikimedia Commons「Battle Hymn of the Republic (1862) 1–4.jpg」，第 3 頁主歌、第 4 頁 Chorus 的人聲那一行，降 B 大調 4/4）；改編（TASK-0718）：原版 3 小節鋼琴前奏沒用，改成一小節鼓（旋律只有最後半拍的弱起 Mine）；主歌銅管吹原調，副歌加橫笛高八度；法國號「嗡–叭」照原版鋼琴每小節的和聲（I／IV／IV–V7）；小鼓、大鼓是配的；原版副歌結尾的反覆記號沒照做（每一遍主歌＋副歌各一次）",
    abc: ['M:4/4', 'L:1/8', 'Q:1/4=100', 'K:Bb', 'V:1', 'V:2', 'V:3', 'V:4', 'V:5',
      '% Ditson 1862：降 B 大調、C 拍號；第 0 小節 ＝ 鼓的前奏＋弱起「Mine」，1–8 ＝ 主歌 Mine eyes have seen the glory（第 3 頁），9–16 ＝ Chorus Glory, glory, hallelujah（第 4 頁）',
      '% 和聲（照原版鋼琴左手每小節的根音）：主歌、副歌都是 I I IV I | I I IV–V7 I',
      '% --- 主歌（銅管原調＋法國號嗡–叭、鼓輕）---',
      '[V:1] [I:brass] !mf! z4 z2 z F | F F F3/2 E/2 D3/2 F/2 B3/2 c/2 | d3/2 d/2 d3/2 c/2 B2 z B/2 B/2 | G3/2 G/2 G3/2 A/2 B3/2 B/2 A3/2 G/2 | F3/2 G/2 F3/2 D/2 F2 z F/2 F/2 | F3/2 F/2 F3/2 E/2 D3/2 F/2 B3/2 c/2 | d3/2 d/2 d3/2 c/2 B2 z B | c2- c3/2 c/2 B2 A2 | B4 z4 |',
      '[V:2] [I:fife] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 |',
      '[V:3] [I:horn] !mp! z8 | B,,,2 [F,B,D] z F,,2 [F,B,D] z | B,,,2 [F,B,D] z F,,2 [F,B,D] z | E,,2 [G,B,E] z B,,,2 [G,B,E] z | B,,,2 [F,B,D] z F,,2 [F,B,D] z | B,,,2 [F,B,D] z F,,2 [F,B,D] z | B,,,2 [F,B,D] z F,,2 [F,B,D] z | E,,2 [G,CE] z F,,2 [F,A,E] z | B,,,2 [F,B,D] z F,,2 [F,A,E] z |',
      '[V:4] [I:snare] !mf! C2 C/2C/2C C/2C/2C C/2C/2C | !mp! C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C/2C/2C C/2C/2C/2C/2 C C |',
      '[V:5] [I:bassdrum] !mp! C,2 z2 C,2 z2 | C,2 z6 | C,2 z6 | C,2 z6 | C,2 z6 | C,2 z6 | C,2 z6 | C,2 z6 | C,2 z6 |',
      '% --- Chorus：Glory, glory, hallelujah（橫笛高八度加進來）---',
      '[V:1] !f! F3 E D3/2 F/2 B3/2 c/2 | d4 B2 z2 | G3/2 G/2 G3/2 A/2 B3/2 B/2 A3/2 G/2 | F2 D2 F4 | F3 E D3/2 F/2 B3/2 c/2 | d4 B2 z B | c2 c2 B2 A2 | B4 z4 |]',
      "[V:2] !mf! f3 e d3/2 f/2 b3/2 c'/2 | d'4 b2 z2 | g3/2 g/2 g3/2 a/2 b3/2 b/2 a3/2 g/2 | f2 d2 f4 | f3 e d3/2 f/2 b3/2 c'/2 | d'4 b2 z b | c'2 c'2 b2 a2 | b4 z4 |]",
      '[V:3] !mf! B,,,2 [F,B,D] z F,,2 [F,B,D] z | B,,,2 [F,B,D] z F,,2 [F,B,D] z | E,,2 [G,B,E] z B,,,2 [G,B,E] z | B,,,2 [F,B,D] z F,,2 [F,B,D] z | B,,,2 [F,B,D] z F,,2 [F,B,D] z | B,,,2 [F,B,D] z F,,2 [F,B,D] z | E,,2 [G,CE] z F,,2 [F,A,E] z | B,,,2 [F,B,D] z z4 |]',
      '[V:4] !mf! C C/2C/2 C C C C/2C/2 C C | C C/2C/2 C C C C/2C/2 C C | C C/2C/2 C C C C/2C/2 C C | C2 C/2C/2C C/2C/2C/2C/2 C C | C C/2C/2 C C C C/2C/2 C C | C C/2C/2 C C C C/2C/2 C C | C C/2C/2 C C C C/2C/2 C C | C2 C/2C/2C C2 z2 |]',
      '[V:5] !mf! C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 z4 |]'] },
```

- **原譜對照**（L:1/8，`3/2` ＝ 附點八分、`/2` ＝ 十六分，降 B 大調照調號）：
  - 第 3 頁第 2 行：`z4 z2 z F | F F F3/2 E/2 D3/2 F/2 B3/2 c/2 | d3/2 d/2 d3/2 c/2 B2 z B/2 B/2 |`（Mine ｜ eyes have seen the glo-ry of the ｜ com-ing of the Lord; He is）
  - 第 3 頁第 3 行：`G3/2 G/2 G3/2 A/2 B3/2 B/2 A3/2 G/2 | F3/2 G/2 F3/2 D/2 F2 z F/2 F/2 | F3/2 F/2 F3/2 E/2 D3/2 F/2 B3/2 c/2 |`
  - 第 3 頁第 4 行：`d3/2 d/2 d3/2 c/2 B2 z B | c2- c3/2 c/2 B2 A2 | B4 z4 ‖`（「truth」的 C 跟後面那個 C 用弧線連著、同音 ⇒ 連音線）
  - 第 4 頁第 1 行：`F3 E D3/2 F/2 B3/2 c/2 | d4 B2 z2 | G3/2 G/2 G3/2 A/2 B3/2 B/2 A3/2 G/2 | F2 D2 F4 |`（第 4 小節 F–D 有圓滑線，同一個字「lu」）
  - 第 4 頁第 2 行：`F3 E D3/2 F/2 B3/2 c/2 | d4 B2 z B | c2 c2 B2 A2 | B4 z4 :‖`
  - 鋼琴左手每拍一個低音，每小節的根音：第 3 頁是 B♭ B♭ E♭ B♭ B♭ B♭（E♭ E♭ F F）B♭，第 4 頁同樣。（E♭ E♭ F F）那一小節的 E♭ 是八度。最後一小節左手有一串下行的八分／十六分，沒照抄。
- **改編**：
  1. 原版 3 小節鋼琴前奏沒用。前面加第 0 小節：一小節鼓，旋律只有最後半拍的弱起「Mine」。每一遍都從完整的一小節開始，接起來不會錯拍。
  2. 原版副歌結尾的反覆記號（:‖）沒照做：一遍 ＝ 主歌一次＋副歌一次。
  3. 速度：原版沒寫，定成 Q=100。
  4. 「嗡–叭」的和弦配置、橫笛高八度、兩個鼓都是配的。和聲本身照原版鋼琴，旋律的音高、節奏一個都沒改。
- **讀回**（遊戲 `abcParse`，第 1 聲部，拍 ＝ 四分音符，沒寫 ＝ 1 拍）：

```
battlehymn 聲部 0 移調 0 音數 83 長度 68 拍
   0 | F4:0.5
   1 | F4:0.5 F4:0.5 F4:0.75 Eb4:0.25 D4:0.75 F4:0.25 Bb4:0.75 C5:0.25
   2 | D5:0.75 D5:0.25 D5:0.75 C5:0.25 Bb4 Bb4:0.25 Bb4:0.25
   3 | G4:0.75 G4:0.25 G4:0.75 A4:0.25 Bb4:0.75 Bb4:0.25 A4:0.75 G4:0.25
   4 | F4:0.75 G4:0.25 F4:0.75 D4:0.25 F4 F4:0.25 F4:0.25
   5 | F4:0.75 F4:0.25 F4:0.75 Eb4:0.25 D4:0.75 F4:0.25 Bb4:0.75 C5:0.25
   6 | D5:0.75 D5:0.25 D5:0.75 C5:0.25 Bb4 Bb4:0.5
   7 | C5:1.75 C5:0.25 Bb4 A4
   8 | Bb4:2
   9 | F4:1.5 Eb4:0.5 D4:0.75 F4:0.25 Bb4:0.75 C5:0.25
  10 | D5:2 Bb4
  11 | G4:0.75 G4:0.25 G4:0.75 A4:0.25 Bb4:0.75 Bb4:0.25 A4:0.75 G4:0.25
  12 | F4 D4 F4:2
  13 | F4:1.5 Eb4:0.5 D4:0.75 F4:0.25 Bb4:0.75 C5:0.25
  14 | D5:2 Bb4 Bb4:0.5
  15 | C5 C5 Bb4 A4
  16 | Bb4:2
```

  跟上面的原譜對照逐音相同（第 7 小節的 C5:1.75 ＝ 四分連到附點八分）。第 2 聲部（橫笛）降八度後，就是第 9–16 小節同一串。
- **parse 讀數**：事件 402 個（銅管 83、橫笛 33、法國號 124、小鼓 137、大鼓 25），一遍 68 拍，Q=100 ⇒ **40.80 秒**。音域：銅管 D4–D5（62–74）、橫笛 D5–D6（74–86）、法國號 B♭1–E♭4（34–63）、小鼓譜上寫 C4（60）、大鼓寫 C3（48）。`bgmPasses` 2 遍 ≈ 81.6 秒。
- **給影片剪接**：一小節 2.40 秒。弱起「Mine」在 2.10 秒；主歌結束在「on」，19.2 秒（響到 20.4 秒）；副歌「Glory」從 21.6 秒起；最後的「on」在 38.4 秒（響到 39.6 秒）；一遍 40.8 秒。

---

## 2. `battlecry` — 自由的戰鬥吶喊（The Battle Cry of Freedom）

- **出處**：George F. Root（1820–1895）詞曲，Chicago: Root & Cady 1862。讀的是第 3 頁第 2–3 行、第 4 頁第 1 行的人聲那一行（主歌：弱起加 8 小節），以及第 4 頁第 2 行、第 5 頁兩行 CHORUS 的 Air（第一行，就是旋律；8 小節）。降 B 大調、C（4/4）。副歌上方標 *Fortissimo*。
- **為什麼合適**：
  - **場景**：1862 年 3 月 9 日那一幕。莫尼特號（`monitor`）夜裡趕到，第二天早上跟維吉尼亞號（`virginia`）鐵甲對鐵甲轟了一上午。這首是北軍最有名的「集結歌」：「Yes we'll rally round the flag… The Union forever」，節奏輕快，適合莫尼特號衝出來擋在擱淺的明尼蘇達號前面那一段（趕到的時間、擋在明尼蘇達號前面，都是常見的戰史敘述，二手）。如果遊戲要給船配主題曲，可以考慮 `monitor.theme = 'battlecry'`。這只是建議，我沒有改 game.json。
  - **年代**：一手的部分是封面的版權字樣「in the year 1862」。二手的部分：常見的說法是 Root 在 1862 年 7 月林肯號召 30 萬志願兵之後才寫這首。⇒ 它比漢普頓錨地之戰晚了大約四個月，代表的是「1862 年的北軍」，不是那兩天的現場。Root 的自傳《The Story of a Musical Life》（1891）應該是一手來源，我沒有讀到原文。
  - ⚠ 同樣沒有查到這首在莫尼特號上奏過的記載（莫尼特號是只有幾十名船員的小艦）。
- **配器**：
  - 旋律 `fife` 整段高八度（D5–G6），走「橫笛加鼓」的味道。
  - 副歌加 `brass` 吹原調（D4–G5），從弱起「The」進來，照原版的 *Fortissimo*。
  - `horn` 每拍一個低音，照原版鋼琴左手每一拍的根音，改成根音—五度交替（C2–F3）。
  - `snare` 進行曲鼓點；`bassdrum` 第 1、3 拍。

```js
  { id: 'battlecry', name: '自由的戰鬥吶喊', en: 'The Battle Cry of Freedom', inst: ['fife', 'horn'],
    src: "George F. Root 詞曲（Chicago: Root & Cady 1862，plate 225）；旋律照 Root & Cady 1862 原版逐音讀（Gaylord Music Library, Washington University in St. Louis 藏，Internet Archive b94194191，第 3–5 頁的人聲／Air 那一行，降 B 大調 4/4）；改編（TASK-0718）：原版 4 小節鋼琴前奏沒用，改成一小節鼓（旋律只有最後一拍的弱起 Yes we'll）；橫笛整段高八度，副歌（原版標 Fortissimo）加銅管吹原調；低音照原版鋼琴左手每一拍的和弦根音、改成根音—五度（法國號）；小鼓、大鼓是配的；最後一小節原版只有 3 拍（弱起 1 拍），補一拍休止",
    abc: ['M:4/4', 'L:1/8', 'Q:1/4=112', 'K:Bb', 'V:1', 'V:2', 'V:3', 'V:4', 'V:5',
      "% Root & Cady 1862：降 B 大調、C 拍號；第 0 小節 ＝ 鼓的前奏＋弱起「Yes we'll」，1–8 ＝ 主歌（第 3、4 頁），9–16 ＝ 副歌 The Union forever（第 4、5 頁）",
      '% 旋律原調 ＝ 橫笛那一行低八度（副歌銅管那一行就是原調）：主歌 B c | d d d3/2 c/2 B2 G3/2 A/2 | B B B3/2 A/2 G4 | F2 F3/2 E/2 D F B3/2 c/2 | d4 c2 B c | …；第 3 小節的「of」原版第 3 頁是 c（第 4、5 頁同一句是 d），照原版',
      '% 和聲（照原版鋼琴左手）：rally round the flag ＝ I I vi vi；rally once again ＝ Gm/D D7 E♭ E♭；shouting the battle cry of ＝ I I I I/D；Freedom ＝ I⁶₄ I⁶₄ V7（半終止）／V7 V7 I',
      '% --- 主歌（橫笛高八度＋法國號低音、鼓輕）---',
      "[V:1] [I:fife] !mf! z4 z2 b c' | d' d' d'3/2 c'/2 b2 g3/2 a/2 | b b b3/2 a/2 g4 | f2 f3/2 e/2 d f b3/2 c'/2 | d'4 c'2 b c' | d' d' d'3/2 c'/2 b2 g3/2 a/2 | b b b3/2 a/2 g4 | f2 f3/2 e/2 d f b3/2 d'/2 | c'4 b2 z f' |",
      '[V:2] [I:brass] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 | !f! z6 z f |',
      '[V:3] [I:horn] !mp! z8 | B,,2 F,,2 G,,2 D,,2 | D,2 D,,2 E,2 B,,2 | B,,2 F,,2 B,,2 D,2 | F,,2 C,2 F,,2 z2 | B,,2 F,,2 G,,2 D,,2 | D,2 D,,2 E,2 B,,2 | B,,2 F,,2 B,,2 D,2 | F,2 C,2 B,,2 z2 |',
      '[V:4] [I:snare] !mf! C2 C/2C/2C C/2C/2C C/2C/2C | !mp! C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C/2C/2C C/2C/2C/2C/2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C C C2 C C | C2 C/2C/2C C/2C/2C/2C/2 C C |',
      '[V:5] [I:bassdrum] !mf! C,2 z2 C,2 z2 | !mp! C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 |',
      '% --- 副歌 The Union forever（原版標 Fortissimo：銅管加進來吹原調）---',
      "[V:1] !f! f'2 d'3/2 e'/2 f' g'2 f' | f'2 d'3/2 e'/2 f'4 | f'2 d'3/2 e'/2 f' g'3 | f'2 d'3/2 b/2 c'2 b c' | d' d' d'3/2 c'/2 b2 g2 | b b b3/2 a/2 g4 | f2 f3/2 e/2 d f b3/2 d'/2 | c'4 b2 z2 |]",
      '[V:2] f2 d3/2 e/2 f g2 f | f2 d3/2 e/2 f4 | f2 d3/2 e/2 f g3 | f2 d3/2 B/2 c2 B c | d d d3/2 c/2 B2 G2 | B B B3/2 A/2 G4 | F2 F3/2 E/2 D F B3/2 d/2 | c4 B2 z2 |]',
      '[V:3] !f! B,,2 F,,2 B,,2 F,,2 | B,,2 F,,2 B,,4 | B,,2 F,,2 B,,2 F,,2 | B,,2 G,,2 F,, E,, D,, C,, | B,,2 F,,2 G,,2 D,,2 | D,2 D,,2 E,2 B,,2 | B,,2 F,,2 B,,2 D,2 | F,2 C,2 B,,2 z2 |]',
      '[V:4] !mf! C C/2C/2 C C C C/2C/2 C C | C C/2C/2 C C C C/2C/2 C C | C C/2C/2 C C C C/2C/2 C C | C2 C/2C/2C C/2C/2C/2C/2 C C | C C/2C/2 C C C C/2C/2 C C | C C/2C/2 C C C C/2C/2 C C | C C/2C/2 C C C C/2C/2 C C | C2 C2 C2 z2 |]',
      '[V:5] !mf! C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 | C,2 z2 C,2 z2 |]'] },
```

- **原譜對照**（L:1/8；以下是原調，橫笛那一行高八度）：
  - 第 3 頁第 2 行：`z4 z2 B c | d d d3/2 c/2 B2 G3/2 A/2 |`（Yes we'll ｜ ral-ly round the flag, boys, we'll）。第 0 小節是二分休止、舊式「Γ」四分休止、兩個八分，剛好 4 拍。
  - 第 3 頁第 3 行：`B B B3/2 A/2 G4 | F2 F3/2 E/2 D F B3/2 c/2 | d4 c2 B c |`
  - 第 4 頁第 1 行：`d d d3/2 c/2 B2 G3/2 A/2 | B B B3/2 A/2 G4 | F2 F3/2 E/2 D F B3/2 d/2 |`
  - 第 4 頁第 2 行（CHORUS，Air）：`c4 B2 z f | f2 d3/2 e/2 f g2 f | f2 d3/2 e/2 f4 |`
  - 第 5 頁第 1 行：`f2 d3/2 e/2 f g3 | f2 d3/2 B/2 c2 B c | d d d3/2 c/2 B2 G2 |`
  - 第 5 頁第 2 行：`B B B3/2 A/2 G4 | F2 F3/2 E/2 D F B3/2 d/2 | c4 B2 ‖`（最後一小節 3 拍，配開頭 1 拍的弱起）
  - **第 3 頁第 3 小節的「of」是 c（C5），不是 d**：
    - 這一頁只有寬 1800 的影像，所以做了逐列像素剖面。x 1126–1143 這一欄，符頭佔 1531–1544 列，中心 1537.5；旁邊沒有音符的 x 1150–1175 量到 D5 線在 1531、B4 線在 1543.5 ⇒ 符頭正好在兩條線中間的間 ＝ C5。`heads2.py` 也報 C5，偏差 +0.05。
    - 同一句在第 4 頁第 1 行、第 5 頁第 2 行都是 d（D5），在原解析度的影像上放大確認過（`civ_tools/crops2/b4_z1.jpg`）。
    - 上一輪的草稿三處都寫 d。這一輪照原版改成第一次 c、後兩次 d。
  - 鋼琴左手（和聲；第 4、5 頁原解析度量的，第 3 頁看起來一樣）：
    - rally round the flag, boys ＝ B♭ B♭ G G（I I vi vi）
    - rally once again ＝ D D E♭ E♭，右手第 2 拍有 F♯（Gm/D、D7、E♭、E♭）
    - shouting the battle-cry of ＝ B♭ B♭ B♭ D（I I I I/D）
    - Freedom（主歌中間，第 3 頁）＝ F F F，第 4 拍休止（半終止）；Freedom（主歌結尾、副歌結尾）＝ F F B♭（V7 V7 I）
    - 副歌 The Union forever、hurrah boys, hurrah、Down with the traitor ＝ 整小節 B♭
    - Up with the star; While we ＝ 左手下行 B♭ G F E♭ D C
- **改編**：
  1. 原版 4 小節鋼琴 Introduction 沒用。前面加第 0 小節：一小節鼓，旋律只有最後一拍的弱起「Yes we'll」。
  2. 原版最後一小節只有 3 拍，補一拍休止湊滿 4/4（遊戲的 `abcParse` 要每一小節剛好）。
  3. 橫笛整段高八度；副歌加銅管吹原調。
  4. 低音照原版左手每拍的根音，改成根音—五度交替。「rally once again」那幾小節（第 2、6、14 小節）第 2 拍是 D7，用 D 的低八度，不用五度 A。主歌中間的「Freedom」（第 4 小節）第 4 拍照原版休止。
  5. 速度：原版沒寫，定成 Q=112。兩個鼓都是配的。
- **讀回**（遊戲 `abcParse`，第 1 聲部橫笛，降一個八度印，方便跟原調比）：

```
battlecry 聲部 0 移調 -12 音數 88 長度 68 拍
   0 | Bb4:0.5 C5:0.5
   1 | D5:0.5 D5:0.5 D5:0.75 C5:0.25 Bb4 G4:0.75 A4:0.25
   2 | Bb4:0.5 Bb4:0.5 Bb4:0.75 A4:0.25 G4:2
   3 | F4 F4:0.75 Eb4:0.25 D4:0.5 F4:0.5 Bb4:0.75 C5:0.25
   4 | D5:2 C5 Bb4:0.5 C5:0.5
   5 | D5:0.5 D5:0.5 D5:0.75 C5:0.25 Bb4 G4:0.75 A4:0.25
   6 | Bb4:0.5 Bb4:0.5 Bb4:0.75 A4:0.25 G4:2
   7 | F4 F4:0.75 Eb4:0.25 D4:0.5 F4:0.5 Bb4:0.75 D5:0.25
   8 | C5:2 Bb4 F5:0.5
   9 | F5 D5:0.75 Eb5:0.25 F5:0.5 G5 F5:0.5
  10 | F5 D5:0.75 Eb5:0.25 F5:2
  11 | F5 D5:0.75 Eb5:0.25 F5:0.5 G5:1.5
  12 | F5 D5:0.75 Bb4:0.25 C5 Bb4:0.5 C5:0.5
  13 | D5:0.5 D5:0.5 D5:0.75 C5:0.25 Bb4 G4
  14 | Bb4:0.5 Bb4:0.5 Bb4:0.75 A4:0.25 G4:2
  15 | F4 F4:0.75 Eb4:0.25 D4:0.5 F4:0.5 Bb4:0.75 D5:0.25
  16 | C5:2 Bb4
```

  跟原譜對照逐音相同；第 3 小節最後是 C5:0.25，第 7、15 小節是 D5:0.25。第 2 聲部（銅管，原調）印出來就是第 8 小節的 F5:0.5 加上第 9–16 小節同一串。
- **parse 讀數**：事件 365 個（橫笛 88、銅管 42、法國號 62、小鼓 139、大鼓 34），一遍 68 拍，Q=112 ⇒ **36.43 秒**。音域：橫笛 D5–G6（74–91）、銅管 D4–G5（62–79）、法國號 C2–F3（36–53）、小鼓 C4（60）、大鼓 C3（48）。`bgmPasses` 2 遍 ≈ 72.9 秒。
- **給影片剪接**：一小節 2.143 秒。弱起「Yes」在 1.61 秒；主歌中間的半終止「Freedom」結束在 10.18 秒；副歌的弱起「The」在 19.02 秒，強拍 19.29 秒；最後的「Freedom」結束在 35.89 秒；一遍 36.43 秒。

---

## 兩首放進影片的順序

照時間順序，`battlehymn`（3 月 8 日，木殼帆船被鐵甲艦打沉）在前，`battlecry`（3 月 9 日，莫尼特號出場對決）在後。都只要一段的話：
- `battlehymn` 剪副歌（21.6–39.6 秒，18 秒）。
- `battlecry` 從第 0 小節起剪到 19.29 秒（主歌一遍），或者整遍 36.4 秒。

⚠ 兩首都是北軍的歌。維吉尼亞號是南軍的船，這一輪沒有給它南軍的曲子；可以考慮 Dixie（Emmett 1859）或 The Bonnie Blue Flag（1861），沒有研究。

## 放進遊戲時要注意

- 兩首都是整份 `abc`，放 `TUNES` 才會出現在聲音設定頁。我已經寫了 `inst`（`['fife', 'horn']`、`['brass', 'horn']`），給 `sndUI` 的按鈕提示用；真正發聲的樂器照 `[I:]`。
- `vol` 還沒定。要照 README 那一套，用 `music_lab.py` 量 A 加權 RMS，對齊到 −24.3～−25.1 dB 再補。這一輪沒有錄音。
- 小鼓寫 C4、大鼓寫 C3：這是兩種鼓「不偏音高」的那個音（`snare` 用 f/262、`bassdrum` 用 f/131 算偏移）。上一輪的草稿小鼓寫 c（C5），會讓響弦高大約 7%。
- **後備版**（樂器還沒合進去之前先試聽）：`FALLBACK=1` 時 fife→whistle、brass→fiddle、horn→accordion，小鼓、大鼓兩個聲部（V:4、V:5）整行拿掉。解析過：battlecry 192 個事件、battlehymn 240 個事件，秒數不變。

## parse 檢查方法

`music/tools/parse_check.cjs` 從 `bs_music/src/js/02_music.js` 原文取出 `var ABC_KEYS` 到 `bgmPasses` 前面那一段（`abcParse`／`abcTune`／`bgmWarp`／`tuneEvents`），放進 `vm` 執行，不改遊戲檔，樂器用空殼。

- `abcParse` 照 `M:4/4` 檢查每一小節剛好 4 拍（第一小節可以短；這兩首第一小節也是滿的），`tuneEvents` 檢查各聲部一樣長（都是 68 拍）。兩首都過。
- 只給現有六種樂器（不加參數）：遊戲照預期丟出「沒有這種樂器 fife」。
- 這一輪對照的 `02_music.js` 是 `bs_music` 現在的工作區版本（有樂器工程師未提交的改動，上面有 fife／brass／horn／snare／bassdrum）。

```
node tools/parse_check.cjs ../bs_music/src/js/02_music.js $(pwd)/tools/era_civilwar_tunes.cjs fife,brass,horn,snare,bassdrum
battlecry Q=112 events=365 beats=68 pass=36.4s v0:88 D5(74)–G6(91)  v1:42 D4(62)–G5(79)  v2:62 C2(36)–F3(53)  v3:139 C4(60)–C4(60)  v4:34 C3(48)–C3(48) inst=snare/bassdrum/fife/horn/brass
battlehymn Q=100 events=402 beats=68 pass=40.8s v0:83 D4(62)–D5(74)  v1:33 D5(74)–D6(86)  v2:124 Bb1(34)–Eb4(63)  v3:137 C4(60)–C4(60)  v4:25 C3(48)–C3(48) inst=snare/bassdrum/brass/horn/fife
FALLBACK=1 node tools/parse_check.cjs ../bs_music/src/js/02_music.js $(pwd)/tools/era_civilwar_tunes.cjs
battlecry Q=112 events=192 beats=68 pass=36.4s v0:88 D5(74)–G6(91)  v1:42 D4(62)–G5(79)  v2:62 C2(36)–F3(53) inst=whistle/accordion/fiddle
battlehymn Q=100 events=240 beats=68 pass=40.8s v0:83 D4(62)–D5(74)  v1:33 D5(74)–D6(86)  v2:124 Bb1(34)–Eb4(63) inst=fiddle/accordion/whistle
```

## 跟上一輪草稿（`civ_tools/build.js`、`abc_out.txt`）比，改了什麼

1. `battlecry` 第 3 小節的「of」：d → c，照原版第 3 頁（見上）。其他旋律音沒有變。
2. `battlecry` 的低音改成照 Root 的鋼琴和聲。上一輪是自己配的，「rally round the flag」整小節 I；現在第 3–4 拍是 vi，「rally once again」是 Gm/D–D7–E♭，副歌「Up with the star」照原版用下行的低音。樂器從 brass 換成 horn。
3. `battlecry` 加了大鼓，副歌加銅管吹原調。
4. `battlehymn`：
   - 主歌旋律從 fife 換成 brass。
   - 副歌從 trumpet（遊戲裡的 trumpet 是巴洛克自然號；1862 年的軍樂隊用的是有活塞的短號、薩克斯號，這是二手常識）換成 brass，再加 fife 高八度。
   - 低音從根音—五度換成照原版和聲的「嗡–叭」。
   - 加了大鼓。
5. 小鼓的音 c → C（見上）。

## 還沒把握的地方

1. Battle Cry 第 3 頁只有寬 1800 的掃描（原解析度那一張 504，沒有重下載）。
   - 逐小節都放大讀過、跟第 4、5 頁同一句比過。只有「of」那一個音兩頁不一樣，我照各頁原樣。
   - 如果要三處統一成 d，把主歌第 3 小節橫笛的 `c'/2` 改成 `d'/2` 就好。
2. 第 3 頁主歌中間的「Freedom」：左手確定是 F 八度三拍，右手和弦在低解析度上看不清。我只照左手配 F–C–F，沒有去猜右手。
3. 速度兩首原版都沒寫，Q=100、Q=112 是我定的。
4. 史實（都寫在「為什麼合適」那兩段）：
   - 一手：兩份封面上的年份與登記字樣、Ditson 那份 1862-04-09 的繳交手寫。
   - 二手：Atlantic Monthly 1862 年 2 月號、Root 1862 年 7 月寫曲、坎伯蘭號帶旗沉沒、曲子作者 Steffe。
   - 沒有查到兩首在漢普頓錨地任何一艘船上奏過。
5. Commons 標的 LOC digital ID 沒有在 loc.gov 親自對過（Cloudflare 擋住）。
6. 音色、響度都還沒實際錄過、沒有人聽過（`vol` 待定）。

## 檔案

- 研究稿：`music/era_civilwar.md`（本檔）
- 譜：`music/tools/era_civilwar_tunes.cjs`（`FALLBACK=1` ⇒ 後備配器）
- 讀譜、量測工具：`civ_tools/heads2.py`（照局部五線找符頭、報音名）、`gcrop.py`（裁切＋音名導線）、`crop.py`、`lines.py`、`readback.cjs`（照遊戲 `abcParse` 逐小節讀回）、`emit_js.cjs`（把譜印成上面那種遊戲寫法）
- 放大圖：`civ_tools/crops2/`（第 3 頁「of」的 5 倍圖 `b3_z9.jpg`、第 4 頁「of」`b4_z1.jpg`、副歌 `b4_c0.jpg`、`b5_z1–3.jpg`、和聲 `b5_p1.jpg`、`b5_p2.jpg`、Battle Hymn 第 3 頁第 4 行 `h3_s4a/b.jpg`、第 4 頁副歌 `h4_c1a/b.jpg`）；其他過程圖在 `civ2/crops/`
- 原版掃描（不入版控）：`music/dl_civilwar/`

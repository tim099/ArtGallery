# 《從一根龍骨開始》的重產工具

`HtmlVideos/basecamp_constitution_build_ep01.html` 是由這裡的四個檔產生的：

| 檔 | 做什麼 |
|---|---|
| `build_data.py` | 從雕刻作品 `basecamp-frigate-constitution-01m`（組裝件＋子作品＋船殼的時間標記）重產「每一格在第幾個階段出現／消失」、繩、帆、水線半寬 ⇒ 兩個 deflate-raw 的 `.bin`（`<名>.bin` ＝ 0.2 m、`<名>_fine.bin` ＝ 原始 0.1 m）；兩條對拍，對不上就停：① 船殼現況＋每條關聯現況 ＝ 組裝件（逐格、逐色）；② 最後一個階段的全船（船殼最後一個標記＋各關聯的狀態）＝ 組裝件（逐格、逐色） |
| `sheets.json` | 片中插入的新圖紙：階段、作品 `design/` 底下哪一張、裁哪一塊、標籤 |
| `template.html` | 播放器本體（WebGL2＋2D 字幕＋Web Audio）；`__SHIP_DATA__`／`__SHIP_FINE__`／`__SHEETS__` 三個位置由 `make_html.py` 填 |
| `make_html.py` | 把兩個 `.bin` 用 base64、圖紙縮成 JPEG 塞進 template ⇒ 影片檔 |

```bash
python -I build_data.py <快取>/ship.bin <快取資料夾>      # 要 senate CLI；匯出會快取在 <快取資料夾>
python -I make_html.py <快取>/ship.bin ../../basecamp_constitution_build_ep01.html
```

- 作品之後還會再長（下一話）。加階段時要改的地方：
  - `build_data.py` 的 `STEPS` 與 `ORDER` 都要加（`ORDER` 沒加會 KeyError），需要時加 `WIN`；
  - 寫死的 23（`hull_at[23]`、梯子扶手繩的階段）跟著改；
  - `template.html` 的 `STEPS` 照同一個順序加；超過 24 個階段，要把 `START`／`LEN` 與著色器的 `uStart[25]`／`uLen[25]` 加大；
  - 新圖紙加在 `sheets.json`；
  - 片長、片尾的 `OUTRO` 與配樂的小節表跟著挪。
- ⚠ 片段著色器別用「巢狀三元＋`vec3(sign(..),0,0)`」：Windows 的 D3D11 後端編譯失敗、整艘船畫不出來（無頭 Chrome 的軟體算繪照常，截圖看不出來）。改著色器以後要在真 GPU 的瀏覽器裡讀一次 `getError`。

- 每一段方塊帶：位置、顏色、群組（10 種：骨架～梯子；播放器的 13 顆開關另外加繩、帆、海）＋在哪一層甲板（分層開關）、出現與消失的階段和先後、6 個面哪幾面貼著一直都在的同群組鄰格（那幾面不畫 —— 不然相鄰兩格的側面在接縫搶深度，遠看是一層格紋）。
- 片尾下水（`template.html` 的 `launch()`）：船的姿態是 t 的純函數；入水時間 `SPLASH_T` 由 `launch()` 掃出來（≈ 132.5 秒，第 53 小節），水花聲對它。⚠ 下水是演的，作品裡的船沒動。
- ⚠ 著色器的一行裡別放 `//` 註解再接宣告 —— 整行後面都被註解掉（分層開關第一次就這樣壞掉，讀主控台的編譯錯誤才看到）。

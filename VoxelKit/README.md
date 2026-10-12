# VoxelKit —— 雕刻作品進 HTML 展品

把一件雕刻作品（含關聯、繩、帆）變成可以內嵌在單一 HTML 裡、瀏覽器能畫也能改的格子。影片（`HtmlVideos/`）與遊戲（`HtmlGames/`）共用。

| 檔 | 做什麼 |
|---|---|
| `voxel_export.py` | 作品 → `.vxk`：`senate cmd sculpture` 匯出 `format=list`（每一格）；`--rig` 再從 `format=obj` 拿繩與帆；`--parts` 記各條關聯的外框。寫檔前把封裝回讀、跟匯出清單逐格比對，對不上就不寫。 |
| `voxelkit.js` | 瀏覽器端（全域 `VoxelKit`）：解碼、稀疏網格、網格化、WebGL2 算繪、射線、連通。零外部依賴。 |
| `vxk_inline.py` | 開發用 HTML → 單檔成品：把 `<script src>` 與 `.vxk` 塞進去，再檢查成品沒有外部 src／fetch／import／http(s) 資源。 |
| `_cache/` | 匯出的暫存與 `.vxk`（不入版控；用 `voxel_export.py` 重產）。 |

```bash
python -I voxel_export.py --work <作品> --out _cache/<名>.vxk [--rig] [--parts] [--links all|none] [--list <既有匯出清單>]
python -I vxk_inline.py <開發用.html> <成品.html>
```

## `.vxk` 格式

deflate-raw 壓過的一段位元組：

```text
'VXK1' ＋ uint32 header 長度 ＋ header（UTF-8 JSON）
＋ 非空 16³ 區塊的座標 nchunks × (uint16 cx, cy, cz)
＋ 區塊內容      nchunks × 4096 bytes（索引 x + 16y + 256z；0 ＝ 空，其餘 ＝ 色值）
```

- **1:1**：每一格照原座標、原色值，⛔ 不降採樣。色值 0 被當成「空」⇒ 有 0 號色的作品匯出時會被擋下。
- **header**：`work`、`size`、`bbox`、`meters_per_voxel`、`voxels`、`checksum`、`colors`、`source`（每條關聯的版本）；`--parts` 加 `parts`（路徑、來源作品、box、mirror）；`--rig` 加 `rig.ropes`（中線點）與 `rig.sails`（三角形），⛔ 模型匯入的子模型不收（數量記在 `rig_skipped`）。
- **checksum**：每格 `(x·73856093) ^ (y·19349663) ^ (z·83492791) ^ (c·2654435761)`（各取低 32 位）加總 mod 2³²，跟順序無關。`VoxelKit.verify(grid, header)` 算同一個數 —— 還沒動過的網格要等於 header，等於才算逐格相同。
- 座標一律是作品的格座標（x 船長、y 船寬、z 高）。世界座標怎麼擺由展品給模型矩陣；從格座標換到 Y 朝上時，要用行列式 +1 的換法（例：`(x, z, −y)`），不然面的繞序會翻。

## `voxelkit.js` 的 API

| 名字 | 做什麼 |
|---|---|
| `loadEmbedded(id)` | 讀 `<script type="application/x-vxk" id="…">base64</script>` ⇒ `Promise<{header, chunks}>`（需要 `DecompressionStream`） |
| `Grid.fromModel(m)`／`grid.share()` | 稀疏網格；`share()` 跟原本那份共用資料，誰先改哪一塊誰才複製（copy-on-write） |
| `grid.get／set／each`、`verify(grid, header)` | 讀寫一格、走全部、逐格對拍 |
| `RegionSet(gl, grid, quadIndex)` | GPU 端：區塊內同色面合併（greedy），64³ 一區一個 VAO；`touch(x,y,z)` 標髒、`flush()` 重建、`shareFrom(other)` 先借用另一份的區（被改到的區才自己建）、`draw()` |
| `VOXEL_VS／VOXEL_FS`、`compile` | 體素著色器（RGB332 解色、格線、每格明暗、霧、水下變色）；uniform：`uModel uVP uSun uEye uFog uSky uGround uFogD uWater uTint` |
| `raycast(grid, o, d, tMax)` | 格座標裡的射線，第一個非空格 |
| `detached(grid, seeds, isAnchor, budget)` | 從種子往外找：碰不到錨點的那幾團 ⇒ 斷開了（例：打斷的桅杆）。先往下找，超過 budget 格就當連著 |
| `M4`、`pack(x,y,z)` | 矩陣（column-major）與座標打包（x \| y<<10 \| z<<20，每軸 < 1024） |

⚠ 著色器別寫巢狀三元運算 —— Windows 的 D3D11 後端會編譯失敗（無頭 Chrome 的軟體算繪照常，截圖看不出來）。

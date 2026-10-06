# 潮汐信標驗收紀錄

日期：2026-10-06；作者：Sirius (Codex)。

Blender MCP 直接建模、匯出與渲染，版本 **5.2.2 LTS**。保留原本 `Scene` 的 Cube、Camera、Light，新作品位於 `Sirius_Tide_Beacon` 場景；展品集合與工作室集合分開。

- 渲染 PNG：1100 × 1100；已目視檢查正面形體、底座與浪翼。
- GLB：295,720 bytes，37 個網格、19,576 三角面；每個 primitive 含法線。
- GLB 未包含原場景 Cube、工作室地板、鏡頭、燈光、貼圖、稀疏 accessor 或外部 buffer URI。
- HTML 內嵌 GLB payload 與匯出檔逐位元組相同；沒有外部 `script src`；fallback PNG 也是 data URI。
- 重跑 `python Models3D/pack_viewer.py Models3D/Assets/sirius_tide_beacon.glb` 後 HTML SHA-256 不變。
- `python build_gallery.py` 與 `python build_gallery.py --check` 通過，無缺檔警告。
- HTTP 畫廊「3D 模型」篩選找到展品；彈窗內 `allow-scripts` 沙盒成功顯示 37 部件、19,576 三角面。
- 測試觀看頁政策：`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'`。在此政策下，方向鍵旋轉、加號縮放及重設按鈕均目視確認生效。
- 畫廊外層 GLB、Blender 原檔下載成功，SHA-256 與來源相同。

GLB SHA-256：`f138c2f1ba544b8c7c551962ba4507794b0ab2abdf784ac6fc07a8d27b9c8fab`。

**驗收限制：** 內建瀏覽器政策禁止 `file://`，因此未完成實際本機網址的畫廊內嵌驗收。上述禁止外部資源與連線的 HTTP 測試是工作流程指定的替代驗收；不等同實際 `file://` 驗收。共用觀看器顯示基本材質色，完整金屬光澤以 Blender 渲染為準。

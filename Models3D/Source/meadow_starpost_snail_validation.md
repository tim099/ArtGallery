# 星郵蝸牛驗收 — 2026-10-05

- 官方免安裝 Blender 4.5.9 LTS 背景建模及 Cycles 渲染；1100 × 1100 PNG 已目視檢查。
- 原檔保存 85 個展品物件與獨立工作室集合。GLB 僅一個場景、85 個網格，無預設 Cube、攝影棚、相機或燈光；所有 primitive 均為三角形並含 NORMAL。
- GLB 1,106,000 bytes；HTML 內模型 payload 與 GLB 逐位元組相同。沒有外部 script，重跑 pack_viewer.py 後 HTML SHA-256 相同。
- build_gallery.py 與 --check 通過，823 件展品，沒有缺圖警告；3D 模型篩選包含本展品，彈窗成功顯示沙盒 iframe 及外層下載連結。
- 使用本機 HTTP 預覽，觀看頁施加 `script-src 'unsafe-inline'; img-src data:; connect-src 'none'`，模型仍成功顯示 85 部件、32,304 三角面。測試自動旋轉／停止、加號縮放、方向鍵旋轉及重設視角。
- 本次測試是 HTTP 嚴格 CSP 替代驗收；瀏覽器環境拒絕 file://，沒有宣稱已通過實際本機 file:// 嵌入驗收。
- Tim 啟動的 Blender 5.2.2 LTS 已連線。安全模式不允許載入外部 .blend datablocks，因此採允許的 GLB 匯入至獨立預覽場景，保留原 Scene 的三個物件；已檢查 Blender 視窗與部件。完整可編輯模型及棚光仍在附帶的 .blend 原檔。

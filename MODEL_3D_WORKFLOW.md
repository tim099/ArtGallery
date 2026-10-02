---
title: "3D 模型展品工作流"
description: "Blender 建模、GLB 匯出、離線互動展示與展品索引規範。"
last_updated: 2026-10-02
target_audience: [AI_Agent, Artist, Developer]
related:
  - WORKFLOW.md
  - Models3D/README.md
---

# 3D 模型展品工作流

`Models3D/` 保存實際立體模型。展品單位是根目錄的 `<author>_<slug>.md`，渲染縮圖沿用 `RawImages/`；模型與原檔放 `Models3D/Assets/`。`Source/` 放可選的建模程式，不能被掃成展品。

1. 建模前確認 Blender 版本與既有場景。使用獨立場景或集合，保留使用者既有物件。
2. 建模後檢查視窗與渲染圖，保存 `.blend`，只匯出展品本身為 `.glb`，工作室地板、燈光與鏡頭不必匯出。
3. 渲染 PNG 保存到 `RawImages/<slug>.png`。展品卡的 `title`、`description`、`author` 與創作理念沿用 [通用展品規範](WORKFLOW.md)。
4. 展品卡新增三個相對於卡片的 frontmatter 欄位：`model: Assets/<slug>.glb`、`model_source: Assets/<slug>.blend`、`model_viewer: <slug>.html`。索引只接受畫廊內存在且副檔名符合的檔案。
5. 建立觀看頁，參考 `Models3D/meadow_dew_beacon.html`。換好標題與下載連結；保留唯一的 `BEGIN MODEL PACKAGE`／`END MODEL PACKAGE` 區塊與 `id="fallback"` 圖片。新增頁也可以先使用同名 `.glb.js` 與 `viewer.js` 兩個外部 script 標籤，打包器會將它們替換成內嵌區塊。
6. 執行 `python AgentCommands/ArtGallery/Models3D/pack_viewer.py AgentCommands/ArtGallery/Models3D/Assets/<slug>.glb`。打包器將 GLB、共用 `viewer.js` 與同名 PNG fallback 直接寫入觀看頁，同時刷新 `.glb.js` 投影。模型、viewer 或縮圖變更後都必須重跑；不手改 HTML 內的封裝區塊。
7. 執行 `python AgentCommands/ArtGallery/build_gallery.py` 及 `--check`；實際驗證「3D 模型」篩選、展品彈窗、旋轉／縮放／重設和下載連結。

驗收應包含本機 `file://` 的畫廊內嵌頁，而不只獨立觀看頁或 HTTP 站台。封裝後不得留下外部 `script src`，GLB payload 須與匯出檔逐位元組相同，重跑打包結果須一致。若測試環境不能開本機網址，可另以 `script-src 'unsafe-inline'; img-src data:; connect-src 'none'` 的測試頁政策驗證零外部資源依賴，並明確區分此項測試與實際 file:// 驗收。

觀看頁的模型顯示完全自含，不載入外部 JS、圖片、CDN、網路 API 或 `fetch`；本機直接開檔時，`allow-scripts` 沙盒也不需要讀取其他本機資源。共用 viewer 支援內嵌 buffer 的 glTF 2 三角網格、位置、法線、節點變換及基本材質色；不支援貼圖、骨架、稀疏 accessor、透明傳輸與完整 PBR。匯出須含法線，不符合格式會顯示渲染圖與原因。若作品需要上述功能，應擴充 renderer 並驗收後再上架。材質與燈光的最終效果以 Blender 渲染為準。

拖曳與方向鍵可旋轉；滾輪及加減鍵可縮放；Home 或重設按鈕恢復視角。自動旋轉預設關閉。畫廊以 `allow-scripts` sandbox 嵌入觀看頁；下載連結由畫廊外層提供，獨立觀看頁也提供下載按鈕。

上架至本機後若要更新公開網站，另行 commit／push，由既有 GitHub Pages CI 重建索引部署；僅新增本機檔案不會更新公開網站。

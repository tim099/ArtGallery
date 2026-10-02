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
5. 建立觀看頁，參考 `Models3D/meadow_dew_beacon.html`。頁面引用同名模型包和共用 `Models3D/viewer.js`；換好標題、縮圖與下載連結。
6. 執行 `python AgentCommands/ArtGallery/Models3D/pack_viewer.py AgentCommands/ArtGallery/Models3D/Assets/<slug>.glb`。產出的 `.glb.js` 是同一 GLB 的 base64 包裝，必須隨展品交付；匯出後重新產生，不手改。
7. 執行 `python AgentCommands/ArtGallery/build_gallery.py` 及 `--check`；實際驗證「3D 模型」篩選、展品彈窗、旋轉／縮放／重設和下載連結。

觀看頁不使用 CDN、網路 API 或 `fetch`，本機直接開檔與 GitHub Pages 都能載入。共用 viewer 支援內嵌 buffer 的 glTF 2 三角網格、位置、法線、節點變換及基本材質色；不支援貼圖、骨架、稀疏 accessor、透明傳輸與完整 PBR。匯出須含法線，不符合格式會顯示渲染圖與原因。若作品需要上述功能，應擴充 renderer 並驗收後再上架。材質與燈光的最終效果以 Blender 渲染為準。

拖曳與方向鍵可旋轉；滾輪及加減鍵可縮放；Home 或重設按鈕恢復視角。自動旋轉預設關閉。畫廊以 `allow-scripts` sandbox 嵌入觀看頁；下載連結由畫廊外層提供，獨立觀看頁也提供下載按鈕。

上架至本機後若要更新公開網站，另行 commit／push，由既有 GitHub Pages CI 重建索引部署；僅新增本機檔案不會更新公開網站。

---
title: "3D 模型展品工作流"
description: "Blender 建模、GLB 匯出、離線互動展示與展品索引規範。"
last_updated: 2026-10-05
target_audience: [AI_Agent, Artist, Developer]
related:
  - WORKFLOW.md
  - Models3D/README.md
---

# 3D 模型展品工作流

`Models3D/` 保存實際立體模型。展品單位是根目錄的 `<author>_<slug>.md`，渲染縮圖沿用 `RawImages/`；模型與原檔放 `Models3D/Assets/`。`Source/` 放可選的建模程式，不能被掃成展品。

## Blender 就緒檢查與定位

先分別確認「是否安裝」、「程式是否啟動」與「MCP 是否可連線」。三者需要不同證據：MCP 連線失敗不代表未安裝；`Get-Command blender` 沒有結果只代表 PATH 沒有可解析的指令；搜尋遇到存取拒絕代表該位置未能檢查。

1. 優先呼叫 Blender MCP 的 `get_addon_status` 與 `get_scene_info`。兩者成功後，使用該實例回報的 Blender 版本與既有場景，不再另找或下載工具。
2. MCP 連不上時，先讀取執行中的 Blender 路徑，再查 PATH、Microsoft Store 套件與一般安裝資訊。Windows Store 版通常位於受保護的 `WindowsApps` 目錄，不一定有命令別名；用 `Get-AppxPackage` 查套件，不遞迴掃描該目錄或變更權限。
3. 若 Blender 已啟動但 MCP 仍連不上，確認 Blender MCP 外掛已啟用且其 Server 已啟動。使用者告知已啟動後，再呼叫狀態與場景工具一次；不要沿用先前失敗的判斷，也不要反覆重試相同錯誤。
4. MCP 無法使用但已找到本機 Blender 時，可用該既有版本做獨立背景建模；先核對版本。若有多版，優先使用已連線實例或使用者正在使用的版本，不自行選另一個版本。只有完整定位仍無可用執行檔，且現有授權容許時，才使用官方免安裝版；需說明原因、版本與暫存位置，不更動 PATH 或取代使用者安裝。

Windows 唯讀定位範例（保留所有候選，不自動啟動程式）：

```powershell
$runningBlender = @(Get-Process blender -ErrorAction SilentlyContinue |
    Select-Object Id, Path)
$blenderCommands = @(Get-Command blender -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object Source)
$blenderPackages = @(Get-AppxPackage *Blender* |
    Select-Object Name, Version, InstallLocation)
$blenderUninstallKeys = @(
    'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*'
    'HKLM:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*'
    'HKLM:/Software/WOW6432Node/Microsoft/Windows/CurrentVersion/Uninstall/*'
)
$blenderRegistered = @(Get-ItemProperty -Path $blenderUninstallKeys -ErrorAction SilentlyContinue |
    Where-Object DisplayName -Match 'Blender' |
    Select-Object DisplayName, InstallLocation, DisplayIcon)
[pscustomobject]@{
    Running = $runningBlender
    Commands = $blenderCommands
    StorePackages = $blenderPackages
    Registered = $blenderRegistered
} | ConvertTo-Json -Depth 4
```

登錄位置不完整時，再限定搜尋 `Program Files` 下的 Blender Foundation 目錄、開始功能表捷徑，以及使用者指定的 portable／Steam 目錄。不要只憑一般目錄搜尋無結果，就宣稱未安裝。若程序路徑不可讀或套件查詢失敗，回報定位限制；不要將空欄位視為未安裝。

MCP 安全模式拒絕某項操作時，遵守回傳限制，不以其他 API 或工具繞過。外部 `.blend` datablock 載入被擋時，可用明確允許的 GLB 匯入建立獨立預覽場景；完整原檔仍另外交付。不要覆寫使用者目前開啟的檔案。回報須分清楚背景建模的版本、MCP 預覽的版本與實際檢查範圍。

## 製作與上架

1. 依上述就緒檢查確認 Blender 版本與既有場景。使用獨立場景或集合，保留使用者既有物件。
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

# 漫畫化展區範例（template）

> **這是空白樣板，不是作品。** 開新專案時整個複製成 `ArtGallery/Comic/<slug>/`，
> 再把 `<尖括號>` 的地方換掉。
>
> 完整 SOP → `ucl_core:Docs~/zh-Hant/Workflows/Manga_Adaptation_Workflow.md`
> （分工／資料結構／六階段／收播開播）
> · 原作與分鏡 → [作者篇](../../../../Assets/Plugins/UCL_Core/Docs~/zh-Hant/Workflows/Manga_Adaptation_Author.md)
> · 作畫 → [繪師篇](../../../../Assets/Plugins/UCL_Core/Docs~/zh-Hant/Workflows/Manga_Adaptation_Artist.md)

## 這份樣板有什麼

| 檔 | 是什麼 | 誰維護 |
|---|---|---|
| `README.md` | 本檔 —— 話數表／鐵則／人設索引 | 原作 |
| `NAMING.md` | 正名表與畫面文字規則 | 原作 |
| `DRAWING_MEMO.md` | **收播備忘錄** —— 進度與交接 | 兩人各寫各的 |
| `Chapters/000.md` | 分鏡稿樣板 | 分鏡者 |
| `Characters/character.md` | 角色／船的文字人設樣板 | 原作 |
| `Props/prop.md` | 場景／物件的文字設定樣板 | 原作 |
| `RawImages/character_v1.png` | **三視圖的格式範例** —— 正／背／側・純白・零標註 | 繪師 |

> ⚠ `character_v1.png` 是**格式**的範例，不是畫風的範例。
> 要看的是版面規格（三視等高等比、純白背景、中性站姿、**零文字**），不是那個角色長什麼樣。

---

## 話數切分

| 話 | 原文 | 標題 | 狀態 |
|---|---|---|---|
| 000 | `Books/<slug>/000.txt` | 〈…〉 | 分鏡就位 |

> 用詞照 workflow §二：**分鏡就位／已讀・排程中／繪製中 N/M／冷卻中／完成**。
> **「完成」＝ N==M 且每張都打開看過。**

## 三條不可動的鐵則

**壓到三條以內** —— 超過就不是底線，是遙控作畫。每條要寫「為什麼」，並指名**哪一話哪一格**生效。

1. **〈鐵則一〉** —— 為什麼：…；生效於 `00X-PY②`
2. **〈鐵則二〉** —— …
3. **〈鐵則三〉** —— …

## 角色與船

| 角色 | 定位 | 作畫要點 |
|---|---|---|
| `<name>` | … | [文字人設](Characters/character.md)／三視圖 `RawImages/<name>_v1.png` |

> ⚠ 角色若是既有 persona，先 `ls`
> `ucl_core:Templates~/…/ModResources/Sprites/Avatars/` ——
> **有立繪就以它為錨點**（髮色／服裝／身高），但仍要另繪漫畫用三視圖。

## 場景與物件

出現 **≥2 話** 就要建檔（判準見作者篇）。索引放這裡：

| 物件 | 跨話 | 設定 | 三視 |
|---|---|---|---|
| `<prop>` | 0 話 | [Props/prop.md](Props/prop.md) | ❌ |

## 讀法

`Chapters/NNN.md` 由上而下讀：圖在上、字幕與台詞在下。**畫面本身幾乎不放文字。**

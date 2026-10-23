---
title: "雨果・木馬｜6歲的街道時光"
description: "鎮民第三批。六歲，最喜歡木雕小馬，會數沿路看見的窗戶。"
author: "Sirius (Codex)"
note: "Tim 委託，TASK-0858；參考 meadow 的 Astrid 畫風，以青髮與洋紅主衣料直接生成。"
---

# 🖼️ 雨果・木馬｜6歲的街道時光

六歲，最喜歡木雕小馬，會數沿路看見的窗戶。這次以臉部年齡感、頭身比例與生活小物區分成長階段；人物設定是創作，不是史料或完整人口模擬。遊戲角色 id 為 child_m_02，設定身高 1.12 公尺，列順序與角色資訊統一由 _people.js 管理。

風格參考 [meadow 的 Astrid](meadow_captain_astrid_sprite.md)，保留精細像素輪廓、分色陰影與表情；頭髮與主衣料從生成時就使用青色與洋紅標記，皮膚、襯衣、皮革與道具保持自然色。青髮並非角色固定髮色。原圖、遊戲圖集與換色預覽須逐圖看過，實際髮型與道具外觀以成圖為準。

遊戲使用 96×192 圖格，人物都填滿相同圖像高度；實際身高由設定檔調整，不靠縮小原稿。新圖也展出於人物畫像區，完整原稿保留白底；遊戲用圖集由工具去背與處理材質邊界。

## 完整生成提示詞

內建 image_gen；meadow_captain_astrid_sprite_v1.png 僅作畫風參考。

```text
Use case: stylized-concept. ONE full body civilian resident of an age-of-sail Caribbean fantasy town around 1715. Fine Japanese anime PIXEL illustration matching reference fine density, discrete clean shaded clusters and dark stair-step contours. Hugo, a SIX-year-old young BOY, clearly child anatomy about 1:4.5 head-body ratio, short limbs, round face, tan olive skin, neatly cropped entirely cyan hair, lively smile. Modest fully clothed MAGENTA roomy tunic and MAGENTA knee breeches, ivory collar, cream stockings and brown closed workstyle shoes. Holding a small carved brown wooden toy horse at waist. No tools or weapons, no makeup. CRITICAL MATERIAL KEYS: all hair, roots and eyebrows saturated CYAN #00BCD4 with cyan-only shading; ALL main colored clothing saturated MAGENTA #C2185B with magenta-only shading. Skin natural, shirt/stockings ivory, wood and leather brown, toys tan; absolutely no cyan or magenta reflections, glow, spill or speckles on skin or props. Compact hair above shoulders. Full head, fingers, feet comfortably inside frame; 3/4 standing facing slightly right, narrow relaxed silhouette. PURE WHITE background, no shadow/scenery, no text or border. Reference is STYLE only; retain the subject's requested AGE, body proportions and civilian clothing.
```

![雨果・木馬的鎮民換色原稿](../RawImages/sirius_resident_child_m_02_keyed_v1.png)

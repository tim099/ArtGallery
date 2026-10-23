---
title: "艾妲・布偶｜4歲的街道時光"
description: "鎮民第三批。四歲，喜歡替布偶取名字，常把它抱在胸前，跟著家人逛廣場。"
author: "Sirius (Codex)"
note: "Tim 委託，TASK-0858；參考 meadow 的 Astrid 畫風，以青髮與洋紅主衣料直接生成。"
---

# 🖼️ 艾妲・布偶｜4歲的街道時光

四歲，喜歡替布偶取名字，常把它抱在胸前，跟著家人逛廣場。這次以臉部年齡感、頭身比例與生活小物區分成長階段；人物設定是創作，不是史料或完整人口模擬。遊戲角色 id 為 child_f_02，設定身高 0.98 公尺，列順序與角色資訊統一由 _people.js 管理。

風格參考 [meadow 的 Astrid](meadow_captain_astrid_sprite.md)，保留精細像素輪廓、分色陰影與表情；頭髮與主衣料從生成時就使用青色與洋紅標記，皮膚、襯衣、皮革與道具保持自然色。青髮並非角色固定髮色。原圖、遊戲圖集與換色預覽須逐圖看過，實際髮型與道具外觀以成圖為準。

遊戲使用 96×192 圖格，人物都填滿相同圖像高度；實際身高由設定檔調整，不靠縮小原稿。新圖也展出於人物畫像區，完整原稿保留白底；遊戲用圖集由工具去背與處理材質邊界。

## 完整生成提示詞

內建 image_gen；meadow_captain_astrid_sprite_v1.png 僅作畫風參考。

```text
Use case: stylized-concept. ONE full body civilian resident of an age-of-sail Caribbean fantasy town around 1715. Fine Japanese anime PIXEL illustration matching reference fine density, discrete clean shaded clusters and dark stair-step contours. Ada, a FOUR-year-old little GIRL, clearly preschool child anatomy about 1:4 head-body ratio, short limbs and round cheeks, warm light skin, wide curious eyes, compact two tiny cyan pigtails ABOVE SHOULDERS. Modest fully covering MAGENTA long-sleeved loose smock dress to ankles, ivory round collar, cream opaque stockings and brown closed strap shoes. Holding a small plain tan cloth doll against chest with both hands, shy gentle expression. No adult body proportions, no makeup, no jewelry. CRITICAL MATERIAL KEYS: all hair, roots and eyebrows saturated CYAN #00BCD4 with cyan-only shading; ALL main colored clothing saturated MAGENTA #C2185B with magenta-only shading. Skin natural, shirt/stockings ivory, wood and leather brown, toys tan; absolutely no cyan or magenta reflections, glow, spill or speckles on skin or props. Compact hair above shoulders. Full head, fingers, feet comfortably inside frame; 3/4 standing facing slightly right, narrow relaxed silhouette. PURE WHITE background, no shadow/scenery, no text or border. Reference is STYLE only; retain the subject's requested AGE, body proportions and civilian clothing.
```

![艾妲・布偶的鎮民換色原稿](../RawImages/sirius_resident_child_f_02_keyed_v1.png)

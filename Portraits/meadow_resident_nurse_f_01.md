---
title: "女護士・瑪德蓮"
description: "TASK-1066：學校、醫院的女性職業立繪與可換色原稿。"
author: "meadow (Codex)"
note: "青髮與洋紅衣料為遊戲材質標記；年齡、身高及人物身分為創作設定。"
---

# 女護士・瑪德蓮

瑪德蓮設定為28歲、身高1.59公尺的女性居民，id `nurse_f_01`、職業 `nurse`，工作用途 `hospital`。用繃帶與敷布辨識照護工作，對應醫院。Tim要求學校、醫院需要自己的工作者美術，這批讓教學、診療與照護各有可辨認的道具。角色是遊戲創作，不據此宣稱歷史醫療或教育制度。

內建image_gen逐位獨立生成，實際附上 `meadow_captain_astrid_sprite_v1.png`，只借細緻日系像素與深輪廓，沒有套用船長身分。全身四分之三朝右、頭髮收在上方、道具靠腰身，完整保留腳尖。青髮與洋紅主衣料用來建立髮衣遮罩，皮膚、白麻布、書本、玻璃和皮革保留自然色；遊戲另換自然髮色與衣色。

館藏保留白底原始生成稿；遊戲原圖另經封閉白底檢查與圖集轉換。完整實際prompt、參考及原稿SHA見[生成記錄](../RawImages/meadow_resident_schoolmed1066_generation.json)，遊戲派生與驗證另在Blocksail `docs/evidence/schoolmed1066/`。學校、醫療服務及產能仍由TASK-1064整合，人物素材本身不增加人口。

## 完整實際提示詞

```text
Use case: stylized-concept. ONE full-body adult female civilian professional, age-of-sail Caribbean-inspired town. Attached Astrid reference ONLY for refined Japanese anime pixel-art rendering, clear dark stair-step outlines and discrete shaded clusters. Do not copy her face, captain uniform, braid or military accessories. Tall portrait on pure white. Compact three-quarter standing facing SCREEN RIGHT, nose points right. Complete head, fingers and feet, generous margins. Narrow silhouette fits96x192 cell with164px figure height; props close to waist/torso, none beside feet, no outstretched elbows. ALL hair and eyebrows CYAN #00BCD4 with cyan-only shading, compact hairstyle entirely inside top30% of figure. MAIN coloured clothing MAGENTA #C2185B with magenta-only shading. Natural skin, brown eyes, neutral lips, ivory linen, brown leather/wood, neutral props; no cyan/magenta spill on these materials. White background, no ground shadow, scene, lettering, labels or border. Historically inspired fictional character, not chibi or modern uniform. A practical caring woman nurse28, lightly freckled fair skin and compact cyan hair in short rolled bun above collar. Modest magenta long-sleeved work dress with fitted narrow skirt and a simple full ivory linen apron, brown flat lace-up shoes. Both hands carry two neatly rolled ivory linen bandages and a folded white dressing cloth closely at waist, no tray of food. Keep the rolls visibly cloth with hollow spiral ends, not bottles. No modern nurse cap, red cross, stethoscope, syringe, medical logos or hospital scenery.
```

![女護士・瑪德蓮換色原稿](../RawImages/meadow_resident_nurse_f_01_keyed_v1.png)

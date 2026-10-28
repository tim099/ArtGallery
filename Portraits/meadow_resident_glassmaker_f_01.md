---
title: "女玻璃匠・克拉拉"
description: "TASK-1050：現有生產建築的獨立女性職業立繪與遊戲換色原稿。"
author: "meadow (Codex)"
note: "青髮與洋紅衣料是材質標記，遊戲依設定還原自然配色。"
---

# 女玻璃匠・克拉拉

克拉拉是44歲、身高1.71公尺的女性居民。她在玻璃坊工作，用琥珀色瓶子與短鐵工具辨識職業；皮圍裙保護前身。這是角色創作設定，不是對歷史職業人口的推估。她的穩定id為 `glassmaker_f_01`，工作建築為 `glassworks`，只參與居民演出選角，不增加生產能力或人口。

Tim希望依目前生產建築再新增女性工種。原稿透過內建image_gen獨立生成，實際附上 `meadow_captain_astrid_sprite_v1.png`，僅借細緻日系像素、離散色階與深輪廓，不複製船長身分。四分之三朝右，全身與腳尖完整、道具集中腰間。頭髮與眉毛為青色標記，主衣料為洋紅標記；皮膚、白麻布、木器、皮革與工具保留自然色，供現有遊戲的髮衣遮罩換色。

白底館藏保留原始生成版本。遊戲原圖另經BiRefNet檢查封閉白底，再由townfolk工具壓入圖集；髮衣四組自然配色、孔洞及選角結果在Blocksail的 `docs/evidence/womenjobs/`。完整追溯見 [生成記錄](../RawImages/meadow_resident_womenjobs_generation.json)。

## 完整實際提示詞

```text
Use case: stylized-concept. ONE full-body adult female civilian craft worker for an age-of-sail Caribbean-inspired town. Attached Astrid reference is ONLY for fine Japanese anime pixel-art style, discrete shaded clusters, clean dark stair-step contours and readable anatomy; do not copy her face, captain coat or military outfit. Tall portrait white canvas. Compact three-quarter standing pose facing SCREEN RIGHT (nose points right), complete head, both hands/fingers and both feet visible with generous blank margins. Narrow silhouette suitable for96x192 game cell with164px body height: no outstretched elbows, no oversized props, all props held near waist/torso and above knees, nothing beside the feet. ALL hair and eyebrows pure CYAN #00BCD4 with cyan-only shading. Short compact hair, entirely in top30% of the figure. MAIN coloured garment MAGENTA #C2185B with magenta-only shading. Natural skin, brown eyes, ivory linen, brown leather/wood, neutral tools. No cyan or magenta reflections/spots on skin, eyes, lips, accessories or props; no makeup. Pure solid white background, no scenery, shadow, ground plane, labels, lettering, border or checkerboard. Refined proportional adult, not chibi or modern fashion. Woman glassmaker,44, lightly freckled fair skin, mature focused face, compact cyan bob tucked above collar. Magenta plain long-sleeved work tunic, dark-brown leather protective apron, narrow brown trousers, sturdy brown boots. One hand holds a SMALL translucent amber glass bottle by its neck at waist, other hand carries a short neutral iron forming tool vertically close to torso. No long blowpipe, no kiln, no flame, no goggles or modern equipment. Bottle is amber honey with ivory highlights, never cyan.
```

![女玻璃匠・克拉拉白底換色原稿](../RawImages/meadow_resident_glassmaker_f_01_keyed_v1.png)

# 《憲法號對轟》的重產工具

`HtmlGames/ame_constitution_broadside.html` 是由這裡的兩個檔，加上共用的 `VoxelKit/` 產生的：

| 檔 | 做什麼 |
|---|---|
| `template.html` | 版面、HUD、選單；引用 `../../../VoxelKit/voxelkit.js`、`game.js` 與船的 `.vxk` |
| `game.js` | 遊戲本體：兩艘船、砲彈、擊碎、斷開的那一團、碎屑、進水、電腦、鏡頭、音效 |

```bash
# ① 船：basecamp 的《憲法號（組裝）》，1:1，連繩與帆、關聯外框（認砲位要用）
python -I ../../../VoxelKit/voxel_export.py --work basecamp-frigate-constitution-01m-assembly --out ../../../VoxelKit/_cache/constitution.vxk --rig --parts
# ② 內嵌成單檔
python -I ../../../VoxelKit/vxk_inline.py template.html ../../ame_constitution_broadside.html
```

作品之後還會再長；重跑 ① 就拿到現況（`.vxk` 不入版控）。

## 會咬人的地方

- **砲位**：從 `--parts` 的關聯路徑 `…/砲-S01`～`S14` 認（右舷 14 門；兩艘都是右舷朝對方）。砲口 ＝ 外框裡 y 最大那一層的中心。關聯改名，砲就找不到。
- **桅**：桅杆子作品的外框是整艘船（放在原點），認不出位置 ⇒ 從四種橫帆（`<fore|main|mizzen>-<course|topsail|topgallant|royal>`）推大概的 x，再在附近找中線上那根直立的柱子。
- **繩的錨**：兩端各找 0.5 公尺內最近的實心格；找不到的（ratline 掛在 shroud 上）掛到端點旁邊那條繩上，靠著的斷了它跟著斷。兩邊都靠不到的 ⇒ 綁在模型上（舵索綁舵輪），模型這版不收，繩也不畫。
- **水線**：吃水 63 格（同 basecamp《從一根龍骨開始》的下水段）。
- **預覽窗格在背景時** `requestAnimationFrame` 會停 ⇒ 模擬也停。量測用 `?debug=1` 的 `window.__game`（`start`／`run(秒)`／`fire`／`one`／`stats`／`cam`）手動推進。

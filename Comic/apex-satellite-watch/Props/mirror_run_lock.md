---
prop: mirror-run-lock
type: object
role: 伏筆道具・文件鎖與原子性防護
written_by: apex-one
first_appearance: 002-P2②
last_updated: 2026-10-22
---

# mirror-run-lock — 文字設定

> 由 basecamp 引入的地表同步防護鎖 `_MirrorRunLock`。
> 將並發競態的混亂收斂為順序排隊的物理實體。

---

## 一、形態與特徵

- **外觀**：如同一塊精緻切割的多面體冷光晶石鎖扣，表面流轉著微弱的白藍色數據迴路。
- **刻度**：晶石環繞著一圈 30 秒安全計時微光刻度，後到者耐心等待而不是超時報錯。
- **功能**：鎖定 state 寫入權，消除 TOCTOU 並發衝突。

---

## 二、作畫要點

- 晶石質感清澈堅固，象徵不可撼動的原子性（Atomicity）。

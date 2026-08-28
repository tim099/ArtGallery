---
setting_id: "compile_report_timestamp"
work_slug: "crest-147-milliseconds"
type: "prop"
first_seen_chapter: "0003"
last_confirmed_chapter: "0003"
status: "confirmed"
---

# 體檢表時間戳（compile_report_timestamp）

## 已確認資訊

- `check_compile` 曾回傳「Errors: 0」，但報告 timestamp 是昨天 17:24，不是當日改動後的結果。
- Editor 忙於其他工作而跳過重編譯時，工具會把找得到的舊報告原封不動遞回。
- 修法是強制重編譯，並等待 timestamp 前進後才讀結論。

## 視覺約束

- 一張無可讀文字的淺色診斷報告，帶空白的核對章與格線；不把「零錯誤」寫成可讀文字。
- 一個獨立、清楚可辨的時間錶／時間戳標記，作為「報告新鮮度」的主焦點。
- 不加入人物、病患、程式碼、電腦 UI、數字、品牌或水印。

![體檢表時間戳設定稿](../RawImages/compile_report_timestamp_v1.png)

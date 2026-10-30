#!/usr/bin/env bash
# 一鍵把宣傳片錄成 MP4（Tim 2026-10-30「參考 D:\Unity\Blocksail\trailer.sh 也加一個工具可以直接把宣傳片輸出成影片吧」；record.py 的捷徑）。
# 在哪個資料夾跑都可以：
#   ./record.sh                      整支、1080p60、畫質全開、3D 超取樣 1.5 倍 ⇒ ~/Videos/Sharkside/sharkside-trailer-1080p60-<日期>-<時間>.mp4
#   ./record.sh --fps 30             幀率：60｜30
#   ./record.sh --from 14 --to 20    只錄那一段（片長秒；試流程用）
#   ./record.sh --ss 1               不超取樣（快一倍多，試錄用）
#   ./record.sh --gfx high           畫質：low｜mid｜high｜ultra（畫廊播放是 high）
#   ./record.sh --out D:/影片         存到哪個資料夾；--name 檔名
#   ./record.sh --chrome "C:/Program Files/Google/Chrome/Application/chrome.exe"   指定瀏覽器（Chrome／Edge；要 WebCodecs 的 H.264、AAC）
#   ./record.sh --help               全部的參數
# 會開一個 Chrome 視窗一格一格算（可以蓋住，別最小化、別關）；進度每 5 秒片長印一行在這個視窗；Ctrl+C ⇒ 全部收掉。
# 錄的是畫廊那一份成品（../../gura_sharkside_trailer.html）：改了 scenes.js 之類的，先照 README 重建成品再錄。
set -euo pipefail
cd "$(dirname "$0")"
if command -v python >/dev/null 2>&1; then PY=(python)
elif command -v python3 >/dev/null 2>&1; then PY=(python3)
elif command -v py >/dev/null 2>&1; then PY=(py -3)
else echo '✗ 找不到 Python（python／python3／py）' >&2; exit 1; fi
exec "${PY[@]}" -I -X utf8 record.py "$@"

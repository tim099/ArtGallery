#!/usr/bin/env bash
# 宣傳片逐格錄成影片檔（record.py 的捷徑；Tim 2026-10-19：「可以加個.sh直接執行嗎」）。在哪個資料夾跑都可以，參數照傳給 record.py：
#   ./record.sh                       整支、1080p、60 fps ⇒ 「影片」資料夾的 kaguya_blockside_trailer_60fps.webm
#   ./record.sh --from 125 --to 135   先錄一小段試
#   ./record.sh --fps 30              30 fps
#   ./record.sh --help                全部的參數
# 會開一個 Chrome 視窗一格一格算（錄的時候別最小化）；整支約 20 多分鐘，再加聲音 1 倍速重播約 7 分鐘。
set -euo pipefail
cd "$(dirname "$0")"
if command -v python >/dev/null 2>&1; then PY=(python)
elif command -v python3 >/dev/null 2>&1; then PY=(python3)
elif command -v py >/dev/null 2>&1; then PY=(py -3)
else echo '✗ 找不到 Python（python／python3／py）' >&2; exit 1; fi
exec "${PY[@]}" -I record.py "$@"

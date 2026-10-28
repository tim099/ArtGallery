// ───────────────────────── 鎮民設定檔（TASK-0849；手改這一份） ─────────────────────────
// Tim 2026-10-23：「是否可以有鎮民的設定檔(包含換色 年齡 職業 性別等) 之後可以用在工作建築(例如魚場 旅店 農場)上的演出」
//   「另外還需要身高(兒童要矮一點 不能直接按照圖片尺寸會太高)」「然後遊戲內就直接串接鎮民設定檔(且命名只要farmer_f_01這樣就好 f m表示性別)」
//
// 誰讀：遊戲（Blockside 63_townfolk.js，跟 _folk_<組>.js 一起向 Blocksail 要 ⇒ 改這一份、重開遊戲就生效，不用重產立繪）；
//       tools/townfolk.py（照 sheet 分組、組裡照 people 的順序把 raw_keyed/<id>.png 壓成 _folk_<組>.js —— 新增、刪掉、改順序、換組一位鎮民才要重跑）。
// 檢查：python -I tools/townfolk.py --people（id 格式、欄位、工作建築的 key、顏色、立繪在不在；寫錯擋下、零寫入）。
//
// 格式（等號後面是純 JSON：雙引號、不能有註解、最後一項後面不能有逗號）：
//   cloth   預設的衣服換色表 [[R, G, B], …]（L = 100 時的顏色；每位照雜湊挑一個）
//   hair    預設的髮色表；不寫 ⇒ 遊戲設定檔的 hairColors
//   people  一位一筆（同一組裡的順序 ＝ 那一張立繪的列）：
//     id      <職業>_<f|m>_<兩位數>（例 farmer_f_01；f 女、m 男）＝ 立繪檔名 raw_keyed/<id>.png
//     name    名字（給人看）
//     gender  "f" | "m"（要跟 id 中間那一格一樣）
//     age     "child" | "adult" | "elder"；years ＝ 幾歲（生圖時的設定）
//     job     職業（id 的第一段）
//     work    工作用途：world/town.js TOWN_CORE.cat、world/buildings.js BUILDINGS 的 key，另有 build（工地）、garrison（守軍）；[] ＝ 不工作（孩子）
//     height  身高（公尺，真實的；遊戲 × TOWN_FOLK_SCALE 畫）—— 立繪一律填滿一格，矮的人靠這一欄，不靠圖的大小
//     cloth / cloth_k / hair / hair_k（選填）這一位自己的換色表、亮度倍率（生圖的明暗不一致時調；倍率 0.2–3）
//     weight  出現的權重（相對的；不寫 ＝ 1）—— 遊戲照它挑路人（大人那一群、孩子那一群各自照權重）
//   child_share  街上的路人有幾成是孩子（age child；0–1，不寫 ＝ 只照 weight）（Tim 2026-10-23「加入出現權重，另外控制兒童比例」）
//     sheet   在哪一張貼圖（小寫英文字母；不寫 ＝ "main"）：一組一張 _folk_<組>.js、一組最多 21 位（貼圖高 4096 ÷ 192）、各自的調色盤（Tim 2026-10-23「拆多張貼圖 OK」）
(window.BSTOWNKIT_DATA = window.BSTOWNKIT_DATA || {})["_people"] = {
  "child_share": 0.12,
  "cloth": [[58, 92, 148], [172, 66, 54], [78, 130, 76], [196, 150, 64], [108, 122, 138], [142, 98, 62], [52, 128, 124], [112, 146, 184]],
  "people": [
    { "id": "docker_f_01", "name": "艾莉絲", "gender": "f", "age": "adult", "years": 26, "job": "docker", "work": ["warehouse", "sheers", "boat-shed"], "height": 1.64, "sheet": "main" },
    { "id": "baker_f_01", "name": "梅琳", "gender": "f", "age": "adult", "years": 31, "job": "baker", "work": ["bakery", "market", "restaurant"], "height": 1.58, "sheet": "main" },
    { "id": "smith_f_01", "name": "莎賓", "gender": "f", "age": "adult", "years": 38, "job": "smith", "work": ["smithy"], "height": 1.70, "sheet": "main" },
    { "id": "merchant_f_01", "name": "蕾歐妮", "gender": "f", "age": "adult", "years": 34, "job": "merchant", "work": ["market", "warehouse", "weighhouse"], "height": 1.65, "sheet": "main" },
    { "id": "noble_f_01", "name": "瑟蕾絲特", "gender": "f", "age": "adult", "years": 42, "job": "noble", "work": ["townhall", "governor", "church"], "height": 1.63, "sheet": "main" },
    { "id": "porter_m_01", "name": "湯瑪斯", "gender": "m", "age": "adult", "years": 24, "job": "porter", "work": ["warehouse", "customs", "sheers"], "height": 1.76, "sheet": "main" },
    { "id": "shipwright_m_01", "name": "巴納比", "gender": "m", "age": "adult", "years": 35, "job": "shipwright", "work": ["shipyard-small", "shipyard-large", "careening-wharf", "careening-beach", "carpenter"], "height": 1.74, "sheet": "main" },
    { "id": "merchant_m_01", "name": "愛德華", "gender": "m", "age": "adult", "years": 42, "job": "merchant", "work": ["market", "weighhouse", "townhall"], "height": 1.73, "sheet": "main" },
    { "id": "barmaid_f_01", "name": "安娜", "gender": "f", "age": "adult", "years": 22, "job": "barmaid", "work": ["tavern", "restaurant"], "height": 1.60, "sheet": "main" },
    { "id": "fishmonger_f_01", "name": "瑪莎", "gender": "f", "age": "adult", "years": 38, "job": "fishmonger", "work": ["fish-market", "market"], "height": 1.62, "sheet": "main" },
    { "id": "clerk_m_01", "name": "朱利安", "gender": "m", "age": "adult", "years": 28, "job": "clerk", "work": ["customs", "townhall", "weighhouse", "vinegar-house", "mint"], "height": 1.75, "sheet": "main" },
    { "id": "shipwright_m_02", "name": "奧斯溫", "gender": "m", "age": "elder", "years": 72, "job": "shipwright", "work": ["boat-shed", "shipyard-small"], "height": 1.66, "hair": [[160, 156, 148], [206, 201, 188]], "sheet": "main" },
    { "id": "herbalist_f_01", "name": "伊內絲", "gender": "f", "age": "elder", "years": 69, "job": "herbalist", "work": ["hospital", "market"], "height": 1.54, "hair": [[154, 150, 144], [204, 198, 184]], "sheet": "main" },
    { "id": "child_m_01", "name": "尼可", "gender": "m", "age": "child", "years": 9, "job": "child", "work": [], "height": 1.32, "hair": [[38, 30, 26], [116, 72, 38], [172, 123, 58]], "sheet": "youth" },
    { "id": "child_f_01", "name": "露西", "gender": "f", "age": "child", "years": 11, "job": "child", "work": [], "height": 1.43, "hair": [[38, 30, 26], [90, 56, 36], [132, 77, 42]], "sheet": "youth" },
    { "id": "farmer_m_01", "name": "馬蒂亞斯", "gender": "m", "age": "adult", "years": 47, "job": "farmer", "work": ["farm", "ranch", "tobacco-farm", "tobacconist", "sugar-works", "plantation", "vineyard", "henhouse", "pigsty", "water-yard", "slaughterhouse"], "height": 1.74, "sheet": "main" },
    { "id": "farmer_f_01", "name": "阿瑪拉", "gender": "f", "age": "adult", "years": 36, "job": "farmer", "work": ["farm", "cacao-farm", "market", "plantation", "vineyard", "henhouse", "pigsty", "water-yard"], "height": 1.65, "sheet": "main" },
    { "id": "fisher_m_01", "name": "巴斯蒂安", "gender": "m", "age": "adult", "years": 55, "job": "fisher", "work": ["fishery", "boat-shed", "fish-salter"], "height": 1.72, "sheet": "main" },
    { "id": "fisher_f_01", "name": "瑪莉娜", "gender": "f", "age": "adult", "years": 29, "job": "fisher", "work": ["fishery", "fish-market", "fish-salter"], "height": 1.64, "sheet": "main" },
    {"id": "child_f_02", "name": "艾妲・布偶", "gender": "f", "age": "child", "years": 4, "job": "child", "work": [], "height": 0.98, "sheet": "youth", "hair": [[38, 30, 26], [116, 72, 38], [172, 123, 58]]},
    {"id": "child_m_02", "name": "雨果・木馬", "gender": "m", "age": "child", "years": 6, "job": "child", "work": [], "height": 1.12, "sheet": "youth", "hair": [[38, 30, 26], [116, 72, 38], [172, 123, 58]]},
    {"id": "child_f_03", "name": "米娜・石板", "gender": "f", "age": "child", "years": 8, "job": "child", "work": [], "height": 1.26, "sheet": "youth", "hair": [[38, 30, 26], [116, 72, 38], [172, 123, 58]]},
    {"id": "child_m_03", "name": "羅蘭・陀螺", "gender": "m", "age": "child", "years": 10, "job": "child", "work": [], "height": 1.38, "sheet": "youth", "hair": [[38, 30, 26], [116, 72, 38], [172, 123, 58]]},
    {"id": "child_f_04", "name": "艾蓮・書頁", "gender": "f", "age": "child", "years": 12, "job": "child", "work": [], "height": 1.48, "sheet": "youth", "hair": [[38, 30, 26], [116, 72, 38], [172, 123, 58]]},
    {"id": "child_f_05", "name": "蘿絲・緞結", "gender": "f", "age": "child", "years": 14, "job": "child", "work": [], "height": 1.57, "sheet": "youth", "hair": [[38, 30, 26], [116, 72, 38], [172, 123, 58]]},
    {"id": "child_f_06", "name": "莎拉・花種", "gender": "f", "age": "child", "years": 16, "job": "child", "work": [], "height": 1.63, "sheet": "youth", "hair": [[38, 30, 26], [116, 72, 38], [172, 123, 58]]},
    {"id": "musician_f_01", "name": "伊薇・木笛", "gender": "f", "age": "adult", "years": 18, "job": "musician", "work": [], "height": 1.68, "sheet": "youth", "hair": [[38, 30, 26], [116, 72, 38], [172, 123, 58]]},
    {"id": "soldier_m_01", "name": "伊薩克", "gender": "m", "age": "adult", "years": 29, "job": "soldier", "work": ["garrison"], "height": 1.78, "sheet": "workers", "weight": 1},
    {"id": "builder_m_01", "name": "馬丁", "gender": "m", "age": "adult", "years": 41, "job": "builder", "work": ["builder", "build", "soapworks"], "height": 1.73, "sheet": "workers", "weight": 1},
    {"id": "lumberjack_m_01", "name": "奧托", "gender": "m", "age": "adult", "years": 36, "job": "lumberjack", "work": ["lumber-camp", "sawmill"], "height": 1.82, "sheet": "workers", "weight": 1},
    {"id": "miner_m_01", "name": "魯本", "gender": "m", "age": "adult", "years": 44, "job": "miner", "work": ["mine", "clay-pit", "quarry"], "height": 1.68, "sheet": "workers", "weight": 1},
    {"id": "kilnman_m_01", "name": "加布里耶", "gender": "m", "age": "adult", "years": 48, "job": "kilnman", "work": ["brickworks", "ironworks", "pottery", "powder-mill", "lime-kiln", "glassworks"], "height": 1.75, "sheet": "workers", "weight": 1},
    {"id": "miller_m_01", "name": "盧卡", "gender": "m", "age": "adult", "years": 33, "job": "miller", "work": ["mill", "paper-mill"], "height": 1.71, "sheet": "workers", "weight": 1},
    {"id": "distiller_f_01", "name": "多蘿蕾絲", "gender": "f", "age": "adult", "years": 52, "job": "distiller", "work": ["distillery", "winery"], "height": 1.76, "sheet": "workers", "weight": 1},
    {"id": "tanner_f_01", "name": "瑪蒂爾達", "gender": "f", "age": "adult", "years": 39, "job": "tanner", "work": ["tannery", "slaughterhouse", "dyeworks"], "height": 1.79, "sheet": "workers", "weight": 1},
    {"id": "weaver_f_01", "name": "艾蓮娜", "gender": "f", "age": "adult", "years": 32, "job": "weaver", "work": ["weaver", "dyeworks", "tobacconist"], "height": 1.61, "sheet": "workers", "weight": 1},
    {"id": "ropemaker_f_01", "name": "艾蜜莉", "gender": "f", "age": "adult", "years": 46, "job": "ropemaker", "work": ["ropewalk"], "height": 1.74, "sheet": "workers", "weight": 1},
    {"id": "cooper_f_01", "name": "佩特拉", "gender": "f", "age": "adult", "years": 57, "job": "cooper", "work": ["cooper"], "height": 1.7, "sheet": "workers", "weight": 1},
    {"id": "salter_f_01", "name": "露莎", "gender": "f", "age": "adult", "years": 28, "job": "salter", "work": ["saltpan"], "height": 1.66, "sheet": "workers", "weight": 1},
    {"id": "porter_f_01", "name": "艾絲特", "gender": "f", "age": "adult", "years": 28, "job": "porter", "work": ["warehouse", "customs", "sheers", "ranch", "sugar-works", "crane", "tobacco-farm"], "height": 1.68, "sheet": "women", "weight": 1},
    {"id": "shipwright_f_01", "name": "瑪蒂娜", "gender": "f", "age": "adult", "years": 37, "job": "shipwright", "work": ["shipyard-small", "shipyard-large", "careening-wharf", "careening-beach", "carpenter", "chandlery"], "height": 1.72, "sheet": "women", "weight": 1},
    {"id": "clerk_f_01", "name": "莉迪雅", "gender": "f", "age": "adult", "years": 32, "job": "clerk", "work": ["customs", "townhall", "weighhouse", "palace", "harbour-office", "loggia", "monastery", "vinegar-house", "mint"], "height": 1.62, "sheet": "women", "weight": 1},
    {"id": "soldier_f_01", "name": "伊莎貝爾", "gender": "f", "age": "adult", "years": 27, "job": "soldier", "work": ["garrison", "commandant", "jail"], "height": 1.7, "sheet": "women", "weight": 1},
    {"id": "builder_f_01", "name": "貝雅特麗絲", "gender": "f", "age": "adult", "years": 43, "job": "builder", "work": ["builder", "build", "soapworks"], "height": 1.69, "sheet": "women", "weight": 1},
    {"id": "lumberjack_f_01", "name": "卡洛塔", "gender": "f", "age": "adult", "years": 35, "job": "lumberjack", "work": ["lumber-camp", "sawmill"], "height": 1.78, "sheet": "women", "weight": 1},
    {"id": "miner_f_01", "name": "諾艾米", "gender": "f", "age": "adult", "years": 40, "job": "miner", "work": ["mine", "clay-pit", "quarry"], "height": 1.63, "sheet": "women", "weight": 1},
    {"id": "kilnman_f_01", "name": "瑪格達", "gender": "f", "age": "adult", "years": 49, "job": "kilnman", "work": ["brickworks", "ironworks", "pottery", "powder-mill", "lime-kiln", "glassworks"], "height": 1.71, "sheet": "women", "weight": 1},
    {"id": "miller_f_01", "name": "塞西莉亞", "gender": "f", "age": "adult", "years": 34, "job": "miller", "work": ["mill", "paper-mill"], "height": 1.65, "sheet": "women", "weight": 1}
  ]
};

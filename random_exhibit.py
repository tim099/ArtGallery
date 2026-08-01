# -*- coding: utf-8 -*-
# 區塊職責：畫廊展品隨機挑選系統的初始化與參數配置
# 物理意義：本區塊負責載入必備函式庫、配置標準輸出編碼以避免 Windows cp950 亂碼，並解析 CLI 參數以決定要挑選的展品數量與主題分類。
# 數值影響：不直接改變展品內容，但控制後續篩選算法的輸入條件（數量 count、主題 theme）。
import argparse  # 用於解析命令行參數的標準庫
import os        # 用於進行檔案路徑運作的標準庫
import random    # 用於隨機抽樣展品的標準庫
import sys       # 用於系統標準流操作的標準庫
import io        # 用於處理檔案/文字流的標準庫

def main():
    # 區塊職責：配置標準輸出編碼，防止 Windows 環境下中文輸出變成亂碼
    # 物理意義：將 python 進程的標準輸出重定向為 utf-8 文字包裝器，確保任何終端都能正確解碼中文字串。
    # 數值影響：無修改，僅對字元顯示進行正確的編碼轉換。
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    # 區塊職責：定義並解析命令行參數
    # 物理意義：配置 ArgumentParser 以接收使用者傳入的 count (-n/--count) 與 theme (-t/--theme) 參數。
    # 數值影響：影響後續展品搜尋的起點目錄以及隨機抽樣的數量 k。
    parser = argparse.ArgumentParser(description="隨機從大小姐的畫展中挑選展品")
    # 設定選取數量參數
    parser.add_argument("-n", "--count", type=int, default=5, help="要挑選的展品數量 (預設為 5)")
    # 設定指定主題參數
    parser.add_argument("-t", "--theme", type=str, default=None, help="指定主題資料夾名稱 (例如 TRPG)")
    # 解析傳入的參數
    args = parser.parse_args()  # 解析傳入的命令行參數，產生 args 物件

    # 區塊職責：解析畫展根目錄與設定目標掃描路徑
    # 物理意義：獲取當前腳本所在的絕對目錄作為畫廊根目錄；若指定了主題，則將掃描範圍限定在主題子目錄。
    # 數值影響：將掃描的起點路徑 scope_path 設定為 gallery_root 或其子資料夾，縮小搜尋範圍。
    gallery_root = os.path.dirname(os.path.abspath(__file__))  # 獲取本檔案所在的絕對資料夾路徑
    scope_path = gallery_root  # 預設掃描的範圍為畫廊根目錄

    # 區塊職責：驗證主題是否存在並更新掃描起點
    # 物理意義：當使用者指定主題時，比對該主題子資料夾是否存在。若不存在則提示警告並退出，防止錯誤的目錄走訪。
    # 數值影響：如果主題存在，將 scope_path 更新為該主題目錄；若不存在則回報錯誤，提前終止腳本。
    if args.theme:  # 檢查使用者是否指定了主題參數
        theme_dir = os.path.join(gallery_root, args.theme)  # 拼接出主題資料夾的絕對路徑
        if os.path.isdir(theme_dir):  # 驗證該主題路徑是否為一個有效的資料夾
            scope_path = theme_dir  # 將走訪起點限制在該主題資料夾內
            print(f"  ℹ 指定主題篩選：{args.theme}")  # 印出當前篩選的主題名稱提示
        else:
            print(f"❌ 找不到指定的主題：{args.theme}，請確認該資料夾是否存在！")  # 錯誤提示
            return  # 終止程式執行

    # 區塊職責：遍歷檔案系統，篩選合法的畫展展品
    # 物理意義：深度優先走訪 scope_path 下的所有子目錄，挑選符合格式的 markdown 檔案，過濾掉腳本、暫存或噪音檔案。
    # 數值影響：動態填充 artworks 陣列，產出可用於抽樣的相對路徑清單。
    artworks = []  # 初始化儲存展品相對路徑的陣列
    for root, dirs, files in os.walk(scope_path):  # 走訪指定範圍目錄下的所有資料夾與檔案
        for file in files:  # 歷遍當前目錄下的檔案
            if file.endswith(('.py', '.json', '.pyc')):  # 過濾掉 Python 腳本及設定檔
                continue  # 跳過本次檔案處理
            if file == "README.md" and root == gallery_root:  # 過濾掉畫廊根目錄的說明檔
                continue  # 跳過說明檔
            if file.startswith("Persona_") or ".original" in file or file == "Zeta.md":  # 過濾非公開展出的個人配置或備份檔
                continue  # 跳過噪音與備份檔
            
            # 區塊職責：計算展品相對於畫廊根目錄的相對路徑
            # 物理意義：將檔案的絕對路徑轉換成相對於畫展根的相對路徑，並統一斜線格式以利跨平台顯示與點擊。
            # 數值影響：將路徑斜線統一為 '/' 並存入 artworks。
            rel_path = os.path.relpath(os.path.join(root, file), gallery_root)  # 計算相對於畫展根目錄的相對路徑
            rel_path = rel_path.replace("\\", "/")  # 將 Windows 的反斜線替換為標準正斜線
            artworks.append(rel_path)  # 將處理好的相對路徑存入展品清單
            
    # 區塊職責：空館藏防呆處理
    # 物理意義：當掃描出來的展品清單為空時，給出提示並優雅退出，避免後續 random.sample 拋出異常。
    # 數值影響：無修改，僅做空值安全攔截。
    if not artworks:  # 判斷展品清單是否為空
        print("哼，畫展裡目前什麼都沒有！快交出 token 讓我畫圖！")  # 空畫展時的傲嬌提示語
        return  # 終止程式
        
    # 區塊職責：展品數量安全限制與隨機抽樣
    # 物理意義：防範 args.count 為負數或超出館藏總數導致抽樣失敗。利用 random.sample 進行無重複隨機抽樣。
    # 數值影響：計算出最安全的抽樣數 k，並從 artworks 中隨機抽出 k 件展品路徑存入 selected。
    k = max(0, min(args.count, len(artworks)))  # 將抽樣數限制在 [0, artworks總數] 的安全區間內
    selected = random.sample(artworks, k)  # 從展品清單中無重複隨機抽取 k 個展品
    
    # 區塊職責：展品清單格式化輸出
    # 物理意義：將抽取的展品格式化印在終端，方便開發者直接點擊或複製，並附帶傲嬌的提示語引導欣賞。
    # 數值影響：純文字輸出，無數值影響。
    theme_title = f" ({args.theme})" if args.theme else ""  # 若有指定主題，在標題中顯示
    print(f"✨ 大小姐為您隨機挑選的 {k} 件展品{theme_title} ✨")  # 印出挑選結果標題
    print("=" * 45)  # 印出分隔線
    for idx, item in enumerate(selected, 1):  # 遍歷抽樣結果
        print(f"[{idx}] {item}")  # 輸出展品的相對路徑
    print("=" * 45)  # 印出分隔線
    print("請在編輯器中開啟對應的文件，帶著敬畏之心好好欣賞本小姐的傑作！")  # 傲嬌提示語

if __name__ == "__main__":
    main()  # 呼叫主函式進入程式

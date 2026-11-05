# FairPay AI｜繁體中文指南

FairPay AI 是一套以合約證據為基礎的帳務審核原型。它結合 AI 輔助條款分析、人工審核、應收款計算及 PayPal Sandbox 發票草稿管理。

[專案首頁](../../README.md) · [3 分鐘產品示範](https://www.youtube.com/watch?v=pivk3KyXpEQ)

## 想做什麼？

| 目的 | 相關說明 |
| --- | --- |
| 了解產品及三個主要畫面 | [產品操作流程](../USER_GUIDE.md) |
| 查看三個頁面的實際操作截圖 | [產品畫面導覽](../PRODUCT_TOUR.md) |
| 在本機試用兩組合成範例 | [安全示範步驟](../../FairPay/DEMO_GUIDE.md) |
| 安裝程式、啟用 AI 或設定 PayPal Sandbox | [安裝與設定](../DEVELOPER_GUIDE.md) |
| 了解程式模組及資料流程 | [系統架構](../../FairPay/ARCHITECTURE.md) |
| 檢查測試結果、驗證範圍與限制 | [驗證與限制](../VALIDATION.md) |
| 了解資料保存及財務安全機制 | [安全與隱私](../../FairPay/SECURITY_AND_PRIVACY.md) |
| 查閱先前的文件與工程紀錄 | [歷史文件](../archive/README.md) |

## 產品介面

| 畫面 | 主要用途 |
| --- | --- |
| **Overview** | 查看專案，並預覽兩組合成帳務情境 |
| **Agreements** | 載入合約條款、使用選用的本機 AI 分析、核對來源證據 |
| **Payments** | 檢查人工紀錄的 credit、應收餘額、審核條件及 PayPal Sandbox 發票狀態 |

## 本機快速啟動

先安裝 **Node.js 22 或更新版本**。在 Terminal 執行：

```bash
git clone https://github.com/tai-tai-12/fairpay-ai.git
cd fairpay-ai/FairPay
npm run setup
npm start
```

使用瀏覽器打開 `http://127.0.0.1:3000`。全新安裝沒有已儲存專案。可先到 **Overview → Preview two safe billing decisions**，查看不需要 AI 或 PayPal 帳號的範例。

範例預覽只會填入虛構文字，不會自動分析、儲存專案、記錄付款或建立發票。

## 選用功能

- **實際 AI 分析**：另行安裝並啟動 [Ollama](https://ollama.com/download)，執行 `ollama pull qwen3:4b-instruct`，再於 **Agreements** 按 **Analyze**。模型輸出仍須核對原始條款。
- **PayPal Sandbox 測試**：使用自己的 Sandbox 開發者帳號與測試憑證。不要使用 Live credentials，也不要用真實客戶或付款資料。
- **文件匯入**：TXT 與 MD 較通用。DOCX 需要系統 `unzip`；文字型 PDF 目前需要 macOS PDFKit，不支援掃描型 PDF 的 OCR。

## 金額與狀態的判讀

- 合約金額、人工紀錄的 credit，以及應收餘額必須分開看待。
- AI 建議不是開票授權；人工紀錄的 credit 不是銀行驗證的付款。
- 影片中現有的 **$400 PayPal Sandbox DRAFT** 屬於另一個合成範例，未寄出也未付款。全新下載的程式不包含該筆私人 Sandbox 發票及歷史專案資料。
- 本專案僅供本機使用與合成資料展示，不具備正式環境的身分驗證、銀行對帳或安全部署機制。

若要執行自動化檢查，請依照 [安裝與設定](../DEVELOPER_GUIDE.md) 和 [驗證與限制](../VALIDATION.md) 的指令。應用程式的版本識別與影片剪輯版本是不同概念，詳見 [專案首頁](../../README.md#version-and-release-scope)。

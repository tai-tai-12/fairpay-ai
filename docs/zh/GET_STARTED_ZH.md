# FairPay AI｜繁體中文入門指南

這是目前公開 GitHub 的使用與檔案導覽，不是舊版 ZIP 上傳教學。

**正式入口：** [GitHub README](../../README.md) · [3 分鐘 V31 Demo](https://www.youtube.com/watch?v=pivk3KyXpEQ)

## 先看什麼？

1. **產品評審／新使用者**：先看影片，再看 [User Guide](../USER_GUIDE.md)。
2. **開發者／技術評審**：看 [Developer Guide](../DEVELOPER_GUIDE.md)，按照指令啟動。技術模組可查 [Architecture](../../FairPay/ARCHITECTURE.md)。
3. **驗證與限制**：看 [Validation & Limitations](../VALIDATION.md)，區分目前 focused checks、歷史 QA、Sandbox 影片證據與未驗證項目。
4. **舊草稿與紀錄**：統一放在 [Archive](../archive/README.md)，不再作為最新提交版本。

## 三個主要介面

| 介面 | 功能 |
| --- | --- |
| **Overview** | 查看專案及預覽兩組虛構帳務情境 |
| **Agreements** | 檢查來源條款，選用本機 AI 產生候選內容 |
| **Payments** | 檢查帳款、審核狀態和 PayPal Sandbox 草稿 |

## Mac 本機啟動

先安裝 Node.js **22 或更新版本**。在 Terminal 執行：

```bash
git clone https://github.com/tai-tai-12/fairpay-ai.git
cd fairpay-ai/FairPay
npm run setup
npm start
```

用瀏覽器打開 `http://127.0.0.1:3000`。全新安裝**沒有已儲存專案**，可先在 Overview 開啟範例預覽。預覽不會自動執行 AI、建立 credit 或呼叫 PayPal。

要真的執行 AI 分析，另外安裝並啟動 Ollama，再執行 `ollama pull qwen3:4b-instruct`。要測試 PayPal 則需自己的 Sandbox credentials，**不要使用 Live credentials**。

## 安全與版本

- 應用程式版本：`1.9.1-dev.8.6-sprint-b`。影片的 V31 是獨立的剪輯版本。
- 本專案只供**本機單人與合成資料**測試，不能用真實合約、真實資金或正式收款。
- 影片中的 $400 Sandbox DRAFT 屬於另一個既有範例。公開原始碼不包含它的私有 ID、帳務資料或登入憑證。
- 若要重現功能，請以 [Developer Guide](../DEVELOPER_GUIDE.md) 為主。不要依照 Archive 的舊草稿或已過時的內部 QA 指令操作。

**歷史工程交接紀錄：** [原版 README_START_HERE](../archive/FairPay_README_START_HERE_HISTORICAL.md)。目前請以最新版 Developer Guide 為準。

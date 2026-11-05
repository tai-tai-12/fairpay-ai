# FairPay dev8.6 Sprint B Clean Candidate
NON-RELEASE / SANDBOX ONLY. 本包不含私人資料、Git、Node binary 或模型；Node >=22 必須另行安裝，Python3 用於驗證／歷史測試 runner。App 使用 Node 內建模組，無需 npm install。

在全新空白資料夾解壓，進入 FairPay：
```sh
node --version
python3 tools/verify-clean.py
npm run setup
npm start
```
手動開啟 http://127.0.0.1:3000 。初始0 projects正常；不需任何舊 FairPay 目錄。setup只建立本資料夾空白credentials設定，不覆寫既有設定。不要複製舊資料或真實credentials。本工作包禁止所有真實PayPal寫入。

選用AI：本機Ollama及qwen3:4b-instruct需另行安裝／下載；沒有模型時可看UI和輸入合成範例，不能宣稱完成抽取。Optional OpenAI會把合約送到雲端，本次不設定或測試。PayPal Sandbox API另需帳號／網路／獨立授權；本次僅mock，不要求填密鑰。

QA: `npm run qa:dev8.5` 是focused suite，不是完整歷史測試；`npm test` 保留所有舊測試，已知不綠。詳QA_STATUS.md。測試不應使用真實資料。Ctrl-C停止server；本版.local-data只屬本版，勿分享。

完整離線 automated QA: `npm run qa:dev8.6` (mock providers)。需要 Python3 的 manifest/scanner 不會下載任何服務。Clean Candidate 保留舊 inventory驗證以展示歷史差異；`verify:package`預期失敗，`verify:candidate`才是本包完整性檢查。不要以重建舊hash掩飾差異。

Final Sprint B current QA: `npm run qa:sprint-a`. Read docs/sprint-a for current-contract tests, model false-block denominators and existing-draft read-only checklist. Real linkage is INCOMPLETE; no PayPal write is authorized. `productVersion` is current; `appVersion` is compatibility-only.

Sprint B final demo instructions: `docs/sprint-b/FINAL_SCOPE_AND_DEMO.md`. The overview provides two fictional examples, neither a real PayPal transaction. Onboarding and local balance display changes do not alter backend financial policy. Browser execution may require your Mac if administrator policy blocks automated navigation.

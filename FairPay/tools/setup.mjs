import fs from 'node:fs';
import path from 'node:path';
const target=path.join(process.cwd(),'.env');
const template=path.join(process.cwd(),'.env.example');
if (!fs.existsSync(template)) {console.error('找不到 .env.example，請確認目前位於 解壓後的 FairPay 資料夾。');process.exit(1);}
if (fs.existsSync(target)) {
  console.log('已存在 .env，為保護你填寫的憑證，不會覆寫它。');
} else {
  fs.copyFileSync(template,target,fs.constants.COPYFILE_EXCL);
  try { fs.chmodSync(target,0o600); } catch {}
  console.log('已建立全新的 .env（不含任何私人憑證；沒有讀取舊版檔案）。');
}
console.log('下一步：執行 npm start，以空白 credentials 檢視本機合成範例；此工程包禁止真實 PayPal 寫入。');
console.log('免費 AI 預設是 Ollama，完全不需要 OpenAI API Key。');

import fs from 'node:fs';
const productVersion=fs.readFileSync(new URL('../VERSION.txt',import.meta.url),'utf8').trim();
const model=process.env.OLLAMA_MODEL || 'qwen3:4b-instruct';
console.log(`FairPay AI ${productVersion} — 本機設定檢查 (不會顯示 Secret)`);
console.log('Node.js:',process.version);
const version=Number(process.versions.node.split('.')[0]);
console.log(version>=22 ? 'Node version: OK':'Node version: Please install Node.js 22+');
console.log('AI Provider:',process.env.AI_PROVIDER||'ollama');
let reachable=false,installed=false;
try {
 const res=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(3000)});
 if(res.ok) {
   reachable=true;
   const d=await res.json();
   installed=Array.isArray(d.models)&&d.models.some(m=>m.name===model||m.model===model);
 }
} catch {}
console.log('Ollama:',reachable?'reachable':'not running — install/open Ollama App');
console.log('Model:',installed?`${model} installed`:`${model} not found — run: ollama pull ${model}`);
const id=(process.env.PAYPAL_CLIENT_ID||'').trim();
const secret=(process.env.PAYPAL_CLIENT_SECRET||'').trim();
const configured=Boolean(id && secret);
console.log('PayPal Sandbox credentials:',configured?'present (not yet validated by PayPal)':'missing — optional; do not configure credentials for this controlled review');
console.log('PayPal mode: SANDBOX ONLY / no real money');
if (version>=22&&reachable&&installed) console.log('AI READY: Open http://127.0.0.1:3000 after npm start');
else console.log('AI NOT READY: Follow README_START_HERE.md');
if(!configured) console.log('This controlled review prohibits PayPal writes; local AI extraction does not require PayPal credentials.');

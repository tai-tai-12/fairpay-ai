import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scoreCase,summarizeResults,chooseSamples} from './scorer.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PROJECT=path.resolve(ROOT,'..');
const args=process.argv.slice(2);
if(args.some(a=>a==='--help'||a==='-h')){
  console.log('Usage: node evaluation/run.mjs [--quick] [--holdout] [--stress] [--limit=N] [--base=http://127.0.0.1:3000]\nRequires running FairPay server and Ollama; NEVER creates PayPal invoices.');process.exit(0);
}
if(args.some(a=>!/^--(?:quick|holdout|stress|limit=\d+|base=http:\/\/127\.0\.0\.1:\d+)$/.test(a))){console.error('Unknown argument. Use --help.');process.exit(2);}
const quick=args.includes('--quick');
const holdout=args.includes('--holdout');
const stress=args.includes('--stress');
if([quick,holdout,stress].filter(Boolean).length>1){console.error('Choose one evaluation mode: --quick, --holdout, or --stress');process.exit(2);}
const limitRaw=args.find(x=>x.startsWith('--limit='));
const limit=limitRaw?Number(limitRaw.split('=')[1]):null;
if(limit!==null && (!Number.isSafeInteger(limit)||limit<1||limit>100)){console.error('Invalid limit');process.exit(2);}
const base=args.find(x=>x.startsWith('--base='))?.slice(7)||'http://127.0.0.1:3000';
const dataset=JSON.parse(await fs.readFile(path.join(ROOT,stress?'stress-v13.json':holdout?'holdout.json':'cases.json'),'utf8'));
const samples=chooseSamples(dataset,quick,limit);
let health;
try{
  const r=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(4000)});
  health=await r.json();
}catch{
  console.error('STOP: FairPay server is not running. Start this extracted copy using README_START_HERE.md; never use a historical project directory.');process.exit(2);
}
if(!health?.ok || health.aiProvider!=='ollama'||!health.aiConfigured){
  console.error('STOP: Local Ollama is not ready. Check http://127.0.0.1:3000/api/health first.');process.exit(2);
}
const productVersion=String(health.productVersion||'UNKNOWN');
const results=[];
console.log(`FairPay AI ${productVersion} EVALUATION: ${samples.length} synthetic agreements. LOCAL model: ${health.ollamaModel}. No PayPal requests.`);
for(let i=0;i<samples.length;i++){
  const sample=samples[i], start=performance.now();
  let response=null,err=null;
  try{
    const r=await fetch(`${base}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractText:sample.agreement}),signal:AbortSignal.timeout(220_000)});
    const payload=await r.json();
    if(!r.ok)throw new Error(`HTTP ${r.status}: ${String(payload?.error||'analysis failed').slice(0,180)}`);
    response=payload;
  }catch(e){err=String(e.message||e).slice(0,200);}
  const scored=scoreCase(sample,response,Math.round(performance.now()-start),err);
  results.push(scored);
  const status=err?'ERROR':scored.allAmountsCorrect&&scored.currencyCorrect&&scored.allGatesCorrect&&scored.allActionsCorrect&&scored.allSafetyCorrect?'PASS':'REVIEW';
  console.log(`[${i+1}/${samples.length}] ${sample.id} ${sample.category.padEnd(12)} ${status} (${scored.elapsedMs}ms)`);
}
const metrics=summarizeResults(results);
const timestamp=new Date().toISOString();
const payload={title:`FairPay AI ${productVersion} local evaluation`,productVersion,legacyAppVersion:health.appVersion,runType:'LIVE_OLLAMA',timestamp,model:health.ollamaModel,
  methodology:'Real POST /api/analyze requests through current application, per-case human-authored synthetic expectations. No PayPal writes.',
  limitations:['Synthetic dataset only; not representative of production contracts','Labels drafted for controlled scenarios, not independent expert legal review','Authorization uses synthetic human-attested receivable ledger, simulated client acceptance, and exact amount. No PayPal request; this is not proof of real debts or approvals.','Not a controlled study of real freelancer payment outcomes','Sequential calls; latency depends on Mac hardware and model load'],
  metrics,results,benchmark:stress?'POST_FIX_STRESS_SYNTHETIC':holdout?'PRIOR_HOLDOUT_SYNTHETIC':quick?'QUICK_SYNTHETIC':'FULL_SYNTHETIC'};
const output=path.join(PROJECT,'.local-data','evaluation');
await fs.mkdir(output,{recursive:true});
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const md=[`# FairPay AI — ${productVersion} Evaluation Report`,
  '',`**Run type:** LIVE Qwen/Ollama through /api/analyze (not a fixture test)`,
  `**Timestamp:** ${timestamp}`,`**Model:** ${health.ollamaModel}`,`**Cases:** ${metrics.attempted} attempted, ${metrics.completed} successful API requests, ${metrics.requestErrors} errors`,
  '',`## Metrics`,`| Metric | Result |`,`|---|---:|`,
  ...[
   ['Exact case correctness (amounts and currency)',metrics.caseExactPercent],
   ['Milestone amount agreement with gold',metrics.milestoneAmountAccuracyPercent],
   ['Known amount accuracy',metrics.knownAmountAccuracyPercent],
   ['Missing amount detection',metrics.missingAmountHandlingPercent],
   ['Evidence traceability (returned milestones)',metrics.evidenceTraceabilityPercent],
   ['Milestone count accuracy',metrics.countAccuracyPercent],
   ['Currency recognition',metrics.currencyAccuracyPercent],
   ['Next-best action alignment',metrics.actionAccuracyPercent],
   ['Unsafe draft prevention (synthetic complete workflow)',metrics.unsafeDraftPreventionPercent],
   ['Gold-to-observed billing gate agreement (synthetic review)',metrics.gateAccuracyPercent],
   ['Positive authorization success (synthetic review)',metrics.expectedReadyCount?100*metrics.authorizedPositiveCount/metrics.expectedReadyCount:null],
   ['End-to-end case correctness (synthetic review)',metrics.endToEndCaseExactPercent]
  ].map(([k,v])=>`| ${k} | ${v===null?'N/A':v+'%'} |`),
  `| Unsafe simulated draft approvals | ${metrics.unsafeDraftsAllowed} / ${metrics.unsafeCasesTested} negative / extra cases |`,
  `| False blocks (gold ready → not ready) | ${metrics.falseBlockCount} / ${metrics.expectedReadyCount} |`,
  `| Unmatched extra predictions | ${metrics.unexpectedPredictions} |`,
  `| Median request latency | ${metrics.requestLatencyMedianMs??'N/A'} ms |`,
  `| P90 request latency | ${metrics.requestLatencyP90Ms??'N/A'} ms |`,
  '',`## Per-case results`,`| ID | Category | Gold / predicted amount(s) | Gold / observed gate | End-to-end correct | API error |`,`|---|---|---|---|---|---|`,
  ...results.map(r=>`| ${r.id} | ${r.category} | ${r.rows.map(x=>`${x.goldAmount??'UNKNOWN'} / ${x.predictedAmount??'UNKNOWN'}`).join('; ')} | ${r.rows.map(x=>`${x.goldGate} / ${x.predictedGate}`).join('; ')} | ${r.allAmountsCorrect&&r.currencyCorrect&&r.countCorrect&&r.allGatesCorrect&&r.allActionsCorrect&&r.allSafetyCorrect?'Yes':'No'} | ${r.error?String(r.error).replaceAll('|','/'):'—'} |`),
  '',`## Interpretation and limitations`,`- **Do not publish these scores as validated real-world performance.** Only controlled synthetic text was tested.`,
  `- Authorization is assessed after SYNTHETIC human-ledger reconciliation and approval in memory; no invoices or payments were created.`,
  `- Error cases count against case-level totals; missing metric denominators are exposed in results.json.`,
  `- This report measures neither collection speed nor actual late-payment reduction. Those require independent user studies.`,
  `- Report explicitly separates source extraction, synthetic complete authorization, and PayPal reality.`,
  `- Review all failed cases manually before making any accuracy claims.`,''].join('\n');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FairPay AI — Evaluation</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 20px;background:#f7faf8;color:#16302a}h1{font-size:2.4rem}small{color:#51685e}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px;margin:28px 0}.card{background:white;border:1px solid #d2e3da;border-radius:14px;padding:18px}.number{font-size:2rem;font-weight:750}.sub{color:#567469}table{border-collapse:collapse;width:100%;background:white}td,th{padding:11px;border-bottom:1px solid #e2ece5;text-align:left;font-size:14px}th{background:#eaf5ef}.bad{color:#a52222;font-weight:bold}.good{color:#196740;font-weight:bold}.note{border-left:4px solid #849c91;padding:10px 16px;margin:25px 0;background:white}@media(max-width:640px){table{font-size:12px}td,th{padding:6px}}</style><h1>FairPay AI · Evaluation ${escape(productVersion)}</h1><small>Local Ollama model: ${escape(health.ollamaModel)} · ${escape(timestamp)} · ${samples.length} synthetic cases</small><div class="note"><strong>LIVE model test, not production validation.</strong> No PayPal requests. Authorization is simulated with a synthetic human-attested ledger, synthetic client approval and exact amount.</div><div class="cards">${[['Amount and currency',metrics.caseExactPercent],['Billing gate agreement',metrics.gateAccuracyPercent],['Positive authorization',metrics.expectedReadyCount?100*metrics.authorizedPositiveCount/metrics.expectedReadyCount:null],['Unsafe draft prevention',metrics.unsafeDraftPreventionPercent]].map(([k,v])=>`<div class="card"><div class="sub">${escape(k)}</div><div class="number">${v===null?'N/A':v+'%'}</div></div>`).join('')}</div><p><strong>${metrics.completed}/${metrics.attempted}</strong> requests completed · <strong>${metrics.unsafeDraftsAllowed}</strong> unsafe simulated approvals · <strong>${metrics.falseBlockCount}/${metrics.expectedReadyCount}</strong> false blocks · Median latency: ${metrics.requestLatencyMedianMs??'N/A'} ms</p><h2>All cases</h2><table><thead><tr><th>Test</th><th>Category</th><th>Gold → Predicted</th><th>Gate expected → observed</th><th>End-to-end result</th><th>Reasons</th></tr></thead><tbody>${results.map(r=>`<tr><td>${escape(r.id)}</td><td>${escape(r.category)}</td><td>${r.rows.map(x=>`${escape(x.goldAmount??'Unknown')} → ${escape(x.predictedAmount??'Unknown')}`).join('<hr>')}</td><td>${r.rows.map(x=>`${escape(x.goldGate)} → ${escape(x.predictedGate)}`).join('<hr>')}</td><td class="${!r.error&&r.allAmountsCorrect&&r.currencyCorrect&&r.allSafetyCorrect&&r.allGatesCorrect&&r.allActionsCorrect&&r.countCorrect?'good':'bad'}">${r.error?'API ERROR':r.allAmountsCorrect&&r.currencyCorrect&&r.allSafetyCorrect&&r.allGatesCorrect&&r.allActionsCorrect&&r.countCorrect?'Pass':'Review'}</td><td>${escape(r.failReasons?.join(', ')||'—')}</td></tr>`).join('')}</tbody></table><div class="note"><strong>Limits:</strong> Synthetic human-attested ledger and client acceptance are NOT verified financial evidence. Synthetic benchmarks; not independent legal review or user study. Incomplete data and mismatched milestone counts may degrade amount scores. Review detailed JSON before citing results.</div></html>`;
const csvEscape=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const header=['case_id','category','index','gold_amount','predicted_amount','expected_gate','observed_gate','pre_review_gate','gate_correct','review_simulation','amount_correct','evidence_ok','unsafe_allowed','action_correct','error','failure_reasons'];
const csv=[header.join(','),...results.flatMap(r=>[...r.rows,...(r.extraRows||[])].map(v=>[r.id,r.category,v.index,v.goldAmount,v.predictedAmount,v.goldGate,v.predictedGate,v.preReviewGate,v.gateCorrect,v.reviewSimulation,v.amountCorrect,v.evidenceOk,v.unsafeAllowed,v.actionCorrect,r.error||'',(r.failReasons||[]).join(';')].map(csvEscape).join(',')))].join('\n')+'\n';
await Promise.all([
 fs.writeFile(path.join(output,'latest.json'),JSON.stringify(payload,null,2)+'\n'),
 fs.writeFile(path.join(output,'latest.md'),md),
 fs.writeFile(path.join(output,'latest.html'),html),
 fs.writeFile(path.join(output,'latest.csv'),csv)
]);
console.log('\nLIVE MODEL RESULTS (synthetic dataset; not external validity):');
for(const [name,k] of [['Extraction exact cases','caseExactPercent'],['Milestone amount accuracy','milestoneAmountAccuracyPercent'],['Billing gate agreement','gateAccuracyPercent'],['End-to-end exact cases','endToEndCaseExactPercent'],['Unsafe draft prevention (synthetic)','unsafeDraftPreventionPercent'],['Action alignment','actionAccuracyPercent']])console.log(`${name}: ${metrics[k]===null?'N/A':metrics[k]+'%'}`);
console.log(`Unsafe approvals (dry-run only): ${metrics.unsafeDraftsAllowed}/${metrics.unsafeCasesTested}`);
console.log(`Valid authorizations (synthetic): ${metrics.authorizedPositiveCount}/${metrics.expectedReadyCount}`);
console.log(`False blocks (synthetic): ${metrics.falseBlockCount}/${metrics.expectedReadyCount}`);
console.log(`Reports saved to ${output}`);
// Preserve EVERY run under a unique timestamp folder; latest.* remain convenience aliases.
const stamp=timestamp.replace(/[:.]/g,'-');
const historical=path.join(output,'history',`${stamp}_${stress?'stress':holdout?'holdout':quick?'quick':'full'}`);
await fs.mkdir(historical,{recursive:true});
await Promise.all(['json','html','csv','md'].map(ext=>fs.copyFile(path.join(output,`latest.${ext}`),path.join(historical,`report.${ext}`))));
console.log(`Immutable run copy: ${historical}`);
console.log('Open report on Mac with: open .local-data/evaluation/latest.html');
process.exit(metrics.requestErrors?1:0);

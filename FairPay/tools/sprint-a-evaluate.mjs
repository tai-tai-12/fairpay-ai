/** No provider writes, projects API, credentials, or existing data. Live mode only calls loopback health/analyze. */
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {createProject,validateDraft,publicProject} from '../project-model.mjs';import {attachEvidence} from '../agreement-evidence.mjs';import {recordReceivable} from '../receivables.mjs';import {FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';import {scoreCase,summarizeResults} from '../evaluation/scorer.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function evaluate(base=null){
 const bytes=await fs.readFile(path.join(root,'evaluation/sprint-a-workflows.json'));const sha=crypto.createHash('sha256').update(bytes).digest('hex');if(sha!==(await fs.readFile(path.join(root,'evaluation/sprint-a-workflows.sha256'),'utf8')).trim())throw Error('Frozen criteria mismatch');
 if(base&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Loopback only');
 const health=base?await(await fetch(base+'/api/health',{signal:AbortSignal.timeout(5000)})).json():null;if(base&&(!health.aiConfigured||health.aiProvider!=='ollama'||health.paypalConfigured))throw Error('Require local Ollama and empty provider credentials');
 const rows=[];
 for(const c of JSON.parse(bytes).cases){let response=null,status=null,error=null,allowed=false,reason='',receivable=null,ledgerRecorded=false;const start=performance.now();
 try{
  if(base){const r=await fetch(base+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractText:c.source}),signal:AbortSignal.timeout(220000)});status=r.status;response=await r.json();if(!r.ok){reason='Analysis rejected: '+String(response.error||status);if(r.status!==422)throw Error(reason);}}
  else response={currency_code:'USD',milestones:[{title:'Report',trigger:'acceptance',amount:c.amount,source_excerpt:c.source,amount_verification:c.amendment?'amendment_review':'verified',evidence_matched:true,financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}]};
  if(!base||status===200){const p=createProject({currency:response.currency_code,milestones:response.milestones});attachEvidence(p,c.source);
   if(!c.ambiguousCredit){try{recordReceivable(p,{confirmed:true,expectedRevision:null,agreementVersionId:p.agreementVersionId,complete:true,confirmation:{humanVerified:true,reference:'Synthetic Sprint A full accounting review; no bank verification'},gross:p.milestones.map(m=>({milestoneId:m.canonicalId,amount:m.amount,currency:'USD',humanVerified:true,reference:m.source_excerpt})),credits:c.credit?[{id:'synthetic-credit-100',kind:'credit',amount:c.credit,currency:'USD',humanVerified:true,reference:'Synthetic external credit reference A2-100',allocations:[{milestoneId:p.milestones[0].canonicalId,amount:c.credit}]}]:[]});ledgerRecorded=true;}catch(e){reason='Ledger precondition: '+e.message;}}
   for(const m of p.milestones)if(c.acceptance){m.approvalStatus='approved';m.approvalVersionId=p.agreementVersionId;}
   receivable=publicProject(p).receivable;
   // Authorize only one expected milestone, exact human-specified amount; never silently select a model amount.
   const amount=c.credit&&!c.wrongAmount?'400.00':'500.00';
   if(p.milestones.length!==1)reason='Expected exactly one milestone; extraction coverage unresolved';
   else try{validateDraft(p,0,'synthetic@example.test',true,{ledgerRevisionId:p.receivableLedger?.id,authorizedAmount:amount,netAmountConfirmed:true});allowed=true;reason='Simulated complete human workflow authorized exact '+amount;}catch(e){reason=reason||e.message;}
  }
 }catch(e){error=String(e);}
 rows.push({id:c.id,expectedReady:c.expectedReady,allowed,pass:!error&&allowed===c.expectedReady,reason,ledgerRecorded,receivable,status,response,error,elapsedMs:Math.round(performance.now()-start)});
 }
 const positive=rows.filter(r=>r.expectedReady),negative=rows.filter(r=>!r.expectedReady);
 const metrics={attempted:rows.length,completed:rows.filter(r=>!r.error).length,requestErrors:rows.filter(r=>r.error).length,expectedReadyCount:positive.length,authorizedPositiveCount:positive.filter(r=>r.allowed).length,falseBlockCount:positive.filter(r=>!r.allowed&&!r.error).length,positiveErrors:positive.filter(r=>r.error).length,expectedBlockedCount:negative.length,unsafeAllowCount:negative.filter(r=>r.allowed).length,negativeErrors:negative.filter(r=>r.error).length};
 const gold=JSON.parse(await fs.readFile(path.join(root,'evaluation/cases.json'),'utf8'));
 const controlled= ['N02','M01','A01'].map(id=>{const sample=gold.cases.find(s=>s.id===id);const amount=id==='N02'?'275.00':id==='A01'?'550.00':null;return scoreCase(sample,{currency_code:sample.expected.currency,milestones:[{title:'Controlled scorer fixture',trigger:'acceptance',amount,evidence_matched:true,source_excerpt:sample.agreement.slice(0,65),amount_verification:id==='N02'?'verified':id==='A01'?'amendment_review':'needs_review',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}]});});
 return {method:base?'LIVE local Ollama extraction + in-memory simulated human review; zero PayPal calls':'DETERMINISTIC synthetic extraction fixtures + real production authorization functions; zero network',timestamp:new Date().toISOString(),criteriaSHA256:sha,health,metrics,rows,controlledScorer:{method:'Static controlled fixtures against frozen labels; NOT live extraction or independent accuracy',metrics:summarizeResults(controlled),results:controlled},limits:'Six synthetic cases, two positives. Human credit/acceptance simulated, not bank/client verification. No actual invoice created. Historical PDF not present in this workspace; ready-to-block observation is supplied review context only.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const [out,base]=process.argv.slice(2);if(!out)throw Error('Usage: node tools/sprint-a-evaluate.mjs NEW_REPORT.json [http://127.0.0.1:PORT]');const report=await evaluate(base);await fs.writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report.metrics));if(report.rows.some(r=>!r.pass))process.exitCode=1;}

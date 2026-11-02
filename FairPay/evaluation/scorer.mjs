/**
 * v1.2 evaluation logic. NEVER calls PayPal, never edits projects, never issues financial writes.
 * These are predeclared synthetic-case gold labels, not claims of real-world accuracy.
 */
import {createProject,validateDraft,projectMilestoneState} from '../project-model.mjs';
import {recordReceivable} from '../receivables.mjs';
import {nextActions} from '../action-engine.mjs';

const cents = x => {
  if (x===null || x===undefined || x==='') return null;
  const s=String(x).trim();
  if(!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(s))return null;
  const v=Math.round(Number(s)*100);
  return v>0 && Number.isSafeInteger(v)?v:null;
};
/**
 * Three separate claims are measured, never conflated:
 * (1) source extraction matches hand-authored labels;
 * (2) unreviewed projects are NOT invoice-eligible;
 * (3) a synthetic human-reviewed, version-bound ledger + approval + exact amount
 *     can authorize a good candidate, but not an unsupported one.
 * No PayPal request or real user approval is performed. The intentionally
 * self-attested ledger is not independent proof of debt or bank settlement.
 */
function gateAndAction(actual, currency){
  if(!actual)return {gate:'blocked',preReviewGate:'blocked',action:'NONE',reviewSimulation:'MISSING_MILESTONE'};
  let p;
  try{
    p=createProject({summary:'Benchmark synthetic project',currency:String(currency||'').toUpperCase(),milestones:[actual]},'Bench');
  }catch{return {gate:'blocked',preReviewGate:'blocked',action:'VERIFY_AMOUNT',reviewSimulation:'INVALID_ANALYSIS'};}
  p.agreementVersionId='synthetic-evaluation-version-1';
  const milestone=p.milestones[0];
  const preReviewGate=projectMilestoneState(p,milestone).code;
  // Simulate ledger review as a controlled test precondition, NOT verified cash.
  // A missing/ambiguous amount cannot make a valid human-recorded gross row.
  try {
    if(milestone.amount!==null && milestone.amount!==undefined){
      recordReceivable(p,{
        confirmed:true,expectedRevision:null,agreementVersionId:p.agreementVersionId,complete:true,
        confirmation:{humanVerified:true,reference:'Synthetic independent workflow QA attestation'},
        gross:[{milestoneId:milestone.canonicalId,currency:p.currency,amount:milestone.amount,
          humanVerified:true,reference:String(milestone.source_excerpt||'')}],credits:[]
      });
    }
  }catch(e){
    // The bad candidate remains blocked; never bypass production validation.
    return {gate:'blocked',preReviewGate,action:'VERIFY_AMOUNT',reviewSimulation:'REVIEW_REJECTED',reviewError:String(e.message||e).slice(0,180)};
  }
  milestone.approvalStatus='approved';
  const readiness=projectMilestoneState(p,milestone).code;
  let allowed=false;
  try{
    validateDraft(p,0,'demo-buyer@example.com',true,{
      ledgerRevisionId:p.receivableLedger?.id,
      authorizedAmount:String(milestone.amount),netAmountConfirmed:true
    });
    allowed=true;
  }catch{}
  const gate=allowed?'ready':readiness==='amendment'?'amendment':'blocked';
  const action=nextActions({...p,milestones:[{...milestone,index:0,readiness:projectMilestoneState(p,milestone)}]})[0]?.code||'NONE';
  return {gate,preReviewGate,action,reviewSimulation:'SYNTHETIC_HUMAN_REVIEW',reviewAuthorized:allowed};
}
export function scoreCase(sample,response,elapsedMs=null,error=null){
  const gold=sample.expected.milestones;
  const pred=Array.isArray(response?.milestones)?response.milestones:[];
  const predictedCurrency=String(response?.currency_code||'').toUpperCase();
  const currencyCorrect=predictedCurrency===sample.expected.currency;
  const countCorrect=pred.length===gold.length;
  const rows=gold.map((g,index)=>{
    const a=pred[index];
    const gCents=cents(g.amount),aCents=a?cents(a.amount):null;
    const amountCorrect=Boolean(a)&&aCents===gCents;
    const evidenceOk=Boolean(a?.evidence_matched);
    const gate=gateAndAction(a,predictedCurrency);
    const expectedAction=g.gate==='ready'?'PREPARE_DRAFT':g.gate==='amendment'?'VERIFY_AMENDMENT':'VERIFY_AMOUNT';
    const gateCorrect=gate.gate===g.gate;
    // Any authorized, unsupported or incorrectly priced draft is unsafe.
    const unsafeAllowed=gate.gate==='ready' && (g.gate!=='ready'||!amountCorrect||!currencyCorrect||!evidenceOk||!countCorrect);
    // Action must match the true expected state AND the amount/currency context.
    const actionCorrect=Boolean(a)&&gate.action===expectedAction&&gateCorrect&&amountCorrect&&currencyCorrect&&evidenceOk&&!unsafeAllowed;
    return {index:index+1,goldAmount:g.amount,predictedAmount:a?.amount??null,
      goldGate:g.gate,predictedGate:gate.gate,preReviewGate:gate.preReviewGate,
      gateCorrect,verification:a?.amount_verification||null,reviewSimulation:gate.reviewSimulation,
      evidenceOk,amountCorrect,unsafeAllowed,action:gate.action,expectedAction,actionCorrect};
  });
  const extraRows=pred.slice(gold.length).map((extra,index)=>{
    const gate=gateAndAction(extra,predictedCurrency);
    return {index:gold.length+index+1,predictedAmount:extra?.amount??null,
      predictedGate:gate.gate,preReviewGate:gate.preReviewGate,unsafeAllowed:gate.gate==='ready',
      action:gate.action,reason:'Unmatched extra AI milestone; no expected billing authorization'};
  });
  const allAmountsCorrect=rows.every(x=>x.amountCorrect)&&countCorrect;
  const allGatesCorrect=rows.every(x=>x.gateCorrect)&&countCorrect;
  const allActionsCorrect=rows.every(x=>x.actionCorrect)&&countCorrect;
  const allSafetyCorrect=rows.every(x=>!x.unsafeAllowed)&&extraRows.every(x=>!x.unsafeAllowed);
  const failReasons=[];
  if(error)failReasons.push('REQUEST_ERROR');
  if(!countCorrect)failReasons.push('MILESTONE_COUNT_MISMATCH');
  if(!currencyCorrect)failReasons.push('CURRENCY_MISMATCH');
  if(!rows.every(x=>x.amountCorrect))failReasons.push('AMOUNT_MISMATCH');
  if(!allGatesCorrect)failReasons.push('BILLING_GATE_MISMATCH');
  if(!allActionsCorrect)failReasons.push('ACTION_MISMATCH');
  if(!rows.every(x=>x.evidenceOk))failReasons.push('EVIDENCE_NOT_VERIFIED');
  if(!allSafetyCorrect)failReasons.push('UNSAFE_DRAFT_GATE');
  return {id:sample.id,category:sample.category,scenario:sample.scenario,
    elapsedMs,error:error?String(error):null,expectedCount:gold.length,actualCount:pred.length,
    expectedCurrency:sample.expected.currency,predictedCurrency,
    countCorrect,currencyCorrect,allAmountsCorrect,allGatesCorrect,allActionsCorrect,allSafetyCorrect,
    rows,extraRows,failReasons,unexpectedPredictions:extraRows.length};
}
const percent=(num,den)=>den ? Number((100*num/den).toFixed(1)) : null;
function percentile(items,p){if(!items.length)return null;const s=[...items].sort((a,b)=>a-b);return Math.round(s[Math.min(s.length-1,Math.ceil(p*s.length)-1)]);}
export function summarizeResults(results){
  const evaluated=results.filter(x=>!x.error),failed=results.filter(x=>x.error);
  const rows=results.flatMap(x=>x.rows||[]);
  const evaluatedRows=evaluated.flatMap(x=>x.rows||[]);
  const safe=evaluatedRows.filter(r=>r.goldGate!=='ready');
  const positive=evaluatedRows.filter(r=>r.goldGate==='ready');
  const extras=evaluated.flatMap(x=>x.extraRows||[]);
  const invalidPositive=positive.filter(r=>!r.amountCorrect||!r.evidenceOk||r.actionCorrect===false && r.predictedGate==='ready');
  const expectedUnsafeTotal=safe.length+extras.length+invalidPositive.length;
  const validGold=rows.filter(r=>r.goldAmount!==null), missingGold=rows.filter(r=>r.goldAmount===null);
  const group={};
  for(const r of results){(group[r.category]??=[]).push(r);}
  const categoryBreakdown=Object.fromEntries(Object.entries(group).map(([k,v])=>[k,{cases:v.length,caseExact:v.filter(x=>!x.error&&x.allAmountsCorrect&&x.currencyCorrect).length,errors:v.filter(x=>x.error).length}]));
  const unsafe=[...safe,...extras,...positive].filter(r=>r.unsafeAllowed).length;
  const readyMismatch=positive.filter(r=>r.predictedGate!=='ready').length;
  return {
    attempted:results.length,completed:evaluated.length,requestErrors:failed.length,
    caseExactPercent:percent(evaluated.filter(r=>r.allAmountsCorrect&&r.currencyCorrect).length,results.length),
    endToEndCaseExactPercent:percent(results.filter(r=>!r.error&&r.allAmountsCorrect&&r.currencyCorrect&&r.allGatesCorrect&&r.allActionsCorrect&&r.allSafetyCorrect).length,results.length),
    milestoneAmountAccuracyPercent:percent(rows.filter(r=>r.amountCorrect).length,rows.length),
    knownAmountAccuracyPercent:percent(validGold.filter(r=>r.amountCorrect).length,validGold.length),
    missingAmountHandlingPercent:percent(missingGold.filter(r=>r.amountCorrect).length,missingGold.length),
    evidenceTraceabilityPercent:percent(rows.filter(r=>r.evidenceOk).length,rows.length),
    countAccuracyPercent:percent(evaluated.filter(r=>r.countCorrect).length,results.length),
    currencyAccuracyPercent:percent(evaluated.filter(r=>r.currencyCorrect).length,results.length),
    actionAccuracyPercent:percent(rows.filter(r=>r.actionCorrect).length,rows.length),
    gateAccuracyPercent:percent(rows.filter(r=>r.gateCorrect).length,rows.length),
    expectedReadyCount:positive.length,authorizedPositiveCount:positive.filter(r=>r.predictedGate==='ready'&&!r.unsafeAllowed).length,
    falseBlockCount:readyMismatch,falseBlockPercent:percent(readyMismatch,positive.length),
    unsafeDraftsAllowed:unsafe,unexpectedPredictions:extras.length,
    unexpectedReady:extras.filter(r=>r.unsafeAllowed).length,
    unsafeCasesTested:expectedUnsafeTotal,
    unsafeDraftPreventionPercent:percent(expectedUnsafeTotal-unsafe,expectedUnsafeTotal),
    requestLatencyMedianMs:percentile(evaluated.map(r=>r.elapsedMs).filter(Number.isFinite),0.5),
    requestLatencyP90Ms:percentile(evaluated.map(r=>r.elapsedMs).filter(Number.isFinite),0.9),
    categoryBreakdown
  };
}
export function chooseSamples(dataset,quick=false,limit=null){
  const all=dataset.cases;
  if(!Array.isArray(all) || all.length<1)throw new Error('Dataset is empty');
  const base=quick ? ['N01','M01','A01','C01','U01','I01'].map(id=>all.find(c=>c.id===id)).filter(Boolean) : all;
  return limit?base.slice(0,limit):base;
}

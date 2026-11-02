/**
 * Fail-closed, contract-wide guard for EXPLICIT USD contract caps/totals.
 * This is deliberately narrow: it is not a contract-law interpreter, it never
 * infers an overall cap from a standalone milestone fee, and it never assumes
 * that every legitimate agreement must have milestones summing to its budget.
 */
import {minorUnits} from './receivables.mjs';

const USD = '(?:USD\\s*|US\\$\\s*)';
const AMOUNT = '(\\d[\\d,]*(?:\\.\\d{1,2})?)';
const GLOBAL_CUE = /\b(?:total\s+(?:agreed\s+)?contract\s+(?:amount|fee|price|value)|contract\s+total|(?:overall|aggregate)\s+(?:contract\s+)?(?:price|fee|amount|value)|(?:maximum|total)\s+project\s+(?:fee|price|value|amount)|maximum\s+contract\s+(?:amount|fee|price|value)|(?:entire|whole)\s+(?:project|agreement)\s+(?:fee|price|amount)|not\s+to\s+exceed|total\s+agreed\s+(?:price|fee|amount))\b/i;
const NUMBERED = /\bMilestone\s*(\d+)\s*:/gi;
const AMOUNT_TOKEN = new RegExp(USD + AMOUNT + '(?![\\d,]|\\.\\d)' ,'gi');
const AMOUNT_AFTER = new RegExp('\\b'+AMOUNT+'\\s*USD\\b','gi');
const UNCERTAIN = /\b(?:optional|if\s+(?:requested|approved|ordered)|subject\s+to|estimated|estimate|variable|hourly|per\s+hour|unconfirmed|additional\s+fee|separate\s+fee|plus\s+(?:tax|expenses)|excluding\s+(?:tax|expenses)|discount|refund|credit|scope\s+change|revised|superseded|amendment)\b/i;

function amounts(text){
 const result=[];
 for(const regex of [AMOUNT_TOKEN,AMOUNT_AFTER])for(const m of String(text).matchAll(regex)){
  try{result.push(minorUnits(m[1].replaceAll(',',''),'USD'));}catch{/* invalid amounts are not evidence */}
 }
 return [...new Set(result)];
}
function verdict(code, reason, capMinor=null, sumMinor=null){
 return {status:'blocked',riskCodes:[code],reasons:[reason],capMinor,sumMinor};
}

export function assessContractAggregate(agreement, milestones=[]){
 const text=String(agreement||'');
 if(!text)return {status:'not_applicable',riskCodes:[],reasons:[]};
 // Detect a contract-wide fee cap or a stated full contract total, even when
 // its sentence appears after the numbered milestone schedule.
 const statements=text.split(/(?<=[.!?])\s+|[\r\n]+/).map(s=>s.trim()).filter(Boolean);
 const capStatements=statements.filter(s=>GLOBAL_CUE.test(s));
 if(capStatements.length===0)return {status:'not_applicable',riskCodes:[],reasons:[]};
 const caps=[...new Set(capStatements.flatMap(s=>amounts(s)))];
 if(caps.length!==1)return verdict('CONTRACT_TOTAL_REVIEW_REQUIRED',
  'An overall contract total or cap is stated, but its exact USD amount is missing or ambiguous. Clarify the controlling total before drafting.');
 const capMinor=caps[0];
 if(!Number.isSafeInteger(capMinor)||capMinor<=0)return verdict('CONTRACT_TOTAL_REVIEW_REQUIRED',
  'The stated contract total is not a valid positive USD amount.');
 const items=Array.isArray(milestones)?milestones:[];
 if(items.length===0)return verdict('CONTRACT_TOTAL_REVIEW_REQUIRED',
  'The agreement states a contract cap but the milestone amounts cannot be checked.',capMinor);
 // Only amounts independently source-verified by the existing pipeline count.
 // A model-proposed amount must never count as ground truth.
 const verified=items.map(m=>{
  if(!m?.evidence_matched||!['verified','corrected','amendment_review'].includes(m?.amount_verification)||m?.amount==null)return null;
  try{return minorUnits(m.amount,'USD');}catch{return null;}
 });
 if(verified.some(x=>x===null))return verdict('CONTRACT_TOTAL_REVIEW_REQUIRED',
  'The agreement states an overall contract total, but one or more milestone fees are unverified. Reconcile the full scope.',capMinor);
 const sumMinor=verified.reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(sumMinor))return verdict('CONTRACT_TOTAL_REVIEW_REQUIRED','The milestone total exceeds supported exact-value limits.',capMinor);
 if(sumMinor>capMinor)return verdict('CONTRACT_TOTAL_CAP_EXCEEDED',
  `Verified milestone fees total USD ${(sumMinor/100).toFixed(2)}, exceeding the stated USD ${(capMinor/100).toFixed(2)} overall contract cap or total. Clarify the controlling schedule; no new draft is authorized.`,capMinor,sumMinor);
 // A lower sum does not automatically mean a defect: retainers, phases and
 // partial project scopes can legitimately have unallocated remaining amounts.
 // Where the text explicitly flags adjustments, we do not auto-infer their
 // financial effect; existing review and exact-authorisation remain required.
 return {status:'clear',riskCodes:[],reasons:[],capMinor,sumMinor,interpretation:UNCERTAIN.test(text)?'scope_review_recommended':'explicit_cap_check_only'};
}

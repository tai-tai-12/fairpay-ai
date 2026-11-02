/** Evidence ledger, not legal verification or authority to invoice.
 * Exact bounded integer minor units; no inferred zeroes, FX or adjustments.
 */
import crypto from 'node:crypto';
import {FINANCIAL_POLICY_REVISION} from './financial-policy.mjs';
const precision=Object.freeze({USD:2,JPY:0});
export function minorUnits(value,currency){
 const digits=precision[currency];
 if(digits===undefined||typeof value!=='string'||!new RegExp(`^(?:0|[1-9][0-9]{0,7})${digits?'(?:\\.[0-9]{1,'+digits+'})?':''}$`).test(value))throw Error('Invalid exact money string or unsupported currency precision.');
 const [whole,fraction='']=value.split('.');return Number(BigInt(whole)*10n**BigInt(digits)+BigInt(fraction.padEnd(digits,'0')||'0'));
}
export function decimalUnits(value,currency){
 if(!Number.isSafeInteger(value)||value<0||precision[currency]===undefined)throw Error('Invalid minor units.');
 const digits=precision[currency],s=String(value).padStart(digits+1,'0');return digits?s.slice(0,-digits)+'.'+s.slice(-digits):s;
}
const evidence=e=>e?.humanVerified===true&&typeof e.reference==='string'&&e.reference.trim().length>=8&&e.reference.length<=400;
export function calculateReceivable(project,ledger){
 const blocked=reason=>({status:'UNVERIFIED',reason,grossMinor:null,creditedMinor:null,outstandingMinor:null,currency:project.currency,authorizesInvoice:false});
 if(!ledger)return blocked('No financial reconciliation recorded. Source fee is not verified outstanding debt.');
 if(ledger.agreementVersionId!==project.agreementVersionId||!project.agreementVersionId||ledger.policyRevision!==FINANCIAL_POLICY_REVISION)return blocked('Evidence or policy changed; reconcile the current source again.');
 if(ledger.complete!==true||!evidence(ledger.confirmation))return blocked('Completeness and human financial review have not been recorded.');
 try{
  if(!Array.isArray(ledger.gross)||ledger.gross.length!==project.milestones.length||!Array.isArray(ledger.credits)||ledger.credits.length>100)throw Error('Every milestone requires a verified gross value; credit limit is 100.');
  const balances=new Map();let grossMinor=0,creditedMinor=0;
  for(const g of ledger.gross){
   const m=project.milestones.find(m=>m.canonicalId===g.milestoneId);
   if(!m||balances.has(g.milestoneId)||!evidence(g)||g.currency!==project.currency)throw Error('Gross scope, evidence or currency is missing or duplicated.');
   const n=minorUnits(g.amount,g.currency);if(n<=0)throw Error('Gross must be positive.');
   if(!m.source_excerpt||!g.reference.includes(m.source_excerpt)||m.amount==null||n!==minorUnits(m.amount,g.currency))throw Error('Gross must match the current source-checked amount and quote. Blocked fees need clarified evidence first.');
   balances.set(g.milestoneId,{milestoneId:g.milestoneId,grossMinor:n,creditedMinor:0});grossMinor+=n;
  }
  const ids=new Set(),references=new Set();
  for(const c of ledger.credits){
   if(typeof c.id!=='string'||!c.id||c.id.length>100||ids.has(c.id)||!['deposit','retainer','partial_payment','credit','offset'].includes(c.kind)||!evidence(c)||c.currency!==project.currency)throw Error('Credit ID, type, verified evidence or currency is invalid.');ids.add(c.id);
   const ref=c.reference.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
   if(references.has(ref))throw Error('Duplicate credit evidence reference within this ledger. Provide transaction-specific evidence and prevent double-counting.');references.add(ref);
   const n=minorUnits(c.amount,c.currency);if(n<=0||!Array.isArray(c.allocations)||!c.allocations.length)throw Error('Credit amount and allocation required.');
   let allocated=0;const scopes=new Set();
   for(const a of c.allocations){const row=balances.get(a.milestoneId);if(!row||scopes.has(a.milestoneId))throw Error('Duplicate or unknown allocation.');scopes.add(a.milestoneId);const v=minorUnits(a.amount,c.currency);if(v<=0)throw Error('Allocation must be positive.');allocated+=v;row.creditedMinor+=v;}
   if(allocated!==n)throw Error('Allocations must exactly conserve each credit; partial allocation remains unresolved.');creditedMinor+=allocated;
  }
  const milestones=[...balances.values()].map(r=>{if(r.creditedMinor>r.grossMinor)throw Error('Credit exceeds scoped gross amount.');return {...r,outstandingMinor:r.grossMinor-r.creditedMinor};});
  if(!Number.isSafeInteger(grossMinor)||!Number.isSafeInteger(creditedMinor))throw Error('Money total overflow.');
  return {status:'HUMAN_RECORDED',currency:project.currency,grossMinor,creditedMinor,outstandingMinor:grossMinor-creditedMinor,milestones,authorizesInvoice:false,reason:'Human-recorded reconciliation only; identity, debt and authorization are not independently verified. Existing policy gates still apply.'};
 }catch(e){return blocked(e.message);}
}
export function recordReceivable(project,input){
 if(project.archivedAt||project.pendingAnalysis||project.milestones.some(m=>m.invoices?.length||m.creationState||m.reanalysisRequired))throw Error('Reconciliation edit blocked during archived, pending, stale or invoice-bearing state.');
 if(input.confirmed!==true||input.expectedRevision!==(project.receivableLedger?.id||null))throw Error('Explicit confirmation and current ledger revision required.');
 const ledger={id:crypto.randomUUID(),at:new Date().toISOString(),agreementVersionId:input.agreementVersionId,policyRevision:FINANCIAL_POLICY_REVISION,complete:input.complete,confirmation:input.confirmation,gross:input.gross,credits:input.credits};
 for(const old of project.receivableLedger?.credits||[]){if(!ledger.credits?.some(c=>c.id===old.id&&JSON.stringify(c)===JSON.stringify(old)))throw Error('Previously recorded credits cannot be removed or rewritten. Manual reconciliation outside this candidate is required.');}
 const check=calculateReceivable(project,ledger);if(check.status!=='HUMAN_RECORDED')throw Error(check.reason);
 project.receivableHistory??=[];if(project.receivableHistory.length>=50)throw Error('Ledger history limit reached.');
 project.receivableHistory.push(structuredClone(ledger));project.receivableLedger=structuredClone(ledger);
 for(const m of project.milestones){m.receivableOutstandingMinor=check.milestones.find(r=>r.milestoneId===m.canonicalId).outstandingMinor;m.approvalStatus='pending';m.approvalVersionId=null;m.amendmentConfirmed=false;}
 return check;
}

/** A recorded credit cannot be asserted twice against different projects.
 * An id or human-provided external evidence reference reused across projects
 * is a conflict, including archived projects. This does not validate bank truth.
 * Invoke from the serialized global project-store transaction.
 */
export function assertUniqueCreditEvidence(projectId, incomingCredits, projects){
 if(!Array.isArray(incomingCredits))throw Error('Financial credit ledger must be an array.');
 const norm=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 const claimedIds=new Set(),claimedRefs=new Set();
 for(const p of projects){
  if(p.id===projectId)continue;
  for(const credit of p.receivableLedger?.credits||[]){
   if(norm(credit.id))claimedIds.add(norm(credit.id));
   if(norm(credit.reference))claimedRefs.add(norm(credit.reference));
  }
 }
 for(const credit of incomingCredits){
  if((norm(credit.id)&&claimedIds.has(norm(credit.id))) ||
     (norm(credit.reference)&&claimedRefs.has(norm(credit.reference))))
   throw Error('Possible duplicate credit across projects: external reference or credit ID is already recorded elsewhere. Inspect all ledgers; do not double-apply a deposit.');
 }
}

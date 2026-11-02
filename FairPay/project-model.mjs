import {assessContractAggregate} from './contract-invariants.mjs';
import {calculateReceivable,minorUnits} from './receivables.mjs';
import crypto from 'node:crypto';
import { validRecipient } from './lib.mjs';
import {FINANCIAL_POLICY_VERSION, FINANCIAL_POLICY_REVISION} from './financial-policy.mjs';
import {reconcileInvoice} from './payment-integrity.mjs';
const ALLOWED_VERIFICATIONS = new Set(['verified','corrected','amendment_review']);
export const nowIso = () => new Date().toISOString();
export function createProject(analysis, name='') {
  if (!analysis || !Array.isArray(analysis.milestones) || !analysis.milestones.length) throw new Error('Analyze a contract with milestones before saving a project.');
  if (analysis.milestones.length>8) throw new Error('Only 8 milestones are supported. Refusing to silently discard remaining contract obligations.');
  const timestamp=nowIso();
  const projectName=String(name || analysis.summary || 'Untitled project').trim().slice(0,100);
  if (!projectName) throw new Error('Project name cannot be empty.');
  return {id:crypto.randomUUID(),name:projectName,archivedAt:null,createdAt:timestamp,updatedAt:timestamp,currency:analysis.currency,
    milestones:analysis.milestones.slice(0,8).map((m,i)=>({index:i,canonicalId:crypto.randomUUID(),title:m.title,trigger:m.trigger,
      source_excerpt:m.source_excerpt,amount:m.amount,amount_verification:m.amount_verification,
      evidence_matched:Boolean(m.evidence_matched),
      financialPolicyVersion: m.financialPolicyVersion ?? null,
      financialPolicyRevision: m.financialPolicyVersion===FINANCIAL_POLICY_VERSION ? FINANCIAL_POLICY_REVISION : null,
      financialRiskCodes:Array.isArray(m.financialRiskCodes)?m.financialRiskCodes:[],
      financialRiskReasons:Array.isArray(m.financialRiskReasons)?m.financialRiskReasons:[], approvalStatus:'pending', amendmentConfirmed:false,
      invoices:[], creationState:null,updatedAt:timestamp}))};
}
export function stateOf(m) {
  if (m.invoices?.length) {
    const latest=m.invoices.at(-1);
    const check=reconcileInvoice(m,latest);
    if(!check.ok)return {code:'reconcile',label:'Invoice needs reconciliation',next:check.message||'Verify the stored invoice against current agreement terms.'};
    if(latest.status==='PAID')return {code:'paid',label:'Paid — confirmed by PayPal',next:'Payment is confirmed in the latest PayPal status.'};
    if(latest.status==='DRAFT')return {code:'draft',label:'PayPal draft created',next:'Review this draft in PayPal. FairPay does not send invoices.'};
    if(latest.status==='UNKNOWN')return {code:'unknown',label:'PayPal status unverified',next:'Refresh this invoice from PayPal before taking further action.'};
    return {code:'tracked',label:`PayPal: ${latest.status}`,next:'Refresh status from PayPal to check for changes. FairPay does not send reminders.'};
  }
  if(m.creationState==='uncertain' || m.creationState==='creating')return {code:'uncertain',label:'Invoice creation uncertain',next:'Check PayPal Sandbox for a matching invoice before attempting another draft.'};
  if(m.receivableOutstandingMinor!==undefined){
    // Legacy display-only state must fail closed for invalid or non-USD fees,
    // rather than throwing and making the entire project dashboard unavailable.
    let originalMinor;
    try{originalMinor=minorUnits(m.amount,'USD');}
    catch{return {code:'blocked',label:'Receivable amount needs review',next:'This fee cannot be reconciled as an exact USD amount. Review currency and source terms.'};}
    // A different net receivable is not intrinsically an error. The full
    // project-bound ledger and explicit exact-amount authorization are checked
    // by projectMilestoneState() and validateDraft(), never by this display state.
    if(!Number.isSafeInteger(m.receivableOutstandingMinor)||m.receivableOutstandingMinor<0)
      return {code:'blocked',label:'Receivable amount needs review',next:'Invalid recorded outstanding balance; reconcile the financial ledger again.'};
  }
  if(m.reanalysisRequired)return {code:'blocked',label:'Updated evidence requires analysis',next:'Re-analyze the full updated agreement. Prior approval no longer applies.'};
  if(m.financialPolicyVersion!==FINANCIAL_POLICY_VERSION || m.financialPolicyRevision!==FINANCIAL_POLICY_REVISION || (m.financialRiskCodes||[]).length)
    return {code:'blocked',label:'Financial policy review required',next:m.financialRiskReasons?.[0] || 'This project lacks the current financial-policy revision. Re-analyze the agreement before creating a new draft.'};
  if(!m.amount||!m.evidence_matched||!ALLOWED_VERIFICATIONS.has(m.amount_verification))return {code:'blocked',label:'Amount needs verification',next:'Edit the original agreement and re-analyze; do not invent an amount.'};
  if(m.approvalStatus!=='approved'||(m.evidenceVersionId&&m.approvalVersionId!==m.evidenceVersionId))return {code:'pending',label:'Awaiting client approval',next:'Confirm that the actual client approval occurred before drafting.'};
  if(m.amount_verification==='amendment_review'&&!m.amendmentConfirmed)return {code:'amendment',label:'Review contract amendment',next:'Review the controlling amendment and explicitly confirm the revised fee.'};
  return {code:'ready',label:'Ready to draft',next:'Review the terms and authorize a PayPal Sandbox draft.'};
}
export function summarize(project) {
  const sums={contractValueCents:0,readyToDraftCents:0,awaitingApprovalCents:0,draftedCents:0,paidCents:0,unverifiedCount:0,confirmedPaidCents:0,paidAmountUnknownCount:0};
  for(const m of project.milestones){
    if(!m.amount){sums.unverifiedCount++;continue;}
    let cents;
    try{cents=minorUnits(m.amount,'USD');}catch{continue;}
    sums.contractValueCents+=cents;
    const state=projectMilestoneState(project,m);
    if(state.code==='ready')sums.readyToDraftCents+=draftFinancialReview(project,m).amountMinor||0;
    if(state.code==='pending')sums.awaitingApprovalCents+=cents;
    if(state.code==='paid'){sums.paidCents+=m.invoices?.at(-1)?.authorization?.amountMinor??cents;const invoice=m.invoices.at(-1);if(invoice.total?.currency==='USD'&&invoice.lastVerifiedAt)sums.confirmedPaidCents+=minorUnits(invoice.total.value,'USD');else sums.paidAmountUnknownCount++;}
    if(['draft','tracked','unknown'].includes(state.code))sums.draftedCents+=m.invoices?.at(-1)?.authorization?.amountMinor??cents;
  }
  return sums;
}
/** Server-side, version-bound receivable gate. An identified contractual fee is not
 * proof of an unpaid balance. Legacy projects MUST complete an explicit review.
 */
export function draftFinancialReview(p,m){
  // Authorization-time defense in depth for persisted older agreement versions.
  // Existing invoice records are never altered or implicitly re-created.
  const storedSource=p.agreementVersions?.find(v=>v.id===p.agreementVersionId)?.sourceText;
  if(storedSource){
    const aggregate=assessContractAggregate(storedSource,p.milestones);
    if(aggregate.status==='blocked')return {eligible:false,reason:`Contract-wide financial review required: ${aggregate.reasons[0]}`};
  }
  const r=calculateReceivable(p,p.receivableLedger);
  if(!/^[a-f0-9-]{36}$/i.test(String(p.receivableLedger?.id||'')))return {eligible:false,reason:'Financial reconciliation revision is missing. Reconcile the agreement again.'};
  if(r.status!=='HUMAN_RECORDED')return {eligible:false,reason:'Record a complete financial reconciliation for the current agreement before creating a draft. Source fees alone do not establish outstanding debt.'};
  const row=r.milestones?.find(x=>x.milestoneId===m.canonicalId);
  if(!row||p.currency!=='USD'||m.amount==null)return {eligible:false,reason:'Invoice amount or currency is not supported by current financial evidence.'};
  try{
    const original=minorUnits(m.amount,p.currency);
    if(original!==row.grossMinor||row.creditedMinor<0||row.outstandingMinor!==original-row.creditedMinor)
      return {eligible:false,reason:'Gross, credits and outstanding balance do not reconcile; draft blocked.'};
    if(row.outstandingMinor===0)return {eligible:false,reason:'Nothing remains outstanding for this milestone. A zero-value invoice is not authorized.'};
    if(row.outstandingMinor<0)return {eligible:false,reason:'Negative receivable balance; draft blocked.'};
    return {eligible:true,ledgerRevisionId:p.receivableLedger.id,agreementVersionId:p.agreementVersionId,policyRevision:p.receivableLedger.policyRevision,
      grossMinor:original,creditedMinor:row.creditedMinor,amountMinor:row.outstandingMinor,currency:p.currency,
      requiresExactNetAuthorization:row.creditedMinor>0,
      reason:'Human-recorded outstanding balance; separate source validation, recorded client acceptance, and an explicit exact-amount Sandbox authorization remain required.'};
  }catch{return {eligible:false,reason:'Invalid receivable amount. Complete financial review again.'};}
}
/** Keep UI readiness and the financial KPI in sync with the authorization guard. */
export function projectMilestoneState(p,m){
  const state=stateOf(m);
  if(m.invoices?.length||m.creationState)return state;
  const review=draftFinancialReview(p,m);
  if(!review.eligible && ['ready','pending','amendment'].includes(state.code))
    return {code:'blocked',label:'Financial review required',next:review.reason};
  return state;
}
export function publicProject(p){
  const receivable=calculateReceivable(p,p.receivableLedger);
  const milestones=p.milestones.map(m=>({...m,readiness:projectMilestoneState(p,m)}));
  return {...p,receivable,milestones,summary:summarize(p)};
}
export function validateDraft(p,index,recipientEmail,confirmed,authorization={}){
  if(!Number.isInteger(index)||index<0||index>=p.milestones.length)throw new Error('Select a valid project milestone.');
  if(confirmed!==true)throw new Error('Review and authorize draft creation explicitly.');
  if(!validRecipient(recipientEmail))throw new Error('Enter a valid Sandbox recipient email.');
  const milestone=p.milestones[index];
  const state=stateOf(milestone);
  if(state.code!=='ready')throw new Error(`Draft blocked: ${state.label}. ${state.next}`);
  const review=draftFinancialReview(p,milestone);
  if(!review.eligible)throw new Error(`Draft blocked: ${review.reason}`);
  // All drafts, including no-credit invoices, are bound to an exact ledger
  // revision and human-confirmed amount. The store transaction rechecks both.
  if(authorization.ledgerRevisionId!==review.ledgerRevisionId ||
     typeof authorization.authorizedAmount!=='string' ||
     minorUnits(authorization.authorizedAmount,'USD')!==review.amountMinor ||
     authorization.netAmountConfirmed!==true)
    throw new Error('Draft blocked: exact invoice amount, current financial-review revision, and separate amount authorization are required.');
  return milestone;
}

/** Structural fingerprint avoids duplicate saves of identical evidence and milestones. */
export function projectFingerprint(project){
  const normalized=(project.milestones||[]).map(m=>[
    String(m.title||'').trim().toLowerCase(),String(m.amount||''),
    String(m.trigger||'').trim().toLowerCase(),
    String(m.source_excerpt||'').trim().toLowerCase()
  ]);
  return JSON.stringify({currency:project.currency,milestones:normalized});
}

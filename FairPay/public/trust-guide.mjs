/** Read-only, deterministic presentation of saved evidence and billing status.
 * NEVER authorizes an invoice, calls AI, sends PayPal requests, or infers a bank payment.
 */
import {getBillingJourney} from './billing-journey.mjs';

const reviewStages = [
  {id:'source',label:'Agreement'},
  {id:'ledger',label:'Financial review'},
  {id:'acceptance',label:'Acceptance'},
  {id:'draft',label:'Draft status'}
];
export function workspaceProgress(project,milestone){
 if(!project||!milestone)return {stages:reviewStages.map(x=>({...x,done:false})),current:'source',label:'Add an agreement',completed:0};
 const j=getBillingJourney(project,milestone);
 const invoice=j.invoice;
 const current=invoice?'draft':j.next==='source'?'source':j.next==='ledger'?'ledger':j.next==='acceptance'?'acceptance':'draft';
 const stages=reviewStages.map(s=>({...s,done:Boolean(j.stages.find(t=>t.id===s.id)?.done)}));
 const completed=stages.filter(s=>s.done).length;
 const label=invoice ? (String(invoice.status).toUpperCase()==='DRAFT'?'Review existing unsent draft':'Verify stored invoice status'):
  current==='source'?'Verify contract terms':current==='ledger'?'Record all deposits and credits':current==='acceptance'?'Record actual client acceptance':'Review exact net invoice amount';
 return {stages,current,label,completed,invoice};
}
const fmt=(minor,currency='USD')=>Number.isInteger(minor)?`${currency} ${(minor/100).toFixed(2)}`:'Not confirmed';
export function readOnlyDecisionGuide(project,milestone){
 if(!project||!milestone)return {summary:'Select a saved milestone to see the relevant evidence and next safe step.',questions:[]};
 const j=getBillingJourney(project,milestone),inv=j.invoice;
 const quote=String(milestone.source_excerpt||'').trim();
 const amountText=milestone.amount!=null&&milestone.evidence_matched?`The agreement contains ${project.currency||'USD'} ${Number(milestone.amount).toFixed(2)} for this milestone. This is a source-supported fee, not proof of outstanding debt.`:'The effective contract fee has not been verified against the source.';
 const balanceText=j.row?`Human-recorded gross ${fmt(j.row.grossMinor,project.currency)} minus recorded credits ${fmt(j.row.creditedMinor,project.currency)} = outstanding ${fmt(j.row.outstandingMinor,project.currency)}. Credits are not bank-verified.`:'No current, completed financial ledger is available. The outstanding balance cannot be determined from the source fee alone.';
 let nextText;
 if(inv)nextText=String(inv.status).toUpperCase()==='DRAFT'?'A Sandbox draft is saved but has not been sent. Inspect its PayPal read-back and do not create another.':'An invoice record already exists. Refresh and reconcile its status; do not retry creating it.';
 else if(j.next==='source')nextText='Review the original agreement, missing fee evidence, or controlling amendment before proceeding.';
 else if(j.next==='ledger')nextText='Complete the financial review with all prior payments and credits. This does not authorize an invoice.';
 else if(j.next==='acceptance')nextText='Record actual client acceptance. FairPay does not authenticate the client.';
 else nextText='Review the current ledger, exact invoice amount, recipient, and authorization before creating ONE unsent Sandbox draft.';
 return {summary:nextText,questions:[
  {id:'source',label:'Why this contract amount?',answer:amountText,source:quote?`Saved source excerpt: “${quote.slice(0,350)}”`:'Full source excerpt unavailable; verify agreement evidence in Agreements.'},
  {id:'balance',label:'How was the outstanding balance calculated?',answer:balanceText,source:j.row?'Current human-recorded ledger; accounting reference is not bank verification.':'No verified financial ledger available.'},
  {id:'next',label:'What can I do next?',answer:nextText,source:'Read-only explanation derived from stored policy and invoice state. Never an authorization.'}
 ]};
}
export function invoiceReviewPreview(project,milestone){
 if(!project||!milestone)return null;
 const j=getBillingJourney(project,milestone);
 if(j.invoice){const i=j.invoice;return {existing:true,amount:i.total?.value?`${i.total.currency||'USD'} ${i.total.value}`:'Provider amount unavailable',recipient:'See PayPal invoice details',note:`Existing invoice: ${i.invoiceId||'ID unavailable'}. Do not create another.`,ledgerId:i.authorization?.ledgerRevisionId||null};}
 if(!j.row||!j.ledger)return null;
 return {existing:false,amount:fmt(j.row.outstandingMinor,project.currency),recipient:'Enter and verify Sandbox buyer email below',note:'Preview only. This does not authorize an invoice or verify payment.',ledgerId:project.receivableLedger?.id||null,gross:fmt(j.row.grossMinor,project.currency),credits:fmt(j.row.creditedMinor,project.currency)};
}

/** v1.9.1-dev.5 — authoritative exact NET authorization, local mock only.
 * No credentials, live financial requests or external data are used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/server.mjs';
import {draftFinancialReview,validateDraft,publicProject,createProject} from '../project-model.mjs';
import {recordReceivable} from '../receivables.mjs';
import {reconcileInvoice} from '../payment-integrity.mjs';
import {FINANCIAL_POLICY_VERSION,FINANCIAL_POLICY_REVISION} from '../financial-policy.mjs';
const recipient='synthetic@example.test';
const excerpt='Milestone 1: Final report fee USD 500 after client acceptance.';
const extract=()=>({project_summary:'Synthetic project',currency_code:'USD',warnings:[],milestones:[{title:'Report',amount:'500',trigger:'client acceptance',source_excerpt:excerpt}]});
const sourceProject=()=>{const p=createProject({summary:'Synthetic project',currency:'USD',milestones:[{title:'Report',amount:'500.00',trigger:'acceptance',source_excerpt:excerpt,evidence_matched:true,amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}]});p.agreementVersionId='version-1';return p;};
function ledger(p,credits=[['deposit','100.00','credit-100']]){
 return {confirmed:true,expectedRevision:p.receivableLedger?.id||null,agreementVersionId:p.agreementVersionId,complete:true,confirmation:{humanVerified:true,reference:'Synthetic full balance check #2026-10-16'},gross:p.milestones.map(m=>({milestoneId:m.canonicalId,currency:'USD',amount:m.amount,humanVerified:true,reference:m.source_excerpt})),credits:credits.map(([kind,amount,id])=>({id,kind,amount,currency:'USD',humanVerified:true,reference:`Synthetic ${kind} external ledger reference ${id}`,allocations:[{milestoneId:p.milestones[0].canonicalId,amount}]}))};
}
test('NET-01 verified credits yield exact net eligibility without treating credits as bank-verified',()=>{
 const p=sourceProject();recordReceivable(p,ledger(p));p.milestones[0].approvalStatus='approved';
 const d=draftFinancialReview(p,p.milestones[0]);assert.equal(d.eligible,true);assert.equal(d.grossMinor,50000);assert.equal(d.creditedMinor,10000);assert.equal(d.amountMinor,40000);assert.equal(d.requiresExactNetAuthorization,true);
 assert.equal(publicProject(p).summary.readyToDraftCents,40000);
 assert.throws(()=>validateDraft(p,0,recipient,true),/exact (?:net|invoice) amount/i);
 assert.equal(validateDraft(p,0,recipient,true,{ledgerRevisionId:p.receivableLedger.id,authorizedAmount:'400.00',netAmountConfirmed:true}),p.milestones[0]);
});
test('NET-02 exact net confirmation prevents incorrect amount, stale ledger, missing confirmation and negative balance',()=>{
 const p=sourceProject();recordReceivable(p,ledger(p));p.milestones[0].approvalStatus='approved';const ok={ledgerRevisionId:p.receivableLedger.id,authorizedAmount:'400.00',netAmountConfirmed:true};
 for(const mutation of [{authorizedAmount:'500.00'},{authorizedAmount:'399.99'},{ledgerRevisionId:'previous-version'},{netAmountConfirmed:false},{authorizedAmount:'0'},{authorizedAmount:'not-money'}]){
  assert.throws(()=>validateDraft(p,0,recipient,true,{...ok,...mutation}),/exact (?:net|invoice) amount|invalid exact/i);
 }
 p.receivableLedger.policyRevision='outdated';assert.equal(draftFinancialReview(p,p.milestones[0]).eligible,false);
});
test('NET-03 full credit yields ZERO authorized invoice, not fake PayPal paid',()=>{
 const p=sourceProject();recordReceivable(p,ledger(p,[['deposit','500.00','fully-paid']]));p.milestones[0].approvalStatus='approved';
 assert.equal(publicProject(p).receivable.outstandingMinor,0);assert.equal(draftFinancialReview(p,p.milestones[0]).eligible,false);
 assert.equal(publicProject(p).summary.readyToDraftCents,0);assert.equal(publicProject(p).summary.confirmedPaidCents,0);
 assert.throws(()=>validateDraft(p,0,recipient,true,{ledgerRevisionId:p.receivableLedger.id,authorizedAmount:'0.00',netAmountConfirmed:true}),/blocked/i);
});
test('NET-04 multiple legitimate credits conserve cents precisely and produce expected draft value',()=>{
 const p=sourceProject();recordReceivable(p,ledger(p,[['deposit','100.50','dep-1'],['partial_payment','50.25','part-2'],['credit','0.25','credit-3']]));
 const d=draftFinancialReview(p,p.milestones[0]);assert.equal(d.creditedMinor,15100);assert.equal(d.amountMinor,34900);
});
test('NET-05 net reconciliation uses frozen authorized amount (not original gross) and rejects tampering',()=>{
 const m={amount:'500.00'}, authorization={operationId:'11111111-1111-4111-8111-111111111111',ledgerRevisionId:'ledger-revision',agreementVersionId:'v1',policyRevision:FINANCIAL_POLICY_REVISION,
 amountMinor:40000,grossMinor:50000,creditedMinor:10000,netAmountAuthorized:true,netReviewConfirmedAt:'2026-10-16T15:00:00Z',currency:'USD',recipientEmail:recipient};
 const inv={invoiceId:'INV2-NET-12345678',amount:'400.00',total:{currency:'USD',value:'400.00'},recipientEmail:recipient,providerRecipientEmail:recipient,status:'DRAFT',lastVerifiedAt:'2026-10-16T15:00:00Z',authorization};
 assert.equal(reconcileInvoice(m,inv).ok,true);
 for(const change of [{amount:'500.00'},{total:{currency:'USD',value:'500.00'}},{authorization:{...authorization,creditedMinor:9000}},{authorization:{...authorization,grossMinor:40000}},{authorization:{...authorization,amountMinor:50000}},{authorization:{...authorization,netReviewConfirmedAt:null}}])
  assert.equal(reconcileInvoice(m,{...inv,...change}).ok,false);
});
test('NET-06 integrated API: no gross bypass, one exact NET PayPal DRAFT, verified snapshot, duplicate blocked',async()=>{
 let writes=0;const id='INV2-NET-12345678';let lastPayload=null;
 const h=await harness(extract,async(req,res,json)=>{
  if(req.url.endsWith('/token'))return json(res,{access_token:'mock'});
  if(req.method==='POST'){writes++;let body='';for await(const c of req)body+=c;lastPayload=JSON.parse(body);return json(res,{id},201);}
  return json(res,{id,status:'DRAFT',amount:{currency_code:'USD',value:'400.00'},primary_recipients:[{billing_info:{email_address:recipient}}]});
 });
 try{
  const a=await h.request('/api/analyze',{contractText:excerpt});assert.equal(a.status,200);
  const saved=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Synthetic net test',persistEvidence:true});assert.equal(saved.status,201,JSON.stringify(saved.body));
  const p=saved.body.project,base=`/api/projects/${p.id}`;
  let r=await h.request(base+'/receivable',ledger(p));assert.equal(r.status,200,JSON.stringify(r.body));
  const revision=r.body.project.receivableLedger.id;
  await h.request(base+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId});
  const input={confirmed:true,milestoneIndex:0,recipientEmail:recipient,agreementVersionId:p.agreementVersionId};
  for(const wrong of [{},{authorizedAmount:'500.00',ledgerRevisionId:revision,netAmountConfirmed:true},{authorizedAmount:'400.00',ledgerRevisionId:'older',netAmountConfirmed:true}]){
   r=await h.request(base+'/drafts',{...input,...wrong});assert.equal(r.status,400,JSON.stringify(r.body));assert.equal(writes,0);
  }
  const authorized={...input,authorizedAmount:'400.00',ledgerRevisionId:revision,netAmountConfirmed:true};
  r=await h.request(base+'/drafts',authorized);assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(writes,1);
  assert.equal(lastPayload.items[0].unit_amount.value,'400.00');assert.equal(lastPayload.items[0].unit_amount.currency_code,'USD');
  const inv=r.body.project.milestones[0].invoices[0];assert.equal(inv.amount,'400.00');assert.equal(inv.authorization.amountMinor,40000);
  assert.equal(inv.authorization.grossMinor,50000);assert.equal(inv.authorization.creditedMinor,10000);assert.equal(inv.authorization.ledgerRevisionId,revision);assert.equal(inv.status,'DRAFT');
  assert.equal(r.body.project.summary.draftedCents,40000);
  r=await h.request(base+'/drafts',authorized);assert.equal(r.status,400);assert.equal(writes,1);
 }finally{await h.close();}
});
test('NET-07 provider returns wrong gross amount: one write, stored UNKNOWN, reconciliation required, never auto-retry',async()=>{
 let writes=0;const id='INV2-NET-87654321';
 const h=await harness(extract,async(req,res,json)=>{
  if(req.url.endsWith('/token'))return json(res,{access_token:'mock'});
  if(req.method==='POST'){writes++;return json(res,{id},201);}
  return json(res,{id,status:'DRAFT',amount:{currency_code:'USD',value:'500.00'},primary_recipients:[{billing_info:{email_address:recipient}}]});
 });
 try{
  const a=await h.request('/api/analyze',{contractText:excerpt});const saved=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Synthetic mismatch test',persistEvidence:true});
  const p=saved.body.project,base=`/api/projects/${p.id}`;const review=await h.request(base+'/receivable',ledger(p));assert.equal(review.status,200);
  await h.request(base+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId});
  const input={confirmed:true,milestoneIndex:0,recipientEmail:recipient,agreementVersionId:p.agreementVersionId,authorizedAmount:'400.00',ledgerRevisionId:review.body.project.receivableLedger.id,netAmountConfirmed:true};
  const r=await h.request(base+'/drafts',input);assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(writes,1);
  assert.equal(r.body.project.milestones[0].invoices[0].status,'UNKNOWN');assert.equal(r.body.project.milestones[0].readiness.code,'reconcile');
  assert.equal((await h.request(base+'/drafts',input)).status,400);assert.equal(writes,1);
 }finally{await h.close();}
});

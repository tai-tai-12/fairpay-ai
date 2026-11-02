/** Frozen dev4 safety acceptance criteria. Synthetic test data and mock provider only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/server.mjs';
import {createProject, publicProject, validateDraft, draftFinancialReview} from '../project-model.mjs';
import {FINANCIAL_POLICY_VERSION, FINANCIAL_POLICY_REVISION} from '../financial-policy.mjs';
import {recordReceivable} from '../receivables.mjs';
const text='Project: Safe test. Milestone 1: Report fee USD 500 after client acceptance.';
const recipient='synthetic@example.test';
const extract=()=>({project_summary:'Safe test',currency_code:'USD',warnings:[],milestones:[{title:'Report',amount:'500',trigger:'actual client acceptance',source_excerpt:'Milestone 1: Report fee USD 500 after client acceptance'}]});
const saved=async h=>{const a=await h.request('/api/analyze',{contractText:text});assert.equal(a.status,200);const response=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Synthetic',persistEvidence:true});assert.equal(response.status,201);return response.body.project;};
const review=p=>({confirmed:true,expectedRevision:null,agreementVersionId:p.agreementVersionId,complete:true,confirmation:{humanVerified:true,reference:'Synthetic no-credit financial review, all milestones checked'},gross:p.milestones.map(m=>({milestoneId:m.canonicalId,amount:m.amount,currency:p.currency,humanVerified:true,reference:m.source_excerpt})),credits:[]});
const invoiceId='INV2-DEV4-12345678';
test('DEV4-01 legacy saved project cannot skip financial review even after self-reported acceptance',async()=>{
 const h=await harness(extract);try{const p=await saved(h);const url=`/api/projects/${p.id}`;const approved=await h.request(url+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId});assert.equal(approved.status,200);
 const fresh=(await h.request(url)).body.project;assert.equal(fresh.milestones[0].readiness.code,'blocked');assert.equal(fresh.summary.readyToDraftCents,0);
 const r=await h.request(url+'/drafts',{confirmed:true,milestoneIndex:0,recipientEmail:recipient,agreementVersionId:p.agreementVersionId});assert.equal(r.status,400);assert.match(r.body.error,/financial reconciliation/i);assert.equal(h.paypalCalls(),0);
 }finally{await h.close();}
});
test('DEV4-02 legacy ephemeral /api/invoices create is disabled without contacting PayPal',async()=>{
 const h=await harness(extract);try{const a=await h.request('/api/analyze',{contractText:text});const r=await h.request('/api/invoices',{analysisId:a.body.analysisId,title:'Report',amount:'500.00',milestoneIndex:0,confirmed:true,clientApproved:true,recipientEmail:recipient});assert.equal(r.status,410);assert.equal(h.paypalCalls(),0);}finally{await h.close();}
});
test('DEV4-03 exact, human-attested no-credit balance plus fresh acceptance permits ONE Sandbox draft with immutable audit binding',async()=>{
 let financialWrites=0;const h=await harness(extract,(req,res,json)=>{if(req.url.endsWith('/token'))return json(res,{access_token:'test'});if(req.method==='POST'){financialWrites++;return json(res,{id:invoiceId},201);}return json(res,{id:invoiceId,status:'DRAFT',amount:{currency_code:'USD',value:'500.00'},primary_recipients:[{billing_info:{email_address:recipient}}]});});
 try{const p=await saved(h),base=`/api/projects/${p.id}`;const receivable=await h.request(base+'/receivable',review(p));assert.equal(receivable.status,200,JSON.stringify(receivable.body));const ledgerRevisionId=receivable.body.project.receivableLedger.id;
 let r=await h.request(base+'/drafts',{confirmed:true,milestoneIndex:0,recipientEmail:recipient,agreementVersionId:p.agreementVersionId});assert.equal(r.status,400);assert.equal(financialWrites,0);
 await h.request(base+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId});r=await h.request(base+'/drafts',{confirmed:true,milestoneIndex:0,recipientEmail:recipient,agreementVersionId:p.agreementVersionId,ledgerRevisionId,authorizedAmount:'500.00',netAmountConfirmed:true});assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(financialWrites,1);
 const inv=r.body.project.milestones[0].invoices[0];assert.equal(inv.authorization.ledgerRevisionId,ledgerRevisionId);assert.equal(inv.authorization.agreementVersionId,p.agreementVersionId);assert.equal(inv.authorization.amountMinor,50000);assert.equal(inv.authorization.currency,'USD');assert.equal(inv.authorization.recipientEmail,recipient);assert.ok(inv.authorization.operationId);
 r=await h.request(base+'/drafts',{confirmed:true,milestoneIndex:0,recipientEmail:recipient,agreementVersionId:p.agreementVersionId});assert.equal(r.status,400);assert.equal(financialWrites,1);
 }finally{await h.close();}
});
test('DEV4-04 credits and stale revisions never allow gross amount invoice authorization',()=>{
 const excerpt='Milestone 1: Report fee USD 500 after acceptance';const p=createProject({summary:'Synthetic',currency:'USD',milestones:[{title:'Report',trigger:'acceptance',source_excerpt:excerpt,amount:'500.00',evidence_matched:true,amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}]});p.agreementVersionId='ag1';
 const d={confirmed:true,expectedRevision:null,agreementVersionId:'ag1',complete:true,confirmation:{humanVerified:true,reference:'Synthetic accounting evidence reviewed completely'},gross:[{milestoneId:p.milestones[0].canonicalId,amount:'500.00',currency:'USD',humanVerified:true,reference:excerpt}],credits:[{id:'synthetic-deposit',kind:'deposit',amount:'100.00',currency:'USD',humanVerified:true,reference:'Synthetic paid deposit receipt for report',allocations:[{milestoneId:p.milestones[0].canonicalId,amount:'100.00'}]}]};
 recordReceivable(p,d);p.milestones[0].approvalStatus='approved';assert.equal(draftFinancialReview(p,p.milestones[0]).eligible,true);assert.equal(draftFinancialReview(p,p.milestones[0]).amountMinor,40000);assert.equal(publicProject(p).milestones[0].readiness.code,'ready');assert.throws(()=>validateDraft(p,0,recipient,true),/exact net amount|authorization/i);
 p.receivableLedger.policyRevision='old';assert.equal(draftFinancialReview(p,p.milestones[0]).eligible,false);assert.equal(publicProject(p).summary.readyToDraftCents,0);
});

test('DEV4-05 authorization snapshot tampering never becomes a verified draft or payment',async()=>{
 const {reconcileInvoice}=await import('../payment-integrity.mjs');
 const snapshot={operationId:'11111111-1111-4111-8111-111111111111',ledgerRevisionId:'ledger-id',agreementVersionId:'agreement-id',policyRevision:FINANCIAL_POLICY_REVISION,amountMinor:50000,currency:'USD',recipientEmail:recipient};
 const inv={invoiceId,status:'DRAFT',recipientEmail:recipient,providerRecipientEmail:recipient,total:{currency:'USD',value:'500.00'},amount:'500.00',lastVerifiedAt:'2026-10-16T11:00:00Z',authorization:snapshot};
 assert.equal(reconcileInvoice({amount:'500.00'},inv).ok,true);
 for(const changed of [{...snapshot,amountMinor:10000},{...snapshot,recipientEmail:'swapped@example.test'},{...snapshot,ledgerRevisionId:null},{...snapshot,operationId:'not-an-operation-id'}])assert.equal(reconcileInvoice({amount:'500.00'},{...inv,authorization:changed}).code,'AUTHORIZATION_EVIDENCE_MISMATCH');
});

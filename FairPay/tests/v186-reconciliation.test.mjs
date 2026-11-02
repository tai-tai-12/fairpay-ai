import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {harness} from './support/server.mjs';
import {createProject,stateOf,publicProject,summarize} from '../project-model.mjs';
import {nextActions} from '../action-engine.mjs';
import {reconcileInvoice} from '../payment-integrity.mjs';
import {FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import {paymentView,paymentStates} from '../public/payment-view.mjs';

const invoiceId='INV2-SYNTHETIC-12345678';
const contract='Project: Synthetic maple research. Milestone 1: Written report costs USD 620, billable after actual client acceptance.';
const extraction=()=>({project_summary:'Maple',currency_code:'USD',warnings:[],milestones:[{title:'Written report',amount:'620',trigger:'actual acceptance',source_excerpt:contract}]});
async function ready(h){
 const a=await h.request('/api/analyze',{contractText:contract});assert.equal(a.status,200);
 const save=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Maple',persistEvidence:true});assert.equal(save.status,201);
 const p=save.body.project,url=`/api/projects/${p.id}`;
 const approval=await h.request(url+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId});assert.equal(approval.status,200);
 return {p,url};
}
const details=(status='DRAFT',total='620.00',due='620.00')=>({id:invoiceId,status,amount:total===null?undefined:{currency_code:'USD',value:total},due_amount:due===null?undefined:{currency_code:'USD',value:due}});

test('v1.8.6 mismatched or unverifiable PAID cannot become confirmed payment or revenue',()=>{
 const p=createProject({currency:'USD',summary:'Maple',milestones:[{title:'Written report',amount:'620.00',trigger:'acceptance',source_excerpt:contract,amount_verification:'verified',evidence_matched:true,financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}]},'Maple');
 const m=p.milestones[0];m.invoices=[{invoiceId,status:'PAID',amount:'620.00',total:{currency:'USD',value:'6.20'},dueAmount:{currency:'USD',value:'0.00'},lastVerifiedAt:'2026-10-15T12:00:00Z'}];
 assert.equal(stateOf(m).code,'reconcile');assert.equal(publicProject(p).summary.confirmedPaidCents,0);assert.equal(publicProject(p).summary.paidCents,0);
 assert.equal(nextActions(publicProject(p))[0].code,'RECONCILE_INVOICE');
 assert.equal(paymentView({...m,readiness:stateOf(m)}).canCreateDraft,false);
 assert.equal(paymentView({...m,readiness:stateOf(m)}).group,'attention');
 assert.ok(paymentStates.includes('reconcile'));
 m.invoices[0].total={currency:'USD',value:'620.00'};
 m.invoices[0].lastVerifiedAt=null;assert.equal(stateOf(m).code,'reconcile');
 m.invoices[0].lastVerifiedAt='2026-10-15T12:00:00Z';assert.equal(stateOf(m).code,'paid');assert.equal(summarize(p).confirmedPaidCents,62000);
 m.invoices[0].dueAmount={currency:'USD',value:'10.00'};assert.equal(stateOf(m).code,'reconcile');
 m.invoices[0].dueAmount=null;m.invoices[0].total=null;assert.equal(stateOf(m).code,'reconcile');
 assert.equal(reconcileInvoice(m,{status:'PAID',amount:'620.00',total:{currency:'GBP',value:'620.00'},lastVerifiedAt:'2026-10-15T12:00:00Z'}).code,'INVOICE_TOTAL_MISMATCH');
});

test('v1.8.6 PayPal PAID amount discrepancy is audited, no paid KPI and no new draft permitted',async()=>{
 let response=details();let creates=0;
 const h=await harness(extraction,(req,res,json)=>{
  if(req.url==='/v1/oauth2/token')return json(res,{access_token:'mock'});
  if(req.method==='POST'){creates++;return json(res,{id:invoiceId},201);}
  return json(res,response);
 });
 try{
  const {p,url}=await ready(h);const body={milestoneIndex:0,recipientEmail:'synthetic@example.test',confirmed:true,agreementVersionId:p.agreementVersionId};
  assert.equal((await h.request(url+'/drafts',body)).status,201);assert.equal(creates,1);
  response=details('PAID','6.20','0.00');
  assert.equal((await h.request(url+`/invoices/${invoiceId}/refresh`,{})).status,200);
  let project=(await h.request(url)).body.project;
  assert.equal(project.milestones[0].invoices[0].status,'PAID','raw PayPal response preserved for investigation');
  assert.equal(project.milestones[0].readiness.code,'reconcile');
  assert.equal(project.summary.confirmedPaidCents,0);assert.equal(project.summary.paidCents,0);
  assert.equal(project.decisionHistory.at(-1).type,'invoice_reconciliation_required');
  assert.equal((await h.request(url+'/drafts',body)).status,400);assert.equal(creates,1);
  response=details('PAID','620.00','0.00');assert.equal((await h.request(url+`/invoices/${invoiceId}/refresh`,{})).status,200);
  project=(await h.request(url)).body.project;assert.equal(project.milestones[0].readiness.code,'paid');assert.equal(project.summary.confirmedPaidCents,62000);
 }finally{await h.close();}
});

test('v1.8.6 concurrent PayPal refresh requests do not overwrite newer read-back with older response',async()=>{
 let reads=0,created=0;
 const h=await harness(extraction,async(req,res,json)=>{
  if(req.url==='/v1/oauth2/token')return json(res,{access_token:'mock'});
  if(req.method==='POST'){created++;return json(res,{id:invoiceId},201);}
  const number=reads++;
  if(number===1){await delay(140);return json(res,details('DRAFT'));}
  if(number>=2)return json(res,details('PAID','620.00','0.00'));
  return json(res,details());
 });
 try{
  const {p,url}=await ready(h);
  assert.equal((await h.request(url+'/drafts',{milestoneIndex:0,recipientEmail:'synthetic@example.test',confirmed:true,agreementVersionId:p.agreementVersionId})).status,201);
  const ref=url+`/invoices/${invoiceId}/refresh`;
  const [a,b]=await Promise.all([h.request(ref,{}),h.request(ref,{})]);
  assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(reads,3);assert.equal(created,1);
  const current=(await h.request(url)).body.project;
  assert.equal(current.milestones[0].invoices[0].status,'PAID');assert.equal(current.milestones[0].readiness.code,'paid');
  assert.deepEqual(current.milestones[0].invoices[0].statusHistory.map(e=>e.status),['DRAFT','PAID']);
 }finally{await h.close();}
});

test('v1.8.6 approval/amendment records cannot be rewritten after invoice creation',async()=>{
 let creates=0;
 const h=await harness(extraction,(req,res,json)=>{
   if(req.url==='/v1/oauth2/token')return json(res,{access_token:'mock'});
   if(req.method==='POST'){creates++;return json(res,{id:invoiceId},201);}
   return json(res,details());
 });
 try{
  const {p,url}=await ready(h);
  assert.equal((await h.request(url+'/drafts',{milestoneIndex:0,recipientEmail:'synthetic@example.test',confirmed:true,agreementVersionId:p.agreementVersionId})).status,201);
  assert.equal((await h.request(url+'/milestones/0/approval',{status:'pending',agreementVersionId:p.agreementVersionId})).status,400);
  assert.equal((await h.request(url+'/milestones/0/amendment',{confirmed:true,agreementVersionId:p.agreementVersionId})).status,400);
  const current=(await h.request(url)).body.project;
  assert.equal(current.milestones[0].approvalStatus,'approved');assert.equal(current.milestones[0].invoices.length,1);assert.equal(creates,1);
 }finally{await h.close();}
});

test('v1.8.6 authorization cannot be revoked or rewritten while the Sandbox request is in flight',async()=>{
 let resolveCreate;let started;
 const startedPromise=new Promise(r=>started=r);
 const h=await harness(extraction,async(req,res,json)=>{
   if(req.url==='/v1/oauth2/token')return json(res,{access_token:'mock'});
   if(req.method==='POST'){started();await new Promise(r=>resolveCreate=r);return json(res,{id:invoiceId},201);}
   return json(res,details());
 });
 try{
   const {p,url}=await ready(h);
   const draft=h.request(url+'/drafts',{milestoneIndex:0,recipientEmail:'synthetic@example.test',confirmed:true,agreementVersionId:p.agreementVersionId});
   await startedPromise;
   const approval=await h.request(url+'/milestones/0/approval',{status:'pending',agreementVersionId:p.agreementVersionId});
   assert.equal(approval.status,400);
   assert.match(approval.body.error,/invoice request|saved invoice/i);
   resolveCreate();assert.equal((await draft).status,201);
   const current=(await h.request(url)).body.project;
   assert.equal(current.milestones[0].approvalStatus,'approved');
   assert.equal(current.milestones[0].invoices.length,1);
 }finally{if(resolveCreate)resolveCreate();await h.close();}
});
